import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { runParseForTask } from '@/lib/parse-task'

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

  try {
    await runParseForTask(id, session.user.id)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ukendt fejl'
    return NextResponse.json(
      {
        error: 'AI kunne ikke kvalificere opgaven',
        code: 'PARSE_FAILED',
        detail: message,
      },
      { status: 503 }
    )
  }

  const updated = await prisma.task.findFirst({
    where: { id, userId: session.user.id },
    include: { customer: true, delegatedTo: true, taskTags: { include: { tag: true } } },
  })
  return NextResponse.json(updated)
}
