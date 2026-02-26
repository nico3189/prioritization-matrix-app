import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { computeUrgencyFromDeadline, getImportanceBoostFromType } from '@/lib/eisenhower'
import { parseSmartInput } from '@/lib/ai/parser'
import { toZonedTime } from 'date-fns-tz'
import { format } from 'date-fns'
import { da } from 'date-fns/locale'

const TZ = 'Europe/Copenhagen'

/**
 * POST /api/tasks/[id]/sync-urgency
 * Genberegner hastegrad for én opgave.
 * Med deadline: fra nærhed til deadline. Uden: AI vurderer ud fra tekst.
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

  let newImp: number | undefined
  let newUrg: number
  if (dueAt != null) {
    newUrg = Math.round(computeUrgencyFromDeadline(dueAt))
  } else {
    const rawText = [task.title, task.notes].filter(Boolean).join('\n') || task.title || ''
    if (!rawText.trim()) {
      newImp = task.importance ?? 50
      newUrg = task.urgency ?? 40
    } else {
      newImp = 50
      newUrg = 40
      const [customers, teamMembers] = await Promise.all([
        prisma.customer.findMany({
          where: { userId: session.user.id },
          select: { id: true, name: true, code: true, priority: true },
        }),
        prisma.teamMember.findMany({
          where: { userId: session.user.id },
          select: { name: true, code: true },
        }),
      ])
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
        newImp = result.importance != null ? Math.round(result.importance) : 50
        newUrg = result.urgency != null ? Math.round(result.urgency) : 40
        const customer = task.customerId
          ? customers.find((c) => c.id === task.customerId)
          : null
        if (customer?.priority != null) {
          const boost = (customer.priority - 5) * 2
          newImp = Math.max(0, Math.min(100, newImp + boost))
          newUrg = Math.max(0, Math.min(100, newUrg + boost))
        }
        newImp = Math.max(0, Math.min(100, newImp + getImportanceBoostFromType(task.type)))
      } catch (err) {
        console.error(`[sync-urgency] AI parse failed for task ${id}:`, err)
        newImp = task.importance ?? 50
        newUrg = task.urgency ?? 40
      }
    }
    newImp = Math.max(0, Math.min(100, newImp))
    newUrg = Math.max(0, Math.min(100, newUrg))
  }

  const currentImp = task.importance ?? 0
  const currentUrg = task.urgency ?? 0
  const data: { urgency: number; importance?: number } = { urgency: newUrg }
  if (newImp != null) data.importance = newImp
  if ((newImp != null && newImp !== currentImp) || newUrg !== currentUrg) {
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
