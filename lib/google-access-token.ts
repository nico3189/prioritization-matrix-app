/** Buffer før udløb — forny token tidligt så kalender ikke fejler ved første load. */
const REFRESH_BUFFER_MS = 5 * 60 * 1000

export function accessTokenNeedsRefresh(
	accessToken: string | undefined,
	expiresAt: number | undefined
): boolean {
	if (!accessToken) return true
	if (!expiresAt) return true
	return Date.now() >= expiresAt - REFRESH_BUFFER_MS
}

export async function refreshGoogleAccessToken(
	refreshToken: string
): Promise<{ accessToken: string; expiresAt: number } | null> {
	const res = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			client_id: process.env.GOOGLE_CLIENT_ID!,
			client_secret: process.env.GOOGLE_CLIENT_SECRET!,
			grant_type: 'refresh_token',
			refresh_token: refreshToken,
		}),
	})
	if (!res.ok) {
		console.error('[google] Token refresh failed:', res.status, await res.text())
		return null
	}
	const data = (await res.json()) as {
		access_token?: string
		expires_in?: number
	}
	if (!data.access_token) return null
	return {
		accessToken: data.access_token,
		expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
	}
}
