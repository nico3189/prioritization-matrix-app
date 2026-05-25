const MONTH_SHORT = [
	'jan.',
	'feb.',
	'mar.',
	'apr.',
	'maj',
	'jun.',
	'jul.',
	'aug.',
	'sep.',
	'okt.',
	'nov.',
	'dec.',
]

export function formatCalendarEventOptionLabel(
	summary: string,
	start?: string,
	end?: string
): string {
	if (!start) return summary || '(Uden titel)'
	const d = new Date(start)
	const day = d.getDate()
	const month = MONTH_SHORT[d.getMonth()]
	const h = String(d.getHours()).padStart(2, '0')
	const m = String(d.getMinutes()).padStart(2, '0')
	let range = `${h}:${m}`
	if (end) {
		const eh = String(new Date(end).getHours()).padStart(2, '0')
		const em = String(new Date(end).getMinutes()).padStart(2, '0')
		range = `${h}:${m}–${eh}:${em}`
	}
	const title = summary?.trim() || '(Uden titel)'
	return `${day}. ${month} ${range} · ${title}`
}
