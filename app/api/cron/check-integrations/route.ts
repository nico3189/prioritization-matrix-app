import { NextResponse } from 'next/server'
import { probeOpenAiHealth } from '@/lib/integration-health'

/**
 * POST /api/cron/check-integrations
 * Daglig health-check af eksterne integrationer (OpenAI).
 * Kræver header: x-cron-secret: <CRON_SECRET>
 */
export async function POST(req: Request) {
	const secret = req.headers.get('x-cron-secret')
	if (secret !== process.env.CRON_SECRET) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
	}

	const openai = await probeOpenAiHealth()
	return NextResponse.json({
		ok: openai.healthy,
		openai,
	})
}
