import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { TaskStatus } from '@prisma/client'
import { getScoreWithDueBonus } from '@/lib/eisenhower'

const NOW = new Date()
const IN_48H = new Date(NOW.getTime() + 48 * 60 * 60 * 1000)

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id
  const dueSoon = await prisma.task.findMany({
    where: {
      userId,
      status: { in: [TaskStatus.qualified, TaskStatus.needs_clarification] },
      dueAt: { gte: NOW, lte: IN_48H },
    },
    include: { customer: true, delegatedTo: true },
    orderBy: { dueAt: 'asc' },
  })
  const rest = await prisma.task.findMany({
    where: {
      userId,
      status: { in: [TaskStatus.qualified, TaskStatus.needs_clarification] },
      OR: [{ dueAt: null }, { dueAt: { gt: IN_48H } }],
    },
    include: { customer: true, delegatedTo: true },
  })
  const withScore = rest.map((t) => {
    const imp = t.importance ?? 0
    const urg = t.urgency ?? 0
    return {
      ...t,
      _score: getScoreWithDueBonus(imp, urg, t.dueAt),
      _q: imp >= 60 && urg >= 60 ? 'Q1' : imp >= 60 && urg < 60 ? 'Q2' : imp < 60 && urg >= 60 ? 'Q3' : 'Q4',
    }
  })
  const q1 = withScore.filter((t) => t._q === 'Q1').sort((a, b) => b._score - a._score).slice(0, 2)
  const q2 = withScore.filter((t) => t._q === 'Q2').sort((a, b) => b._score - a._score).slice(0, 2)
  const combined = [...dueSoon, ...q1, ...q2]
  const deduped = combined.filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i)
  const top5 = deduped.slice(0, 5)
  const tasks = top5.map((item) => {
    const { _score, _q, ...t } = item as typeof item & { _score?: number; _q?: string }
    return t
  })
  return NextResponse.json(tasks)
}
