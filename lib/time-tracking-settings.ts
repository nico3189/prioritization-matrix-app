export interface TimeTrackingSettings {
	url: string
	apiKey: string
	userId: number | null
}

export const EMPTY_TIME_TRACKING_SETTINGS: TimeTrackingSettings = {
	url: '',
	apiKey: '',
	userId: null,
}

export function normalizeTimeTrackingSettings(
	raw: unknown
): TimeTrackingSettings {
	if (!raw || typeof raw !== 'object') {
		return { ...EMPTY_TIME_TRACKING_SETTINGS }
	}
	const o = raw as Record<string, unknown>
	const url = typeof o.url === 'string' ? o.url.trim() : ''
	const apiKey = typeof o.apiKey === 'string' ? o.apiKey : ''
	let userId: number | null = null
	if (typeof o.userId === 'number' && Number.isFinite(o.userId)) {
		userId = Math.trunc(o.userId)
	} else if (typeof o.userId === 'string' && o.userId.trim() !== '') {
		const parsed = Number.parseInt(o.userId, 10)
		if (Number.isFinite(parsed)) userId = parsed
	}
	return { url, apiKey, userId }
}

export function isTimeTrackingConfigured(
	settings: TimeTrackingSettings
): boolean {
	return (
		settings.url.trim().length > 0 &&
		settings.apiKey.trim().length > 0 &&
		settings.userId != null &&
		settings.userId > 0
	)
}

export function buildTimeTrackingText(
	typeLabel: string,
	title: string
): string {
	const label = typeLabel.trim()
	const t = title.trim()
	if (!label) return t
	if (!t) return label
	return `${label} - ${t}`
}
