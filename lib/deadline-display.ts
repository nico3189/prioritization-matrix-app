export type DeadlineUrgency =
	| 'normal'
	| '72h'
	| '48h'
	| '24h'
	| 'today'
	| '4h'
	| 'overdue'

function isSameCalendarDay(a: Date, b: Date): boolean {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	)
}

export function getDeadlineUrgency(
	dueAt: string | Date | null | undefined
): DeadlineUrgency {
	if (!dueAt) return 'normal'
	const due = typeof dueAt === 'string' ? new Date(dueAt) : dueAt
	const now = new Date()
	const hoursUntil = (due.getTime() - now.getTime()) / (1000 * 60 * 60)
	if (hoursUntil < 0) return 'overdue'
	if (isSameCalendarDay(due, now)) return 'today'
	if (hoursUntil <= 4) return '4h'
	if (hoursUntil <= 24) return '24h'
	if (hoursUntil <= 48) return '48h'
	if (hoursUntil <= 72) return '72h'
	return 'normal'
}

export function getDeadlineStyles(urgency: DeadlineUrgency): string {
	switch (urgency) {
		case 'overdue':
			return 'text-red-400 font-bold'
		case '4h':
			return 'text-amber-400 font-medium'
		case 'today':
			return 'text-amber-400'
		case '24h':
			return 'text-amber-400'
		case '48h':
			return 'text-amber-400'
		case '72h':
			return 'text-slate-100'
		default:
			return ''
	}
}
