import type { TaskStatus } from '@prisma/client'

export interface DeadlineConflictResult {
	deadlineConflict: boolean
	latestPrereqDueAt: string | null
}

export function computeDeadlineConflict(args: {
	taskDueAt: Date | string | null | undefined
	prereqDueAts: Array<Date | string | null | undefined>
}): DeadlineConflictResult {
	const taskDue =
		typeof args.taskDueAt === 'string'
			? new Date(args.taskDueAt)
			: args.taskDueAt ?? null
	if (!taskDue) return { deadlineConflict: false, latestPrereqDueAt: null }

	const prereqDates = args.prereqDueAts
		.map((d) => (typeof d === 'string' ? new Date(d) : d ?? null))
		.filter((d): d is Date => Boolean(d && !isNaN(d.getTime())))
	if (prereqDates.length === 0) {
		return { deadlineConflict: false, latestPrereqDueAt: null }
	}

	const latest = prereqDates.reduce(
		(max, d) => (d.getTime() > max.getTime() ? d : max),
		prereqDates[0]
	)
	const deadlineConflict = taskDue.getTime() < latest.getTime()
	return {
		deadlineConflict,
		latestPrereqDueAt: latest.toISOString(),
	}
}

export function computeIsLocked(args: {
	lockOverride: boolean
	dependencies: Array<{ dependsOnTask: { status: TaskStatus; dueAt?: Date | null } }>
}): boolean {
	const incompleteDeps = args.dependencies.some(
		(d) => d.dependsOnTask.status !== ('done' as TaskStatus)
	)
	return incompleteDeps && !args.lockOverride
}

