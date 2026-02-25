import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { TaskStatus } from '@prisma/client'
import { logTaskEvent } from '@/lib/events'

const createSchema = z.object({
  rawText: z.string().min(1).max(10000),
  linkedEventId: z.string().optional(),
  linkedEventType: z.enum(['prep', 'followup']).optional(),
  dueAt: z.string().datetime().optional(),
  reviewAt: z.string().datetime().optional(),
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
  const where: Record<string, unknown> = { userId }
  if (status) where.status = status
  if (view === 'clarify') {
    where.status = { in: [TaskStatus.inbox_raw, TaskStatus.needs_clarification] }
  }
  if (view === 'matrix') where.status = { in: [TaskStatus.qualified, TaskStatus.needs_clarification] }
  const tasks = await prisma.task.findMany({
    where,
    include: { customer: true, delegatedTo: true },
    orderBy: [{ createdAt: 'desc' }],
  })
  return NextResponse.json(tasks)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(parsed.error.flatten(), { status: 400 })
  const title = parsed.data.rawText.trim().split(/\n/)[0] || parsed.data.rawText.slice(0, 200)
  const task = await prisma.task.create({
    data: {
      userId: session.user.id,
      title,
      notes: parsed.data.rawText.length > 500 ? parsed.data.rawText.slice(0, 2000) : parsed.data.rawText,
      status: TaskStatus.inbox_raw,
      ...(parsed.data.linkedEventId && { linkedEventId: parsed.data.linkedEventId }),
      ...(parsed.data.linkedEventType && { linkedEventType: parsed.data.linkedEventType }),
      ...(parsed.data.dueAt && { dueAt: new Date(parsed.data.dueAt) }),
      ...(parsed.data.reviewAt && { reviewAt: new Date(parsed.data.reviewAt) }),
      ...(parsed.data.eventStartAt && { eventStartAt: new Date(parsed.data.eventStartAt) }),
      ...(parsed.data.eventEndAt && { eventEndAt: new Date(parsed.data.eventEndAt) }),
    },
    include: { customer: true, delegatedTo: true },
  })
  await logTaskEvent(task.id, session.user.id, 'created')
  return NextResponse.json(task)
}
