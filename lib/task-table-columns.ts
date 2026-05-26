export type TaskTableColumnId =
	| 'customer'
	| 'type'
	| 'score'
	| 'deadline'
	| 'created'
	| 'completed'
	| 'duration'
	| 'tags'
	| 'delegatedTo'

export const TASK_TABLE_COLUMNS: TaskTableColumnId[] = [
	'customer',
	'type',
	'score',
	'deadline',
	'created',
	'completed',
	'duration',
	'tags',
	'delegatedTo',
]

export const TASK_TABLE_COLUMN_LABEL: Record<TaskTableColumnId, string> = {
	customer: 'Kunde',
	type: 'Type',
	score: 'Score',
	deadline: 'Deadline',
	created: 'Oprettet',
	completed: 'Afsluttet',
	duration: 'Varighed',
	tags: 'Tags',
	delegatedTo: 'Delegeret til',
}

export interface TaskTableColumnsSettings {
	order: TaskTableColumnId[]
	enabled: Partial<Record<TaskTableColumnId, boolean>>
}

export const DEFAULT_TASK_TABLE_COLUMNS_SETTINGS: TaskTableColumnsSettings = {
	// Behold nuværende defaults fra tabelvisningen (før konfiguration):
	// Kunde, Type, Score, Deadline, Varighed, Tags.
	order: [
		'customer',
		'type',
		'score',
		'deadline',
		'duration',
		'tags',
		'delegatedTo',
		'created',
		'completed',
	],
	enabled: {
		customer: true,
		type: true,
		score: true,
		deadline: true,
		duration: true,
		tags: true,
		delegatedTo: false,
		created: false,
		completed: false,
	},
}

function isColumnId(value: unknown): value is TaskTableColumnId {
	return (
		typeof value === 'string' &&
		(TASK_TABLE_COLUMNS as string[]).includes(value)
	)
}

export function normalizeTaskTableColumnsSettings(
	raw: unknown
): TaskTableColumnsSettings {
	const enabled: Partial<Record<TaskTableColumnId, boolean>> = {
		...DEFAULT_TASK_TABLE_COLUMNS_SETTINGS.enabled,
	}

	let order = [...DEFAULT_TASK_TABLE_COLUMNS_SETTINGS.order]

	if (raw && typeof raw === 'object') {
		const o = raw as Record<string, unknown>

		if (Array.isArray(o.order)) {
			const next: TaskTableColumnId[] = []
			for (const v of o.order) {
				if (!isColumnId(v)) continue
				if (next.includes(v)) continue
				next.push(v)
			}
			for (const v of TASK_TABLE_COLUMNS) {
				if (!next.includes(v)) next.push(v)
			}
			order = next
		}

		if (o.enabled && typeof o.enabled === 'object') {
			for (const id of TASK_TABLE_COLUMNS) {
				const v = (o.enabled as Record<string, unknown>)[id]
				if (typeof v === 'boolean') enabled[id] = v
			}
		}
	}

	return { order, enabled }
}

