import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const TAG_COLORS = [
  '#8B5CF6', // violet
  '#10B981', // emerald
  '#F59E0B', // amber
  '#0EA5E9', // sky
  '#EC4899', // rose
]

function randomColor(): string {
  return TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)]
}

const createSchema = z.object({
  name: z.string().min(1).max(100).transform((s) => s.trim()),
  color: z.string().max(7).optional(),
})
const patchSchema = z.object({
  name: z.string().min(1).max(100).transform((s) => s.trim()).optional(),
  color: z.string().max(7).optional(),
  isBlacklisted: z.boolean().optional(),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const tags = await prisma.tag.findMany({
    where: { userId: session.user.id },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(tags)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json(parsed.error.flatten(), { status: 400 })
    const name = parsed.data.name
    const color = parsed.data.color ?? randomColor()
    const existing = await prisma.tag.findFirst({
      where: {
        userId: session.user.id,
        name: { equals: name, mode: 'insensitive' },
      },
    })
    if (existing) return NextResponse.json(existing)
    const tag = await prisma.tag.create({
      data: {
        userId: session.user.id,
        name,
        color,
      },
    })
    return NextResponse.json(tag)
  } catch (err) {
    console.error('POST /api/settings/tags error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Ukendt fejl' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Manglende id' }, { status: 400 })
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(parsed.error.flatten(), { status: 400 })
  const updated = await prisma.tag.updateMany({
    where: { id, userId: session.user.id },
    data: {
      ...(parsed.data.name != null && { name: parsed.data.name }),
      ...(parsed.data.color != null && { color: parsed.data.color }),
      ...(parsed.data.isBlacklisted !== undefined && { isBlacklisted: parsed.data.isBlacklisted }),
    },
  })
  if (updated.count === 0) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 })
  const tag = await prisma.tag.findFirst({
    where: { id, userId: session.user.id },
  })
  return NextResponse.json(tag)
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Manglende id' }, { status: 400 })
  await prisma.tag.deleteMany({
    where: { id, userId: session.user.id },
  })
  return NextResponse.json({ ok: true })
}
