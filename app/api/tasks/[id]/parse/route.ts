import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { TaskStatus } from '@prisma/client'
import { logTaskEvent } from '@/lib/events'
import { parseSmartInput } from '@/lib/ai/parser'
import { toZonedTime } from 'date-fns-tz'

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
    select: { id: true, name: true },
  })
  const teamMembers = await prisma.teamMember.findMany({
    where: { userId: session.user.id },
    select: { id: true, name: true },
  })
  const now = toZonedTime(new Date(), 'Europe/Copenhagen')
  const rawText = [task.title, task.notes].filter(Boolean).join('\n')
  const parserInput = {
    rawText,
    now: now.toISOString(),
    timezone: 'Europe/Copenhagen',
    customerNames: customers.map((c) => c.name),
    teamMemberNames: teamMembers.map((t) => t.name),
    calendarEvents: [],
  }
  const result = await parseSmartInput(parserInput)
  let customerId: string | null = null
  if (result.customer) {
    const match = customers.find(
      (c) => c.name.toLowerCase() === result.customer!.toLowerCase()
    )
    if (match) customerId = match.id
  }
  let delegatedToId: string | null = null
  if (result.delegatedTo) {
    const match = teamMembers.find(
      (t) => t.name.toLowerCase() === result.delegatedTo!.toLowerCase()
    )
    if (match) delegatedToId = match.id
  }
  const updateData: Record<string, unknown> = {
    ...(result.title && { title: result.title }),
    ...(result.type !== undefined && { type: result.type }),
    ...(result.durationBucket != null && { durationBucket: result.durationBucket }),
    customerId: customerId ?? undefined,
    ...(result.canDelegate !== undefined && { canDelegate: result.canDelegate }),
    delegatedToId: delegatedToId ?? undefined,
    ...(result.linkedEventId != null && { linkedEventId: result.linkedEventId }),
    ...(result.linkedEventType != null && { linkedEventType: result.linkedEventType }),
    ...(result.dueAt && { dueAt: new Date(result.dueAt) }),
    ...(result.reviewAt && { reviewAt: new Date(result.reviewAt) }),
    ...(result.importance !== undefined && { importance: result.importance }),
    ...(result.urgency !== undefined && { urgency: result.urgency }),
    ...(result.nextAction !== undefined && { nextAction: result.nextAction }),
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
