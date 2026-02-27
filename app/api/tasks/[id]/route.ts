import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { TaskStatus, DurationBucket, TaskType, LinkedEventType } from '@prisma/client'
import { logTaskEvent } from '@/lib/events'

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
  url: z.string().max(2000).optional().nullable().or(z.literal('')),
  tag: z.string().max(200).optional().nullable(),
  tagIds: z.array(z.string().cuid()).optional(),
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
    include: {
      customer: true,
      delegatedTo: true,
      taskTags: { include: { tag: true } },
    },
  })
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })
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
    include: { taskTags: { select: { tagId: true } } },
  })
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(parsed.error.flatten(), { status: 400 })
  const data = parsed.data as Record<string, unknown>
  const tagIds = data.tagIds as string[] | undefined
  if (tagIds !== undefined) {
    delete data.tagIds
    delete data.tag
  }
  if (data.dueAt !== undefined) data.dueAt = data.dueAt ? new Date(data.dueAt as string) : null
  if (data.url !== undefined && data.url === '') data.url = null
  if (data.tag !== undefined && data.tag === '') data.tag = null
  if (data.eventStartAt !== undefined) data.eventStartAt = data.eventStartAt ? new Date(data.eventStartAt as string) : null
  if (data.eventEndAt !== undefined) data.eventEndAt = data.eventEndAt ? new Date(data.eventEndAt as string) : null
  const prevTask = task
  const updated = await prisma.task.update({
    where: { id },
    data,
    include: { customer: true, delegatedTo: true, taskTags: { include: { tag: true } } },
  })
  if (tagIds !== undefined) {
    await prisma.taskTag.deleteMany({ where: { taskId: id } })
    if (tagIds.length > 0) {
      await prisma.taskTag.createMany({
        data: tagIds.map((tagId) => ({ taskId: id, tagId })),
        skipDuplicates: true,
      })
    }
  }
  const result =
    tagIds !== undefined
      ? await prisma.task.findFirst({
          where: { id, userId: session.user.id },
          include: { customer: true, delegatedTo: true, taskTags: { include: { tag: true } } },
        })
      : updated
  if (parsed.data.status === TaskStatus.qualified) await logTaskEvent(id, session.user.id, 'qualified')
  if (parsed.data.status === TaskStatus.done) await logTaskEvent(id, session.user.id, 'done')
  if (parsed.data.status === TaskStatus.snoozed) await logTaskEvent(id, session.user.id, 'snoozed')
  const overrideFields = [
    'durationBucket',
    'type',
    'customerId',
    'delegatedToId',
    'importance',
    'urgency',
    'dueAt',
    'nextAction',
  ] as const
  const prevTagIds = prevTask.taskTags?.map((tt) => tt.tagId).sort() ?? []
  const nextTagIds = tagIds !== undefined ? [...tagIds].sort() : prevTagIds
  const tagIdsChanged = tagIds !== undefined && JSON.stringify(prevTagIds) !== JSON.stringify(nextTagIds)
  const finalTask = result ?? updated
  const prev: Record<string, unknown> = {}
  const next: Record<string, unknown> = {}
  for (const f of overrideFields) {
    if (parsed.data[f] !== undefined) {
      const prevVal = prevTask[f as keyof typeof prevTask]
      const nextVal = finalTask[f as keyof typeof finalTask]
      if (JSON.stringify(prevVal) !== JSON.stringify(nextVal)) {
        prev[f] = prevVal instanceof Date ? prevVal.toISOString() : prevVal
        next[f] = nextVal instanceof Date ? nextVal.toISOString() : nextVal
      }
    }
  }
  if (tagIdsChanged) {
    prev.tagIds = prevTagIds
    next.tagIds = nextTagIds
  }
  if (Object.keys(prev).length > 0 || Object.keys(next).length > 0) {
    const rawText = [prevTask.title, prevTask.notes].filter(Boolean).join('\n')
    await logTaskEvent(id, session.user.id, 'overridden', {
      rawText,
      prev,
      next,
    })
  }
  return NextResponse.json(result ?? updated)
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
