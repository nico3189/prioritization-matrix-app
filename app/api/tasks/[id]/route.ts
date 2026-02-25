import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { TaskStatus, DurationBucket, TaskType, LinkedEventType } from '@prisma/client'
import { logTaskEvent } from '@/lib/events'
import { getEffectiveUrgency } from '@/lib/eisenhower'

const patchSchema = z.object({
  title: z.string().min(1).max(2000).optional(),
  notes: z.string().max(10000).optional().nullable(),
  status: z.nativeEnum(TaskStatus).optional(),
  durationBucket: z.nativeEnum(DurationBucket).optional().nullable(),
  type: z.nativeEnum(TaskType).optional().nullable(),
  customerId: z.string().cuid().optional().nullable(),
  canDelegate: z.boolean().optional(),
  delegatedToId: z.string().cuid().optional().nullable(),
  importance: z.number().min(0).max(100).optional(),
  urgency: z.number().min(0).max(100).optional(),
  nextAction: z.string().max(500).optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
  reviewAt: z.string().datetime().optional().nullable(),
  url: z.string().max(2000).optional().nullable().or(z.literal('')),
  tag: z.string().max(200).optional().nullable(),
  linkedEventId: z.string().optional().nullable(),
  linkedEventType: z.nativeEnum(LinkedEventType).optional().nullable(),
  eventStartAt: z.string().datetime().optional().nullable(),
  eventEndAt: z.string().datetime().optional().nullable(),
})

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const task = await prisma.task.findFirst({
    where: { id: (await params).id, userId: session.user.id },
    include: { customer: true, delegatedTo: true },
  })
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (task.dueAt != null) {
    const baseUrg = task.urgency ?? 0
    const effective = getEffectiveUrgency(baseUrg, task.dueAt)
    const rounded = Math.round(effective)
    if (rounded !== baseUrg && rounded >= 0 && rounded <= 100) {
      const updated = await prisma.task.update({
        where: { id: task.id },
        data: { urgency: rounded },
        include: { customer: true, delegatedTo: true },
      })
      return NextResponse.json(updated)
    }
  }
  return NextResponse.json(task)
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = (await params).id
  const task = await prisma.task.findFirst({
    where: { id, userId: session.user.id },
  })
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(parsed.error.flatten(), { status: 400 })
  const data = parsed.data as Record<string, unknown>
  if (data.dueAt !== undefined) data.dueAt = data.dueAt ? new Date(data.dueAt as string) : null
  if (data.reviewAt !== undefined) data.reviewAt = data.reviewAt ? new Date(data.reviewAt as string) : null
  if (data.url !== undefined && data.url === '') data.url = null
  if (data.tag !== undefined && data.tag === '') data.tag = null
  if (data.eventStartAt !== undefined) data.eventStartAt = data.eventStartAt ? new Date(data.eventStartAt as string) : null
  if (data.eventEndAt !== undefined) data.eventEndAt = data.eventEndAt ? new Date(data.eventEndAt as string) : null
  const prevImportance = task.importance
  const prevUrgency = task.urgency
  const updated = await prisma.task.update({
    where: { id },
    data,
    include: { customer: true, delegatedTo: true },
  })
  if (parsed.data.status === TaskStatus.qualified) await logTaskEvent(id, session.user.id, 'qualified')
  if (parsed.data.status === TaskStatus.done) await logTaskEvent(id, session.user.id, 'done')
  if (parsed.data.status === TaskStatus.snoozed) await logTaskEvent(id, session.user.id, 'snoozed')
  if (
    (parsed.data.importance !== undefined || parsed.data.urgency !== undefined) &&
    (parsed.data.importance !== prevImportance || parsed.data.urgency !== prevUrgency)
  ) {
    await logTaskEvent(id, session.user.id, 'overridden', {
      prev: { importance: prevImportance, urgency: prevUrgency },
      next: { importance: updated.importance, urgency: updated.urgency },
    })
  }
  return NextResponse.json(updated)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = (await params).id
  const task = await prisma.task.findFirst({
    where: { id, userId: session.user.id },
  })
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await prisma.task.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
