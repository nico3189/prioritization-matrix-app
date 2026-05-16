import { computeUrgencyFromDeadline } from '@/lib/eisenhower'

export interface DeadlineUrgencyRecalcResult {
	urgency: number
	clearManualOverride: boolean
}

/**
 * Når brugeren ændrer deadline (PATCH / MCP update_task) uden samtidig at
 * sende urgency, genberegnes urgency fra den nye deadline — uanset om
 * urgency tidligere var manuelt låst.
 */
export function computeUrgencyAfterDeadlineChange(
	newDueAt: Date | null | undefined,
	options: {
		deadlineFieldSet: boolean
		urgencyFieldSet: boolean
	}
): DeadlineUrgencyRecalcResult | null {
	if (!options.deadlineFieldSet || options.urgencyFieldSet) return null
	if (newDueAt == null) return null
	return {
		urgency: Math.round(computeUrgencyFromDeadline(newDueAt)),
		clearManualOverride: true,
	}
}
