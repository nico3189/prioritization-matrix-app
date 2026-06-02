export async function startTimeTracking(
	timeTrackingText: string
): Promise<void> {
	const res = await fetch('/api/time-tracking/start', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ timeTrackingText }),
	})

	const data = (await res.json().catch(() => ({}))) as { error?: string }
	if (!res.ok) {
		throw new Error(data.error ?? `Kunne ikke starte tidsregistrering (${res.status})`)
	}
}
