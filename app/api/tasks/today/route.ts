import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { TaskStatus } from '@prisma/client'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id
  const tasks = await prisma.task.findMany({
    where: {
      userId,
      status: { in: [TaskStatus.qualified, TaskStatus.needs_clarification] },
    },
    include: {
      customer: true,
      delegatedTo: true,
      taskTags: { include: { tag: true } },
    },
    orderBy: [{ createdAt: 'desc' }],
  })
  return NextResponse.json(tasks)
}
