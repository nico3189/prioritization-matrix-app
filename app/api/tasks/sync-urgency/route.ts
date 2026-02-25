import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { runSyncUrgency } from '@/lib/sync-urgency'

/**
 * POST /api/tasks/sync-urgency
 * Opdaterer hastegrad for den indloggede brugers opgaver med deadline (on-demand).
 * Bruges af "Opdater nu"-knap; samme logik som cron, men kun egne opgaver.
 */
export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { updated, total } = await runSyncUrgency(session.user.id)
  return NextResponse.json({ ok: true, updated, total })
}
