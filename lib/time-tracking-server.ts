import type { TimeTrackingSettings } from '@/lib/time-tracking-settings'
import { isTimeTrackingConfigured } from '@/lib/time-tracking-settings'

export async function startTimeTrackingOnServer(
	settings: TimeTrackingSettings,
	timeTrackingText: string
): Promise<void> {
	if (!isTimeTrackingConfigured(settings)) {
		throw new Error('Tidsregistrering er ikke konfigureret')
	}

	const url = settings.url.trim()
	const apiKey = settings.apiKey.trim()
	const userId = settings.userId!

	const res = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-Apikey': apiKey,
		},
		body: JSON.stringify({
			userId,
			timeTrackingText: timeTrackingText.trim(),
		}),
	})

	if (!res.ok) {
		const body = await res.text().catch(() => '')
		console.error(
			'[time-tracking] upstream error',
			res.status,
			body.slice(0, 500)
		)
		throw new Error(`Kunne ikke starte tidsregistrering (${res.status})`)
	}
}
