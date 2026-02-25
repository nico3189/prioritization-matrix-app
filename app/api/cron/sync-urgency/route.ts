import { NextResponse } from 'next/server'
import { runSyncUrgency } from '@/lib/sync-urgency'

/**
 * POST /api/cron/sync-urgency
 * Kaldes hver time af Heroku Scheduler. Kræver header: x-cron-secret: <CRON_SECRET>
 */
export async function POST(req: Request) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { updated, total } = await runSyncUrgency()
  return NextResponse.json({ ok: true, updated, total })
}
