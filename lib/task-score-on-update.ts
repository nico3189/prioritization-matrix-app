import { computeUrgencyFromDeadline } from '@/lib/eisenhower'

export interface TaskScoreRecalcInput {
	dueAt: Date | null
	urgencyManuallyOverriddenAt: Date | null
}

/**
 * Når deadline ændres og hastighed ikke er manuelt låst,
 * genberegn urgency fra deadline (samme logik som sync-urgency).
 */
export function urgencyForDeadlineUpdate(
	task: TaskScoreRecalcInput,
	newDueAt: Date | null | undefined,
	urgencyExplicitlySet: boolean
): number | undefined {
	if (urgencyExplicitlySet) return undefined
	if (task.urgencyManuallyOverriddenAt) return undefined
	if (newDueAt === undefined) return undefined
	if (newDueAt == null) return undefined
	return Math.round(computeUrgencyFromDeadline(newDueAt))
}
