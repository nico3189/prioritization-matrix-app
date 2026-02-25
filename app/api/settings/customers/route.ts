import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const createSchema = z.object({ name: z.string().min(1).max(200) })

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
  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(parsed.error.flatten(), { status: 400 })
  const customer = await prisma.customer.create({
    data: { userId: session.user.id, name: parsed.data.name },
  })
  return NextResponse.json(customer)
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
