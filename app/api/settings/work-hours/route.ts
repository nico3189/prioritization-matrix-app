import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const daySchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
})
const workHoursSchema = z.object({
  mon: daySchema.optional().nullable(),
  tue: daySchema.optional().nullable(),
  wed: daySchema.optional().nullable(),
  thu: daySchema.optional().nullable(),
  fri: daySchema.optional().nullable(),
  sat: daySchema.optional().nullable(),
  sun: daySchema.optional().nullable(),
})

const defaultWorkHours = Object.fromEntries(
  DAYS.map((d) => [d, { start: '08:00', end: '16:00' }])
) as Record<(typeof DAYS)[number], { start: string; end: string }>

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const settings = await prisma.userSettings.findUnique({
    where: { userId: session.user.id },
  })
  const workHours = (settings?.workHours as Record<string, unknown> | null) ?? defaultWorkHours
  return NextResponse.json(workHours)
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const parsed = workHoursSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json(parsed.error.flatten(), { status: 400 })
    const workHours = parsed.data as Record<string, { start: string; end: string } | null>
    const merged: Record<string, { start: string; end: string } | null> = {}
    for (const d of DAYS) {
      if (workHours[d] === null) {
        merged[d] = null
      } else if (workHours[d]?.start && workHours[d]?.end) {
        merged[d] = workHours[d]!
      } else {
        merged[d] = defaultWorkHours[d as keyof typeof defaultWorkHours]
      }
    }
    await prisma.userSettings.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, workHours: merged },
      update: { workHours: merged },
    })
    return NextResponse.json(merged)
  } catch (err) {
    console.error('[PATCH /api/settings/work-hours]', err)
    return NextResponse.json(
      { error: 'Kunne ikke gemme arbejdstider' },
      { status: 500 }
    )
  }
}
