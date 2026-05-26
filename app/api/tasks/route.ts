import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUserIdFromApiKey } from '@/lib/api-key'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { TaskStatus } from '@prisma/client'
import { createTaskFromRawText } from '@/lib/services/tasks'
import { computeDeadlineConflict } from '@/lib/deadline-conflict'

const createSchema = z.object({
  rawText: z.string().min(1).max(10000),
  linkedEventId: z.string().optional(),
  linkedEventType: z.enum(['prep', 'followup']).optional(),
  linkedEventTitle: z.string().max(500).optional(),
  linkedEventUrl: z.string().max(2000).optional().nullable(),
  dueAt: z.string().datetime().optional(),
  eventStartAt: z.string().datetime().optional(),
  eventEndAt: z.string().datetime().optional(),
})

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const view = searchParams.get('view') // inbox | matrix | clarify
  const status = searchParams.get('status')
  const userId = session.user.id
  try {
    const where: Record<string, unknown> = { userId }
    if (status) where.status = status
    const isClarify = view === 'clarify'
    if (isClarify) {
      // Hent bredere og filtrér i JS, så vi kan inkludere deadline-konflikter.
      where.status = { in: [TaskStatus.inbox_raw, TaskStatus.needs_clarification, TaskStatus.qualified] }
    }
    if (view === 'udvikling') {
      where.status = TaskStatus.udvikling
    }
    if (view === 'matrix') where.status = { in: [TaskStatus.qualified, TaskStatus.needs_clarification] }
    const tasks = await prisma.task.findMany({
      where,
      include: {
        customer: true,
        delegatedTo: true,
        taskTags: { include: { tag: true } },
        dependencies: {
          include: {
            dependsOnTask: { select: { id: true, status: true, dueAt: true } },
          },
        },
        events: {
          where: { eventType: 'done' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    })
    const mapped = tasks.map(({ events, dependencies, ...t }) => {
      const incompleteDeps = dependencies.some(
        (d) => d.dependsOnTask.status !== TaskStatus.done
      )
      const isLocked = incompleteDeps && !t.lockOverride
      const conflict = computeDeadlineConflict({
        taskDueAt: t.dueAt,
        prereqDueAts: dependencies.map((d) => d.dependsOnTask.dueAt),
      })
      return {
        ...t,
        dependencies,
        isLocked,
        deadlineConflict: conflict.deadlineConflict,
        latestPrereqDueAt: conflict.latestPrereqDueAt,
        completedAt: events[0]?.createdAt ?? null,
      }
    })
    if (!isClarify) return NextResponse.json(mapped)

    const now = Date.now()
    const clarify = mapped.filter((t) => {
      if (t.status === TaskStatus.inbox_raw || t.status === TaskStatus.needs_clarification) return true
      if (t.status !== TaskStatus.qualified) return false
      const overdue = t.dueAt ? new Date(t.dueAt as unknown as string).getTime() < now : false
      return overdue || Boolean((t as { deadlineConflict?: boolean }).deadlineConflict)
    })
    return NextResponse.json(clarify)
  } catch (err) {
    console.error('[GET /api/tasks]', err)
    return NextResponse.json(
      { error: 'Kunne ikke hente opgaver' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  let userId: string | null = null
  const session = await getServerSession(authOptions)
  if (session?.user?.id) {
    userId = session.user.id
  } else {
    const auth = req.headers.get('authorization')
    const bearer = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null
    if (bearer) userId = await getUserIdFromApiKey(bearer)
  }
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json(parsed.error.flatten(), { status: 400 })
    const task = await createTaskFromRawText(
      {
        rawText: parsed.data.rawText,
        linkedEventId: parsed.data.linkedEventId,
        linkedEventType: parsed.data.linkedEventType,
        linkedEventTitle: parsed.data.linkedEventTitle,
        linkedEventUrl: parsed.data.linkedEventUrl,
        dueAt: parsed.data.dueAt,
        eventStartAt: parsed.data.eventStartAt,
        eventEndAt: parsed.data.eventEndAt,
      },
      userId
    )
    return NextResponse.json(task)
  } catch (err) {
    console.error('[POST /api/tasks]', err)
    const message = err instanceof Error ? err.message : 'Kunne ikke oprette opgave'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
