import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { TaskStatus } from '@prisma/client'
import { getScore } from '@/lib/eisenhower'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id
  const all = await prisma.task.findMany({
    where: {
      userId,
      status: { in: [TaskStatus.qualified, TaskStatus.needs_clarification] },
    },
    include: { customer: true, delegatedTo: true },
  })
  const withScore = all.map((t) => {
    const imp = t.importance ?? 0
    const urg = t.urgency ?? 0
    return { ...t, _score: getScore(imp, urg) }
  })
  const sorted = withScore.sort((a, b) => b._score - a._score)
  const top9 = sorted.slice(0, 9)
  const tasks = top9.map((item, i) => {
    const { _score, ...t } = item as typeof item & { _score?: number }
    const greyedOutLevel = i < 3 ? undefined : i < 6 ? 'subtle' : 'strong'
    return { ...t, greyedOutLevel }
  })
  return NextResponse.json(tasks)
}
