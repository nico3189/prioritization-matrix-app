import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.union([z.string().length(3), z.literal('')]).optional(),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const teamMembers = await prisma.teamMember.findMany({
    where: { userId: session.user.id },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(teamMembers)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(parsed.error.flatten(), { status: 400 })
  const code = parsed.data.code?.trim() || null
  const teamMember = await prisma.teamMember.create({
    data: {
      userId: session.user.id,
      name: parsed.data.name,
      ...(code && { code: code.toUpperCase() }),
    },
  })
  return NextResponse.json(teamMember)
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const body = await req.json()
  const parsed = createSchema.partial().safeParse(body)
  if (!parsed.success) return NextResponse.json(parsed.error.flatten(), { status: 400 })
  const code = parsed.data.code !== undefined
    ? (parsed.data.code?.trim() || null)
    : undefined
  const teamMember = await prisma.teamMember.updateMany({
    where: { id, userId: session.user.id },
    data: {
      ...(parsed.data.name != null && { name: parsed.data.name }),
      ...(code !== undefined && { code: code ? code.toUpperCase() : null }),
    },
  })
  if (teamMember.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const updated = await prisma.teamMember.findFirst({
    where: { id, userId: session.user.id },
  })
  return NextResponse.json(updated)
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await prisma.teamMember.deleteMany({
    where: { id, userId: session.user.id },
  })
  return NextResponse.json({ ok: true })
}
