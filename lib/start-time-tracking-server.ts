import type { TimeTrackingSettings } from '@/lib/time-tracking-settings'
import { isTimeTrackingConfigured } from '@/lib/time-tracking-settings'

export async function startTimeTrackingOnServer(
	settings: TimeTrackingSettings,
	timeTrackingText: string
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
	if (!isTimeTrackingConfigured(settings)) {
		return { ok: false, status: 400, message: 'Tidsregistrering er ikke konfigureret' }
	}

	const url = settings.url.trim()
	const apiKey = settings.apiKey.trim()
	const userId = settings.userId!

	try {
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
			return {
				ok: false,
				status: res.status,
				message: `Tidsregistreringssystemet svarede med fejl (${res.status})`,
			}
		}

		return { ok: true }
	} catch (err) {
		console.error('[startTimeTrackingOnServer]', err)
		return {
			ok: false,
			status: 502,
			message: 'Kunne ikke kontakte tidsregistreringssystemet',
		}
	}
}
