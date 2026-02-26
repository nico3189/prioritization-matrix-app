import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { TaskStatus, TaskType } from '@prisma/client'
import { logTaskEvent } from '@/lib/events'
import { parseSmartInput } from '@/lib/ai/parser'
import { computeUrgencyFromDeadline, getImportanceBoostFromType } from '@/lib/eisenhower'
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz'
import { format } from 'date-fns'
import { da } from 'date-fns/locale'

const TZ = 'Europe/Copenhagen'

/** Når AI returnerer midnight (00:00-01:00), normaliser til 08:00 i brugerens timezone. */
function normalizeDueAt(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  const h = parseInt(formatInTimeZone(d, TZ, 'HH'), 10)
  const m = parseInt(formatInTimeZone(d, TZ, 'mm'), 10)
  if (h <= 1 && m === 0) {
    const y = parseInt(formatInTimeZone(d, TZ, 'yyyy'), 10)
    const mo = parseInt(formatInTimeZone(d, TZ, 'MM'), 10) - 1
    const day = parseInt(formatInTimeZone(d, TZ, 'dd'), 10)
    const at8am = new Date(Date.UTC(y, mo, day, 8, 0, 0, 0))
    return fromZonedTime(at8am, TZ)
  }
  return d
}

/** Returnerer true når teksten indeholder eksplicit dato/tid/deadline (fx "næste onsdag", "om en uge"). Varighed (fx "30-60 min") tæller ikke. */
function hasExplicitDateOrDeadline(rawText: string): boolean {
  const t = rawText.toLowerCase()
  if (/\d{1,3}-\d{1,3}\s*(min|minutter|timer?)\b/i.test(t)) return false
  const datePatterns = [
    /\b(før|inden|til|senest)\s+(mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag|uge)\b/,
    /\bnæste\s+(mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag|uge)\b/,
    /\b(mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag)\s+(d\.?|den)\s*\d/,
    /\b(mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag)\b/,
    /\b(i morgen|i dag|næste uge|denne uge)\b/,
    /\bom\s+(en\s+)?uge\b/,
    /\b(om|indenfor|inden)\s+\d+\s*(dage|uger)\b/,
    /\bkl\.?\s*\d{1,2}(:\d{2})?\b/,
    /\b\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}\b/,
    /\b(januar|februar|marts|april|maj|juni|juli|august|september|oktober|november|december)\b/,
    /\b(d\.?|den)\s*\d{1,2}\.?\s*(januar|februar|marts|april|maj|juni|juli|august|september|oktober|november|december)\b/,
    /\b\d{1,2}\.?\s*(januar|februar|marts|april|maj|juni|juli|august|september|oktober|november|december)\b/,
    /\bdeadline\b/,
    /\b(dato|d\.\s*\d|frist)\b/,
  ]
  return datePatterns.some((p) => p.test(t))
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Udtræk første URL fra tekst (https eller http). */
function extractUrlFromText(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s]+/)
  if (!match) return null
  let url = match[0]
  // Fjern trailing punctuation som kan være medført
  url = url.replace(/[.,;:!?)]+$/, '')
  return url.length > 10 ? url : null
}

