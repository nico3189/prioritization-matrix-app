import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { getAllIntegrationHealth } from '@/lib/integration-health'

export async function GET() {
	const session = await getServerSession(authOptions)
	if (!session?.user?.id) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
	}

	const integrations = await getAllIntegrationHealth()
	return NextResponse.json({ integrations })
}
