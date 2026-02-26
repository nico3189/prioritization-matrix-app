import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().max(3).nullable().optional(),
  priority: z.number().min(0).max(10).optional(),
})
const patchSchema = createSchema.partial()

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const customers = await prisma.customer.findMany({
    where: { userId: session.user.id },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(customers)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json(parsed.error.flatten(), { status: 400 })
    const code = parsed.data.code?.trim() || null
    const priority = parsed.data.priority ?? 5
    const customer = await prisma.customer.create({
      data: {
        userId: session.user.id,
        name: parsed.data.name,
        ...(code && { code: code.toUpperCase() }),
        priority,
      },
    })
    return NextResponse.json(customer)
  } catch (err) {
    console.error('POST /api/settings/customers error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(parsed.error.flatten(), { status: 400 })
  const code = parsed.data.code !== undefined
    ? (parsed.data.code?.trim() || null)
    : undefined
  const customer = await prisma.customer.updateMany({
    where: { id, userId: session.user.id },
    data: {
      ...(parsed.data.name != null && { name: parsed.data.name }),
      ...(code !== undefined && { code: code ? code.toUpperCase() : null }),
      ...(parsed.data.priority != null && {
        priority: Math.max(0, Math.min(10, parsed.data.priority)),
      }),
    },
  })
  if (customer.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const updated = await prisma.customer.findFirst({
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
  await prisma.customer.deleteMany({
    where: { id, userId: session.user.id },
  })
  return NextResponse.json({ ok: true })
}
