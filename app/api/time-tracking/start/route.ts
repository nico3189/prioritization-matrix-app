import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { normalizeTimeTrackingSettings } from '@/lib/time-tracking-settings'
import { startTimeTrackingOnServer } from '@/lib/time-tracking-server'

const schema = z.object({
	timeTrackingText: z.string().min(1).max(500),
})

export async function POST(req: Request) {
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
		const settings = normalizeTimeTrackingSettings(row?.timeTracking)

		await startTimeTrackingOnServer(
			settings,
			parsed.data.timeTrackingText
		)

		return NextResponse.json({ ok: true })
	} catch (err) {
		const message =
			err instanceof Error
				? err.message
				: 'Kunne ikke starte tidsregistrering'
		const status = message.includes('ikke konfigureret') ? 400 : 502
		console.error('[POST /api/time-tracking/start]', err)
		return NextResponse.json({ error: message }, { status })
	}
}
