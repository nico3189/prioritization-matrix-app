import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import {
  computeUrgencyFromDeadline,
  computeImportanceWithContext,
  computeUrgencyWithContext,
} from '@/lib/eisenhower'
import {
  getKeywordOffsets,
  normalizePriorityFactors,
} from '@/lib/priority-factors'
import { parseSmartInput } from '@/lib/ai/parser'
import { toZonedTime } from 'date-fns-tz'
import { format } from 'date-fns'
import { da } from 'date-fns/locale'

const TZ = 'Europe/Copenhagen'

/**
 * POST /api/tasks/[id]/sync-urgency
 * Genberegner hastegrad for én opgave.
 * Urgency: fra deadline når dueAt er sat; ellers fra AI med type og kunde integreret.
 * Importance: fra AI med type og kundepriority integreret i den grundlæggende logik.
 * Body: { dueAt?: string } - hvis angivet, bruges denne dato i stedet for DB.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = (await params).id
  const task = await prisma.task.findFirst({
    where: { id, userId: session.user.id },
    select: {
      id: true,
      userId: true,
      urgency: true,
      importance: true,
      dueAt: true,
      customerId: true,
      type: true,
      title: true,
      notes: true,
      importanceManuallyOverriddenAt: true,
      urgencyManuallyOverriddenAt: true,
    },
  })

  if (!task) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let dueAt: Date | string | null = task.dueAt
  try {
    const body = await req.json().catch(() => ({}))
    if (body && 'dueAt' in body) {
      dueAt = body.dueAt === '' || body.dueAt === null ? null : new Date(body.dueAt)
    }
  } catch {
    /* ignorer */
  }

  const data: { urgency?: number; importance?: number } = {}

  if (dueAt != null) {
    data.urgency = Math.round(computeUrgencyFromDeadline(dueAt))
  }

  const needAI = !task.importanceManuallyOverriddenAt || !task.urgencyManuallyOverriddenAt
  if (needAI) {
    const rawText = [task.title, task.notes].filter(Boolean).join('\n') || task.title || ''
    if (rawText.trim()) {
      const [customers, teamMembers, customerWithPriority, userSettings] =
        await Promise.all([
        prisma.customer.findMany({
          where: { userId: session.user.id },
          select: { id: true, name: true, code: true },
        }),
        prisma.teamMember.findMany({
          where: { userId: session.user.id },
          select: { name: true, code: true },
        }),
        task.customerId
          ? prisma.customer.findUnique({
              where: { id: task.customerId },
              select: { priority: true },
            })
          : Promise.resolve(null),
        prisma.userSettings.findUnique({
          where: { userId: session.user.id },
          select: { priorityFactors: true },
        }),
      ])
      const priorityFactors = normalizePriorityFactors(userSettings?.priorityFactors)
      const now = toZonedTime(new Date(), TZ)
      try {
        const result = await parseSmartInput({
          rawText,
          now: now.toISOString(),
          todayFormatted: format(now, 'EEEE d. MMMM yyyy', { locale: da }),
          timezone: TZ,
          customerNames: customers.map((c) => (c.code ? `${c.name} (${c.code})` : c.name)),
          teamMemberNames: teamMembers.map((t) => (t.code ? `${t.name} (${t.code})` : t.name)),
          calendarEvents: [],
        })
        const kwOffsets = getKeywordOffsets(rawText, priorityFactors.keywordWeights)
        if (!task.importanceManuallyOverriddenAt) {
          const aiImp = result.importance != null ? Math.round(result.importance) : 50
          data.importance = computeImportanceWithContext(
            aiImp,
            task.type,
            customerWithPriority?.priority,
            priorityFactors,
            kwOffsets.importance
          )
        }
        if (!task.urgencyManuallyOverriddenAt && dueAt == null) {
          const aiUrg = result.urgency != null ? Math.round(result.urgency) : 40
          data.urgency = computeUrgencyWithContext(
            aiUrg,
            task.type,
            customerWithPriority?.priority,
            priorityFactors,
            kwOffsets.urgency
          )
        }
      } catch (err) {
        console.error(`[sync-urgency] AI parse failed for task ${id}:`, err)
      }
    }
  }

  const currentImp = task.importance ?? 0
  const currentUrg = task.urgency ?? 0
  const impChanged = data.importance != null && data.importance !== currentImp
  const urgChanged = data.urgency != null && data.urgency !== currentUrg
  if (impChanged || urgChanged) {
    await prisma.task.update({
      where: { id },
      data,
    })
  }

  const updated = await prisma.task.findUnique({
    where: { id },
    include: { customer: true, delegatedTo: true },
  })

  return NextResponse.json(updated)
}