/** Erstat kunde- og team-koder med navne i titlen (fx CES → CeramicSpeed). */
function replaceCodesWithNamesInTitle(
  title: string,
  matchedCustomer: { code: string | null; name: string } | null,
  matchedTeamMember: { code: string | null; name: string } | null
): string {
  let result = title
  if (matchedCustomer?.code) {
    const re = new RegExp(`\\b${escapeRegex(matchedCustomer.code)}\\b`, 'gi')
    result = result.replace(re, matchedCustomer.name)
  }
  if (matchedTeamMember?.code) {
    const re = new RegExp(`\\b${escapeRegex(matchedTeamMember.code)}\\b`, 'gi')
    result = result.replace(re, matchedTeamMember.name)
  }
  return result
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = (await params).id
  const task = await prisma.task.findFirst({
    where: { id, userId: session.user.id },
    include: { customer: true, delegatedTo: true },
  })
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const customers = await prisma.customer.findMany({
    where: { userId: session.user.id },
    select: { id: true, name: true, code: true, priority: true },
  })
  const teamMembers = await prisma.teamMember.findMany({
    where: { userId: session.user.id },
    select: { id: true, name: true, code: true },
  })
  const now = toZonedTime(new Date(), 'Europe/Copenhagen')
  const rawText = [task.title, task.notes].filter(Boolean).join('\n')
  const todayFormatted = format(now, "EEEE d. MMMM yyyy", { locale: da })
  const parserInput = {
    rawText,
    now: now.toISOString(),
    todayFormatted,
    timezone: 'Europe/Copenhagen',
    customerNames: customers.map((c) =>
      c.code ? `${c.name} (${c.code})` : c.name
    ),
    teamMemberNames: teamMembers.map((t) =>
      t.code ? `${t.name} (${t.code})` : t.name
    ),
    calendarEvents: [],
    ...(task.linkedEventId && {
      linkedEvent: {
        title: task.linkedEventTitle ?? undefined,
        url: task.linkedEventUrl ?? undefined,
      },
    }),
  }
  let result: Awaited<ReturnType<typeof parseSmartInput>>
  try {
    result = await parseSmartInput(parserInput)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ukendt fejl'
    console.error('[parse] AI parse failed:', err)
    return NextResponse.json(
      {
        error: 'AI kunne ikke kvalificere opgaven',
        code: 'PARSE_FAILED',
        detail: message,
      },
      { status: 503 }
    )
  }
  let customerId: string | null = null
  let matchedCustomer: (typeof customers)[number] | null = null
  if (result.customer) {
    const q = result.customer.trim().toLowerCase()
    const match = customers.find(
      (c) =>
        c.name.toLowerCase() === q ||
        (c.code && c.code.toLowerCase() === q)
    )
    if (match) {
      customerId = match.id
      matchedCustomer = match
    }
  }
  let delegatedToId: string | null = null
  let matchedTeamMember: (typeof teamMembers)[number] | null = null
  if (result.delegatedTo) {
    const q = result.delegatedTo.trim().toLowerCase()
    const match = teamMembers.find(
      (t) =>
        t.name.toLowerCase() === q ||
        (t.code && t.code.toLowerCase() === q)
    )
    if (match) {
      delegatedToId = match.id
      matchedTeamMember = match
    }
  }
  const extractedUrl =
    result.url?.trim() || extractUrlFromText(rawText) || null

  const rawTitle = result.title != null && result.title.trim() !== '' ? result.title.trim() : null
  const title = rawTitle
    ? replaceCodesWithNamesInTitle(rawTitle, matchedCustomer, matchedTeamMember)
    : null
  const hasExplicitDeadline = hasExplicitDateOrDeadline(rawText)
  const hasNoDeadline = !task.linkedEventId && !hasExplicitDeadline
  const resolvedDueAt = task.linkedEventId
    ? task.dueAt
    : hasExplicitDeadline
      ? normalizeDueAt(result.dueAt)
      : null

  let importance = result.importance ?? 50
  let urgency: number
  if (resolvedDueAt != null) {
    urgency = Math.round(computeUrgencyFromDeadline(resolvedDueAt))
  } else {
    urgency = result.urgency ?? 50
    if (customerId && matchedCustomer?.priority != null) {
      const boost = (matchedCustomer.priority - 5) * 2
      importance = Math.max(0, Math.min(100, importance + boost))
      urgency = Math.max(0, Math.min(100, urgency + boost))
    }
  }

  const validTypes: TaskType[] = ['kunde', 'internt', 'salg', 'ledelse']
  const resolvedType: TaskType =
    result.type && validTypes.includes(result.type)
      ? result.type
      : customerId
        ? 'kunde'
        : 'internt'
  if (resolvedType === 'internt') {
    customerId = null
    matchedCustomer = null
  }
  importance = Math.max(0, Math.min(100, importance + getImportanceBoostFromType(resolvedType)))

  const updateData: Record<string, unknown> = {
    ...(title && { title }),
    type: resolvedType,
    ...(result.durationBucket != null && { durationBucket: result.durationBucket }),
    customerId: customerId ?? undefined,
    ...(result.canDelegate !== undefined && { canDelegate: result.canDelegate }),
    delegatedToId: delegatedToId ?? undefined,
    ...(result.linkedEventId != null && { linkedEventId: result.linkedEventId }),
    ...(result.linkedEventType != null && { linkedEventType: result.linkedEventType }),
    ...(!task.linkedEventId &&
      (hasExplicitDateOrDeadline(rawText)
        ? { dueAt: normalizeDueAt(result.dueAt) }
        : { dueAt: null })),
    importance,
    urgency,
    ...(result.nextAction !== undefined && { nextAction: result.nextAction }),
    ...(result.tags &&
      result.tags.length > 0 && {
        tag: result.tags.slice(0, 4).join(', '),
      }),
    ...(extractedUrl && { url: extractedUrl }),
  }
  const hasDuration = Boolean(result.durationBucket)
  const newStatus = hasDuration ? TaskStatus.qualified : TaskStatus.needs_clarification
  const updated = await prisma.task.update({
    where: { id },
    data: { ...updateData, status: newStatus },
    include: { customer: true, delegatedTo: true },
  })
  await logTaskEvent(id, session.user.id, 'parsed')
  await logTaskEvent(id, session.user.id, 'ai_scored', { result: Object.keys(result) })
  return NextResponse.json(updated)
}
