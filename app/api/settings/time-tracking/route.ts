import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
	normalizeTimeTrackingSettings,
	type TimeTrackingSettings,
} from '@/lib/time-tracking-settings'

const schema = z.object({
	url: z.string().max(2000).optional(),
	apiKey: z.string().max(2000).optional(),
	userId: z.number().int().positive().nullable().optional(),
})

export async function GET() {
	const session = await getServerSession(authOptions)
	if (!session?.user?.id) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
	}
	const settings = await prisma.userSettings.findUnique({
		where: { userId: session.user.id },
	})
	return NextResponse.json(
		normalizeTimeTrackingSettings(settings?.timeTracking)
	)
}

export async function PATCH(req: Request) {
	const session = await getServerSession(authOptions)
	if (!session?.user?.id) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
	}
	try {
		const body = await req.json()
		const parsed = schema.safeParse(body)
		if (!parsed.success) {
			return NextResponse.json(parsed.error.flatten(), { status: 400 })
		}
		const row = await prisma.userSettings.findUnique({
			where: { userId: session.user.id },
		})
		const current = normalizeTimeTrackingSettings(row?.timeTracking)
		const merged: TimeTrackingSettings = {
			url: parsed.data.url !== undefined ? parsed.data.url.trim() : current.url,
			apiKey:
				parsed.data.apiKey !== undefined
					? parsed.data.apiKey
					: current.apiKey,
			userId:
				parsed.data.userId !== undefined
					? parsed.data.userId
					: current.userId,
		}
		await prisma.userSettings.upsert({
			where: { userId: session.user.id },
			create: {
				userId: session.user.id,
				timeTracking: merged as unknown as object,
			},
			update: { timeTracking: merged as unknown as object },
		})
		return NextResponse.json(merged)
	} catch (err) {
		console.error('[PATCH /api/settings/time-tracking]', err)
		return NextResponse.json(
			{ error: 'Kunne ikke gemme tidsregistrering' },
			{ status: 500 }
		)
	}
}
