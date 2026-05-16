import {
	DurationBucket,
	TaskStatus,
	TaskType,
	type Customer,
	type Task,
	type Tag,
} from '@prisma/client'

export type McpUrgencyLabel = 'akut' | 'snart' | 'normal' | 'lav'
export type McpTaskStatus = 'open' | 'done'

const URGENCY_SORT_ORDER: Record<McpUrgencyLabel, number> = {
	akut: 0,
	snart: 1,
	normal: 2,
	lav: 3,
}

const URGENCY_TO_SCORE: Record<McpUrgencyLabel, number> = {
	akut: 85,
	snart: 62,
	normal: 40,
	lav: 20,
}

export function urgencyScoreToLabel(
	urgency: number | null | undefined
): McpUrgencyLabel | null {
	if (urgency == null) return null
	if (urgency >= 75) return 'akut'
	if (urgency >= 50) return 'snart'
	if (urgency >= 25) return 'normal'
	return 'lav'
}

export function urgencyLabelToScore(label: McpUrgencyLabel): number {
	return URGENCY_TO_SCORE[label]
}

export function urgencyLabelSortKey(
	urgency: number | null | undefined
): number {
	const label = urgencyScoreToLabel(urgency)
	return label == null ? 99 : URGENCY_SORT_ORDER[label]
}

export function taskPrismaStatusToMcp(status: TaskStatus): McpTaskStatus {
	return status === TaskStatus.done ? 'done' : 'open'
}

export function durationBucketToMinutes(
	bucket: DurationBucket | null | undefined
): number | null {
	switch (bucket) {
		case DurationBucket.LT15:
			return 10
		case DurationBucket.M15_30:
			return 22
		case DurationBucket.M30_60:
			return 45
		case DurationBucket.GT60:
			return 90
		default:
			return null
	}
}

export function minutesToDurationBucket(minutes: number): DurationBucket {
	if (minutes < 15) return DurationBucket.LT15
	if (minutes < 30) return DurationBucket.M15_30
	if (minutes < 60) return DurationBucket.M30_60
	return DurationBucket.GT60
}

export function taskRawText(task: Pick<Task, 'title' | 'notes'>): string {
	return [task.title, task.notes].filter(Boolean).join('\n')
}

export function resolveTaskType(value: string): TaskType | null {
	const q = value.trim().toLowerCase()
	const match = (Object.values(TaskType) as TaskType[]).find(
		(t) => t.toLowerCase() === q
	)
	return match ?? null
}

export type TaskWithRelations = Task & {
	customer?: Customer | null
	taskTags?: { tag: Tag }[]
	events?: { createdAt: Date }[]
}

export function getCompletedAt(
	task: TaskWithRelations
): string | null {
	const at = task.events?.[0]?.createdAt
	return at ? at.toISOString() : null
}

export interface McpTaskListItem {
	id: string
	title: string | null
	urgency: McpUrgencyLabel | null
	type: string | null
	customer: string | null
	deadline: string | null
	status: McpTaskStatus
	duration: number | null
	createdAt: string
}

export function toMcpListItem(task: TaskWithRelations): McpTaskListItem {
	return {
		id: task.id,
		title: task.title,
		urgency: urgencyScoreToLabel(task.urgency),
		type: task.type,
		customer: task.customer?.name ?? null,
		deadline: task.dueAt?.toISOString() ?? null,
		status: taskPrismaStatusToMcp(task.status),
		duration: durationBucketToMinutes(task.durationBucket),
		createdAt: task.createdAt.toISOString(),
	}
}

export interface McpTaskDetail extends McpTaskListItem {
	rawText: string
	notes: string | null
	importance: number | null
	urgencyScore: number | null
	durationBucket: DurationBucket | null
	customerId: string | null
	delegatedToId: string | null
	canDelegate: boolean
	nextAction: string | null
	parseStatus: string | null
	url: string | null
	links: string[]
	tag: string | null
	tags: string[]
	linkedEventId: string | null
	linkedEventTitle: string | null
	linkedEventUrl: string | null
	eventStartAt: string | null
	eventEndAt: string | null
	recurrenceRule: string | null
	completedAt: string | null
	updatedAt: string
	prismaStatus: TaskStatus
}

export function toMcpTaskDetail(task: TaskWithRelations): McpTaskDetail {
	const links = task.url ? [task.url] : []
	const tags =
		task.taskTags?.map((tt) => tt.tag.name) ??
		(task.tag ? task.tag.split(',').map((t) => t.trim()).filter(Boolean) : [])

	return {
		...toMcpListItem(task),
		rawText: taskRawText(task),
		notes: task.notes,
		importance: task.importance,
		urgencyScore: task.urgency,
		durationBucket: task.durationBucket,
		customerId: task.customerId,
		delegatedToId: task.delegatedToId,
		canDelegate: task.canDelegate,
		nextAction: task.nextAction,
		parseStatus: task.parseStatus,
		url: task.url,
		links,
		tag: task.tag,
		tags,
		linkedEventId: task.linkedEventId,
		linkedEventTitle: task.linkedEventTitle,
		linkedEventUrl: task.linkedEventUrl,
		eventStartAt: task.eventStartAt?.toISOString() ?? null,
		eventEndAt: task.eventEndAt?.toISOString() ?? null,
		recurrenceRule: task.recurrenceRule,
		completedAt: getCompletedAt(task),
		updatedAt: task.updatedAt.toISOString(),
		prismaStatus: task.status,
	}
}

export function formatGetTaskSummary(task: McpTaskDetail): string {
	const parts: string[] = []
	if (task.urgency) parts.push(task.urgency)
	if (task.type) parts.push(task.type)
	if (task.customer) parts.push(`kunde: ${task.customer}`)
	const paren = parts.length > 0 ? ` (${parts.join(', ')})` : ''
	const lines = [`"${task.title}"${paren}`]
	const meta: string[] = []
	if (task.deadline) {
		meta.push(`Deadline: ${task.deadline.slice(0, 10)}`)
	}
	if (task.duration != null) {
		meta.push(`Varighed: ${task.duration} min`)
	}
	meta.push(`Status: ${task.status}`)
	lines.push(`${meta.join('. ')}.`)
	if (task.links.length > 0) {
		lines.push(`Links: ${task.links.length} stk.`)
	}
	return lines.join('\n')
}

export function formatListTasksSummary(
	items: McpTaskListItem[],
	statusFilter: 'open' | 'done' | 'all'
): string {
	if (items.length === 0) return 'Ingen opgaver matcher dine filtre.'

	const statusWord =
		statusFilter === 'done'
			? 'færdige'
			: statusFilter === 'all'
				? ''
				: 'åbne'
	const header = statusWord
		? `Fundet ${items.length} ${statusWord} opgaver. Top 5:`
		: `Fundet ${items.length} opgaver. Top 5:`

	const top = items.slice(0, 5)
	const lines = top.map((t, i) => {
		const urg = t.urgency ? `[${t.urgency}] ` : ''
		const cust = t.customer ? ` (${t.customer})` : ''
		const dl = t.deadline ? ` — deadline ${t.deadline.slice(0, 10)}` : ''
		return `${i + 1}. ${urg}${t.title ?? '(uden titel)'}${dl}${cust}`
	})

	return [header, ...lines].join('\n')
}

export function mcpToolResult(summary: string, data: unknown) {
	return {
		content: [
			{ type: 'text' as const, text: summary },
			{ type: 'text' as const, text: JSON.stringify(data, null, 2) },
		],
	}
}
