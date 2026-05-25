import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
	accessTokenNeedsRefresh,
	refreshGoogleAccessToken,
} from '@/lib/google-access-token'

/**
 * Gyldigt Google access-token til API-kald (kalender m.m.).
 * Fornyer ved behov — også når expiresAt mangler eller token er udløbet.
 */
export async function getGoogleAccessToken(): Promise<string | null> {
	const session = await getServerSession(authOptions)
	if (!session?.user?.id) return null

	const refreshToken = session.refreshToken
	let accessToken = session.accessToken

	if (
		accessTokenNeedsRefresh(accessToken, session.expiresAt) &&
		refreshToken
	) {
		const refreshed = await refreshGoogleAccessToken(refreshToken)
		if (refreshed) accessToken = refreshed.accessToken
	}

	return accessToken ?? null
}
