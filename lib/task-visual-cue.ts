import type { CSSProperties } from 'react'
import type { TaskType } from '@prisma/client'

export const TASK_TYPES: TaskType[] = ['kunde', 'salg', 'ledelse', 'internt']

export const TYPE_LABELS: Record<TaskType, string> = {
	kunde: 'Kunde',
	salg: 'Salg',
	ledelse: 'Ledelse',
	internt: 'Internt',
}

export const DEFAULT_TYPE_COLORS: Record<TaskType, string> = {
	kunde: '#3B82F6',
	internt: '#22C55E',
	salg: '#F59E0B',
	ledelse: '#8B5CF6',
}

export const TASK_TYPE_STRIPE_WIDTH_PX = 4

export interface TaskVisualCueSettings {
	enabled: boolean
	colors: Record<TaskType, string>
}

const HEX_RE = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/

export function isValidHexColor(value: string): boolean {
	return HEX_RE.test(value.trim())
}

export function normalizeTaskVisualCue(raw: unknown): TaskVisualCueSettings {
	const colors = { ...DEFAULT_TYPE_COLORS }
	let enabled = true

	if (raw && typeof raw === 'object') {
		const o = raw as Record<string, unknown>
		if (typeof o.enabled === 'boolean') enabled = o.enabled
		if (o.colors && typeof o.colors === 'object') {
			for (const t of TASK_TYPES) {
				const v = (o.colors as Record<string, unknown>)[t]
				if (typeof v === 'string' && isValidHexColor(v)) {
					colors[t] = v.trim()
				}
			}
		}
	}

	return { enabled, colors }
}

export function resolveTaskTypeStripeColor(
	type: string | null | undefined,
	settings: TaskVisualCueSettings
): string | null {
	if (!settings.enabled || !type) return null
	if (!TASK_TYPES.includes(type as TaskType)) return null
	return settings.colors[type as TaskType] ?? null
}

export function taskTypeStripeStyle(
	color: string | null
): CSSProperties | undefined {
	if (!color) return undefined
	return {
		borderLeftWidth: TASK_TYPE_STRIPE_WIDTH_PX,
		borderLeftStyle: 'solid',
		borderLeftColor: color,
	}
}
