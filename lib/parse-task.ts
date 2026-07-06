import { prisma } from '@/lib/db'
import { TaskStatus, TaskType } from '@prisma/client'
import { logTaskEvent } from '@/lib/events'
import { parseSmartInput, inferDurationBucketFromText } from '@/lib/ai/parser'
import {
  computeUrgencyFromDeadline,
  computeImportanceWithContext,
  computeUrgencyWithContext,
} from '@/lib/eisenhower'
import {
  getKeywordOffsets,
  normalizePriorityFactors,
} from '@/lib/priority-factors'
import {
  extractExplicitCustomerFromText,
  resolveCustomerMatch,
} from '@/lib/resolve-customer'
import {
  extractDelegationQueryFromText,
  resolveTeamMemberMatch,
  teamMemberMentionedInText,
} from '@/lib/resolve-team-member'
import { mergeTaskUrls } from '@/lib/task-urls'
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz'
import { format } from 'date-fns'
import { da } from 'date-fns/locale'

const TZ = 'Europe/Copenhagen'

const TAG_COLORS = ['#8B5CF6', '#10B981', '#F59E0B', '#0EA5E9', '#EC4899']

async function findOrCreateTag(
  userId: string,
  name: string
): Promise<string> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Empty tag name')
  const existing = await prisma.tag.findFirst({
    where: { userId, name: { equals: trimmed, mode: 'insensitive' } },
  })
  if (existing) return existing.id
  const color = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)]
  const tag = await prisma.tag.create({
    data: { userId, name: trimmed, color },
  })
  return tag.id
}

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

/** Returnerer true når teksten indeholder eksplicit dato/tid/deadline. */
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

/** Erstat kunde- og team-koder med navne i titlen. */
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

/**
 * Kører AI-parse for en opgave. Opdaterer task med type, importance, urgency, tags m.m.
 * Kaster ved AI-fejl; sætter parseStatus til 'failed' i så fald.
 */
