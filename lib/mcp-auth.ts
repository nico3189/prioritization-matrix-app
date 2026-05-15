import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import { getUserIdFromApiKey } from '@/lib/api-key'

/**
 * Validerer Bearer-token fra en MCP-request.
 * Samme scheme som POST /api/tasks (pm_-nøgler hashet i ApiKey-tabellen).
 */
export async function verifyMcpBearer(
	_bearerToken?: string
): Promise<AuthInfo | undefined> {
	if (!_bearerToken?.trim()) return undefined
	const userId = await getUserIdFromApiKey(_bearerToken)
	if (!userId) return undefined
	return {
		token: _bearerToken,
		clientId: userId,
		scopes: [],
		extra: { userId },
	}
}

export function getUserIdFromAuthInfo(
	authInfo: AuthInfo | undefined
): string {
	const userId = (authInfo?.extra as { userId?: string } | undefined)?.userId
	if (!userId) throw new Error('Unauthorized')
	return userId
}
