import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { generateApiKey } from '@/lib/api-key'
import { z } from 'zod'

const createSchema = z.object({ name: z.string().min(1).max(100).trim() })
const deleteSchema = z.object({ id: z.string().cuid() })

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const keys = await prisma.apiKey.findMany({
    where: { userId: session.user.id },
    select: { id: true, name: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(keys)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json(parsed.error.flatten(), { status: 400 })
    const { key, keyHash } = generateApiKey()
    await prisma.apiKey.create({
      data: {
        userId: session.user.id,
        name: parsed.data.name,
        keyHash,
      },
    })
    return NextResponse.json({ key, message: 'Kopier nøglen nu – den vises kun én gang.' })
  } catch (err) {
    console.error('[POST /api/settings/api-keys]', err)
    return NextResponse.json(
      { error: 'Kunne ikke oprette API-nøgle' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { searchParams } = new URL(req.url)
    const parsed = deleteSchema.safeParse({ id: searchParams.get('id') })
    if (!parsed.success) return NextResponse.json({ error: 'Ugyldigt id' }, { status: 400 })
    await prisma.apiKey.deleteMany({
      where: { id: parsed.data.id, userId: session.user.id },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/settings/api-keys]', err)
    return NextResponse.json(
      { error: 'Kunne ikke slette API-nøgle' },
      { status: 500 }
    )
  }
}