export async function runParseForTask(
  taskId: string,
  userId: string
): Promise<void> {
  const task = await prisma.task.findFirst({
    where: { id: taskId, userId },
    include: { customer: true, delegatedTo: true },
  })
  if (!task) throw new Error('Task not found')

  await prisma.task.update({ where: { id: taskId }, data: { parseStatus: 'parsing' } })

  const customers = await prisma.customer.findMany({
    where: { userId },
    select: { id: true, name: true, code: true, priority: true },
  })
  const teamMembers = await prisma.teamMember.findMany({
    where: { userId },
    select: { id: true, name: true, code: true },
  })
  const tags = await prisma.tag.findMany({
    where: { userId },
    select: { name: true, isBlacklisted: true },
  })
  const tagNames = tags.filter((t) => !t.isBlacklisted).map((t) => t.name)
  const blacklistedTagNames = tags.filter((t) => t.isBlacklisted).map((t) => t.name)
  const userSettings = await prisma.userSettings.findUnique({
    where: { userId },
  })
  const priorityFactors = normalizePriorityFactors(userSettings?.priorityFactors)
  const workHours = (userSettings?.workHours as Record<string, { start: string; end: string } | null> | null) ?? {
    mon: { start: '08:00', end: '16:00' },
    tue: { start: '08:00', end: '16:00' },
    wed: { start: '08:00', end: '16:00' },
    thu: { start: '08:00', end: '16:00' },
    fri: { start: '08:00', end: '16:00' },
    sat: { start: '08:00', end: '16:00' },
    sun: { start: '08:00', end: '16:00' },
  }
  const overrideEvents = await prisma.taskEvent.findMany({
    where: { userId, eventType: 'overridden' },
    orderBy: { createdAt: 'desc' },
    take: 12,
    include: { task: { select: { title: true, notes: true } } },
  })
  const overrideExamples = overrideEvents
    .map((e) => {
      const payload = e.payload as { rawText?: string; prev?: Record<string, unknown>; next?: Record<string, unknown> } | null
      if (!payload?.prev || !payload?.next) return null
      const raw = payload.rawText ?? [e.task?.title, e.task?.notes].filter(Boolean).join('\n')
      const changes = Object.keys(payload.next)
        .filter((k) => JSON.stringify(payload.prev?.[k]) !== JSON.stringify(payload.next?.[k]))
        .map((k) => `${k}: ${JSON.stringify(payload.prev?.[k])} → ${JSON.stringify(payload.next?.[k])}`)
        .join(', ')
      if (!changes) return null
      return `- Input: "${raw.slice(0, 120)}${raw.length > 120 ? '…' : ''}" → ${changes}`
    })
    .filter(Boolean)
    .join('\n')

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
    ...(tagNames.length > 0 && { tagNames }),
    ...(blacklistedTagNames.length > 0 && { blacklistedTagNames }),
    ...(overrideExamples && { overrideExamples }),
    ...(task.linkedEventId && {
      linkedEvent: {
        title: task.linkedEventTitle ?? undefined,
        url: task.linkedEventUrl ?? undefined,
      },
    }),
    workHours,
  }

  let result: Awaited<ReturnType<typeof parseSmartInput>>
  try {
    result = await parseSmartInput(parserInput)
  } catch (err) {
    console.error('[parse-task] AI parse failed:', err)
    await prisma.task.update({ where: { id: taskId }, data: { parseStatus: 'failed' } })
    throw err
  }

  let customerId: string | null = null
  let matchedCustomer: (typeof customers)[number] | null = null
  const explicitCustomer = extractExplicitCustomerFromText(rawText)
  const customerQueries = [explicitCustomer, result.customer]
    .filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
  for (const q of customerQueries) {
    const match = resolveCustomerMatch(q, customers)
    if (match) {
      customerId = match.id
      matchedCustomer = customers.find((c) => c.id === match.id) ?? null
      break
    }
  }

  let delegatedToId: string | null = null
  let matchedTeamMember: (typeof teamMembers)[number] | null = null
  const explicitDelegate = extractDelegationQueryFromText(rawText)
  const delegateQueries = [explicitDelegate, result.delegatedTo]
    .filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
  for (const q of delegateQueries) {
    const match = resolveTeamMemberMatch(q, teamMembers)
    if (match && teamMemberMentionedInText(match, rawText)) {
      delegatedToId = match.id
      matchedTeamMember = teamMembers.find((t) => t.id === match.id) ?? null
      break
    }
  }
  if (result.delegatedTo?.trim() && !delegatedToId) {
    const aiMatch = resolveTeamMemberMatch(result.delegatedTo, teamMembers)
    if (aiMatch) {
      console.warn(
        `[parse-task] Rejected hallucinated delegate "${result.delegatedTo}" for task ${taskId}`
      )
    }
  }
  const extractedUrl = mergeTaskUrls(result.url, rawText)

  const rawTitle = result.title != null && result.title.trim() !== '' ? result.title.trim() : null
  const title = rawTitle
    ? replaceCodesWithNamesInTitle(rawTitle, matchedCustomer, matchedTeamMember)
    : null
  const hasExplicitDeadline = hasExplicitDateOrDeadline(rawText)
  const resolvedDueAt = task.linkedEventId
    ? task.dueAt
    : hasExplicitDeadline
      ? normalizeDueAt(result.dueAt)
      : null

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

  const kwOffsets = getKeywordOffsets(rawText, priorityFactors.keywordWeights)
  const aiImportance = Math.max(0, Math.min(100, result.importance ?? 50))
  const importance = computeImportanceWithContext(
    aiImportance,
    resolvedType,
    matchedCustomer?.priority,
    priorityFactors,
    kwOffsets.importance
  )
  const urgency: number =
    resolvedDueAt != null
      ? Math.round(computeUrgencyFromDeadline(resolvedDueAt))
      : computeUrgencyWithContext(
          result.urgency ?? 50,
          resolvedType,
          matchedCustomer?.priority,
          priorityFactors,
          kwOffsets.urgency
        )

  const resolvedDurationBucket =
    result.durationBucket ?? inferDurationBucketFromText(rawText)

  const updateData: Record<string, unknown> = {
    ...(title && { title }),
    type: resolvedType,
    ...(resolvedDurationBucket != null && {
      durationBucket: resolvedDurationBucket,
    }),
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
    ...(result.tags && result.tags.length > 0 && {
      tag: result.tags.slice(0, 4).join(', '),
    }),
    ...(extractedUrl && { url: extractedUrl }),
  }
  const hasDuration = Boolean(resolvedDurationBucket)
  const parkOnUdviklingsliste = result.parkOnUdviklingsliste === true
  const newStatus = parkOnUdviklingsliste
    ? TaskStatus.udvikling
    : hasDuration
      ? TaskStatus.qualified
      : TaskStatus.needs_clarification

  await prisma.task.update({
    where: { id: taskId },
    data: { ...updateData, status: newStatus, parseStatus: 'parsed' },
  })

  if (result.tags && result.tags.length > 0) {
    const tagNamesToCreate = result.tags
      .slice(0, 4)
      .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
    const tagIds: string[] = []
    for (const name of tagNamesToCreate) {
      try {
        const tagId = await findOrCreateTag(userId, name)
        tagIds.push(tagId)
      } catch {
        // skip invalid tag names
      }
    }
    if (tagIds.length > 0) {
      await prisma.taskTag.deleteMany({ where: { taskId } })
      await prisma.taskTag.createMany({
        data: tagIds.map((tagId) => ({ taskId, tagId })),
      })
    }
  }

  await logTaskEvent(taskId, userId, 'parsed')
  await logTaskEvent(taskId, userId, 'ai_scored', { result: Object.keys(result) })
}
