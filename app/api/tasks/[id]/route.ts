import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { TaskStatus, DurationBucket, TaskType, LinkedEventType } from '@prisma/client'
import { logTaskEvent } from '@/lib/events'
import { spawnRecurringNext } from '@/lib/recurrence'
import { urgencyForDeadlineUpdate } from '@/lib/task-score-on-update'

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
  recurrenceRule: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).optional().nullable(),
  /** Sæt til null for at låse værdien op – AI kan derefter ændre den igen */
  importanceManuallyOverriddenAt: z.null().optional(),
  urgencyManuallyOverriddenAt: z.null().optional(),
  /** Sæt til true for at låse værdien – AI vil ikke ændre den */
  lockImportance: z.boolean().optional(),
  lockUrgency: z.boolean().optional(),
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
  if (data.recurrenceRule !== undefined) data.recurrenceRule = data.recurrenceRule || null
  const prevTask = task
  if (parsed.data.importance !== undefined) {
    const prevImp = prevTask.importance ?? null
    const nextImp = parsed.data.importance
    if (prevImp !== nextImp) data.importanceManuallyOverriddenAt = new Date()
  }
  if (parsed.data.urgency !== undefined) {
    const prevUrg = prevTask.urgency ?? null
    const nextUrg = parsed.data.urgency
    if (prevUrg !== nextUrg) data.urgencyManuallyOverriddenAt = new Date()
  }
  if (parsed.data.importanceManuallyOverriddenAt === null) {
    data.importanceManuallyOverriddenAt = null
  }
  if (parsed.data.urgencyManuallyOverriddenAt === null) {
    data.urgencyManuallyOverriddenAt = null
  }
  if (parsed.data.lockImportance === true) {
    data.importanceManuallyOverriddenAt = new Date()
  }
  if (parsed.data.lockUrgency === true) {
    data.urgencyManuallyOverriddenAt = new Date()
  }
  if (parsed.data.lockImportance !== undefined) delete (data as Record<string, unknown>).lockImportance
  if (parsed.data.lockUrgency !== undefined) delete (data as Record<string, unknown>).lockUrgency
  const newDueAt =
    parsed.data.dueAt !== undefined
      ? (data.dueAt as Date | null)
      : undefined
  const autoUrgency = urgencyForDeadlineUpdate(
    {
      dueAt: prevTask.dueAt,
      urgencyManuallyOverriddenAt: prevTask.urgencyManuallyOverriddenAt,
    },
    newDueAt,
    parsed.data.urgency !== undefined
  )
  if (autoUrgency !== undefined) {
    data.urgency = autoUrgency
  }
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
  let spawnedTask: { id: string; dueAt: string } | null = null
  if (parsed.data.status === TaskStatus.done) {
    await logTaskEvent(id, session.user.id, 'done')
    const taskToSpawn = result ?? updated
    if (taskToSpawn.recurrenceRule) {
      const accessToken = (session as { accessToken?: string }).accessToken ?? null
      const nextTask = await spawnRecurringNext(
        { ...taskToSpawn, taskTags: taskToSpawn.taskTags?.map((tt) => ({ tagId: tt.tagId })) ?? [] },
        accessToken
      )
      if (nextTask) {
        spawnedTask = {
          id: nextTask.id,
          dueAt: nextTask.dueAt?.toISOString() ?? '',
        }
      }
    }
  }
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
  const response = result ?? updated
  const json = spawnedTask
    ? { ...response, spawnedTask }
    : response
  return NextResponse.json(json)
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
