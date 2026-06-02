import type { TimeTrackingSettings } from '@/lib/time-tracking-settings'

export async function startTimeTracking(
	settings: TimeTrackingSettings,
	timeTrackingText: string
): Promise<void> {
	const url = settings.url.trim()
	const apiKey = settings.apiKey.trim()
	const userId = settings.userId
	if (!url || !apiKey || userId == null) {
		throw new Error('Tidsregistrering er ikke konfigureret')
	}

	const res = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-Apikey': apiKey,
		},
		body: JSON.stringify({
			userId,
			timeTrackingText,
		}),
	})

	if (!res.ok) {
		throw new Error(`Kunne ikke starte tidsregistrering (${res.status})`)
	}
}
