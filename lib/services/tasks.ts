import { prisma } from '@/lib/db'
import { TaskStatus, LinkedEventType, type Prisma } from '@prisma/client'
import { logTaskEvent } from '@/lib/events'
import { runParseForTask } from '@/lib/parse-task'
import {
	type McpUrgencyLabel,
	minutesToDurationBucket,
	resolveTaskType,
	toMcpListItem,
	toMcpTaskDetail,
	urgencyLabelSortKey,
	urgencyLabelToScore,
	type McpTaskListItem,
	type McpTaskDetail,
} from '@/lib/services/mcp-task-utils'
import {
	addTagToTaskRecord,
	getTaskTagNames,
	normalizeTagNames,
	removeTagFromTaskRecord,
	replaceTaskTags,
	tagsFieldChanged,
} from '@/lib/services/task-tags'
import { resolveCustomerMatch } from '@/lib/resolve-customer'
import { urgencyForDeadlineUpdate } from '@/lib/task-score-on-update'

export interface CreateTaskInput {
	rawText: string
	linkedEventId?: string
	linkedEventType?: LinkedEventType
	linkedEventTitle?: string
	linkedEventUrl?: string | null
	dueAt?: string
	eventStartAt?: string
	eventEndAt?: string
}

export interface ListTasksInput {
	status?: 'open' | 'done' | 'all'
	urgency?: McpUrgencyLabel
	type?: string
	customer?: string
	search?: string
	deadlineBefore?: string
	limit?: number
}

export interface UpdateTaskFields {
	title?: string
	urgency?: McpUrgencyLabel
	type?: string
	customer?: string
	deadline?: string | null
	duration?: number | null
	links?: string[]
	notes?: string
	tags?: string[]
}

const taskIncludeList = {
	customer: true,
	events: {
		where: { eventType: 'done' as const },
		orderBy: { createdAt: 'desc' as const },
		take: 1,
		select: { createdAt: true },
	},
} satisfies Prisma.TaskInclude

const taskIncludeDetail = {
	customer: true,
	delegatedTo: true,
	taskTags: { include: { tag: true } },
	events: {
		where: { eventType: 'done' as const },
		orderBy: { createdAt: 'desc' as const },
		take: 1,
		select: { createdAt: true },
	},
} satisfies Prisma.TaskInclude

async function findTaskForUser(taskId: string, userId: string) {
	return prisma.task.findFirst({
		where: { id: taskId, userId },
		include: taskIncludeDetail,
	})
}

export async function createTaskFromRawText(
	input: CreateTaskInput,
	userId: string
) {
	const title =
		input.rawText.trim().split(/\n/)[0] || input.rawText.slice(0, 200)
	const task = await prisma.task.create({
		data: {
			userId,
			title,
			notes:
				input.rawText.length > 500
					? input.rawText.slice(0, 2000)
					: input.rawText,
			status: TaskStatus.inbox_raw,
			parseStatus: 'pending',
			...(input.linkedEventId && { linkedEventId: input.linkedEventId }),
			...(input.linkedEventType && {
				linkedEventType: input.linkedEventType,
			}),
			...(input.linkedEventTitle && {
				linkedEventTitle: input.linkedEventTitle,
			}),
			...(input.linkedEventUrl != null && {
				linkedEventUrl: input.linkedEventUrl || null,
			}),
			...(input.dueAt && { dueAt: new Date(input.dueAt) }),
			...(input.eventStartAt && {
				eventStartAt: new Date(input.eventStartAt),
			}),
			...(input.eventEndAt && { eventEndAt: new Date(input.eventEndAt) }),
		},
		include: { customer: true, delegatedTo: true },
	})
	await logTaskEvent(task.id, userId, 'created')
	runParseForTask(task.id, userId).catch((err) =>
		console.error('[createTaskFromRawText] background parse failed:', err)
	)
	return task
}

export async function listTasks(
	input: ListTasksInput,
	userId: string
): Promise<McpTaskListItem[]> {
	const statusFilter = input.status ?? 'open'
	const limit = Math.min(input.limit ?? 50, 200)

	const where: Prisma.TaskWhereInput = { userId }

	if (statusFilter === 'open') {
		where.status = { not: TaskStatus.done }
	} else if (statusFilter === 'done') {
		where.status = TaskStatus.done
	}

	if (input.type?.trim()) {
		const resolved = resolveTaskType(input.type)
		if (!resolved) return []
		where.type = resolved
	}

	if (input.customer?.trim()) {
		where.customer = {
			name: { equals: input.customer.trim(), mode: 'insensitive' },
		}
	}

	if (input.deadlineBefore) {
		where.dueAt = {
			lte: new Date(input.deadlineBefore),
			not: null,
		}
	}

	if (input.search?.trim()) {
		const q = input.search.trim()
		where.OR = [
			{ title: { contains: q, mode: 'insensitive' } },
			{ notes: { contains: q, mode: 'insensitive' } },
		]
	}

	const rows = await prisma.task.findMany({
		where,
		include: taskIncludeList,
		take: 500,
	})

	let items = rows.map((t) => toMcpListItem(t))

	if (input.urgency) {
		items = items.filter((t) => t.urgency === input.urgency)
	}

	const urgencyById = new Map(rows.map((r) => [r.id, r.urgency]))
	items.sort((a, b) => {
		const statusA = a.status === 'open' ? 0 : 1
		const statusB = b.status === 'open' ? 0 : 1
		if (statusA !== statusB) return statusA - statusB

		const urgA = urgencyLabelSortKey(urgencyById.get(a.id))
		const urgB = urgencyLabelSortKey(urgencyById.get(b.id))
		if (urgA !== urgB) return urgA - urgB

		const dlA = a.deadline ? new Date(a.deadline).getTime() : Infinity
		const dlB = b.deadline ? new Date(b.deadline).getTime() : Infinity
		if (dlA !== dlB) return dlA - dlB

		return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
	})

	return items.slice(0, limit)
}

export async function getTask(
	id: string,
	userId: string
): Promise<McpTaskDetail> {
	const task = await findTaskForUser(id, userId)
	if (!task) throw new Error(`Task not found: ${id}`)
	return toMcpTaskDetail(task)
}

export async function updateTask(
	id: string,
	fields: UpdateTaskFields,
	userId: string
): Promise<{ detail: McpTaskDetail; changedFields: string[] }> {
	const defined = Object.entries(fields).filter(
		([, v]) => v !== undefined
	)
	if (defined.length === 0) {
		throw new Error('Ingen felter angivet til opdatering')
	}

	const task = await findTaskForUser(id, userId)
	if (!task) throw new Error(`Task not found: ${id}`)

	const data: Prisma.TaskUpdateInput = {}
	const changedFields: string[] = []

	if (fields.title !== undefined && fields.title !== task.title) {
		data.title = fields.title
		changedFields.push('title')
	}

	if (fields.notes !== undefined && fields.notes !== task.notes) {
		data.notes = fields.notes
		changedFields.push('notes')
	}

	if (fields.urgency !== undefined) {
		const next = urgencyLabelToScore(fields.urgency)
		if (next !== task.urgency) {
			data.urgency = next
			data.urgencyManuallyOverriddenAt = new Date()
			changedFields.push('urgency')
		}
	}

	if (fields.type !== undefined) {
		const resolved =
			fields.type === null || fields.type === ''
				? null
				: resolveTaskType(fields.type)
		if (fields.type && !resolved) {
			throw new Error(`Ukendt opgavetype: ${fields.type}`)
		}
		const next = resolved
		if (next !== task.type) {
			data.type = next
			changedFields.push('type')
		}
	}

	if (fields.customer !== undefined) {
		let customerId: string | null = null
		if (fields.customer) {
			const customers = await prisma.customer.findMany({
				where: { userId },
				select: { id: true, name: true, code: true },
			})
			const match = resolveCustomerMatch(fields.customer, customers)
			if (!match) {
				throw new Error(`Kunde ikke fundet: ${fields.customer}`)
			}
			customerId = match.id
		}
		if (customerId !== task.customerId) {
			data.customer = customerId
				? { connect: { id: customerId } }
				: { disconnect: true }
			changedFields.push('customer')
		}
	}

	if (fields.deadline !== undefined) {
		const next = fields.deadline ? new Date(fields.deadline) : null
		const prev = task.dueAt?.getTime() ?? null
		const nextMs = next?.getTime() ?? null
		if (prev !== nextMs) {
			data.dueAt = next
			changedFields.push('deadline')
		}
	}

	if (fields.duration !== undefined) {
		const next =
			fields.duration == null
				? null
				: minutesToDurationBucket(fields.duration)
		if (next !== task.durationBucket) {
			data.durationBucket = next
			changedFields.push('duration')
		}
	}

	if (fields.links !== undefined) {
		const next = fields.links.length > 0 ? fields.links[0] : null
		if (next !== task.url) {
			data.url = next
			changedFields.push('links')
		}
	}

	if (fields.tags !== undefined) {
		const prev = getTaskTagNames(task)
		const next = normalizeTagNames(fields.tags)
		if (tagsFieldChanged(prev, next)) {
			await replaceTaskTags(id, userId, next)
			changedFields.push('tags')
		}
	}

	const newDueAt =
		fields.deadline !== undefined
			? fields.deadline
				? new Date(fields.deadline)
				: null
			: undefined
	const autoUrgency = urgencyForDeadlineUpdate(
		{
			dueAt: task.dueAt,
			urgencyManuallyOverriddenAt: task.urgencyManuallyOverriddenAt,
		},
		newDueAt,
		fields.urgency !== undefined
	)
	if (autoUrgency !== undefined && autoUrgency !== task.urgency) {
		data.urgency = autoUrgency
		if (!changedFields.includes('deadline') && fields.deadline !== undefined) {
			changedFields.push('deadline')
		}
		if (!changedFields.includes('urgency')) {
			changedFields.push('urgency')
		}
	}

	if (changedFields.length === 0) {
		return { detail: toMcpTaskDetail(task), changedFields: [] }
	}

	if (Object.keys(data).length > 0) {
		await prisma.task.update({
			where: { id },
			data,
		})
	}

	const updated = await findTaskForUser(id, userId)
	if (!updated) throw new Error(`Task not found: ${id}`)
	return { detail: toMcpTaskDetail(updated), changedFields }
}

export async function completeTask(
	id: string,
	userId: string
): Promise<McpTaskDetail> {
	const task = await findTaskForUser(id, userId)
	if (!task) throw new Error(`Task not found: ${id}`)
	if (task.status === TaskStatus.done) {
		throw new Error('Opgaven er allerede markeret færdig')
	}

	await prisma.task.update({
		where: { id },
		data: { status: TaskStatus.done },
	})
	await logTaskEvent(id, userId, 'done')

	const updated = await findTaskForUser(id, userId)
	if (!updated) throw new Error(`Task not found: ${id}`)
	return toMcpTaskDetail(updated)
}

export async function addTagToTask(
	id: string,
	tag: string,
	userId: string
): Promise<{ detail: McpTaskDetail; message: string }> {
	const task = await findTaskForUser(id, userId)
	if (!task) throw new Error(`Task not found: ${id}`)

	const result = await addTagToTaskRecord(id, userId, task, tag)
	const updated = await findTaskForUser(id, userId)
	if (!updated) throw new Error(`Task not found: ${id}`)
	return { detail: toMcpTaskDetail(updated), message: result.message }
}

export async function removeTagFromTask(
	id: string,
	tag: string,
	userId: string
): Promise<{ detail: McpTaskDetail; message: string }> {
	const task = await findTaskForUser(id, userId)
	if (!task) throw new Error(`Task not found: ${id}`)

	const result = await removeTagFromTaskRecord(id, task, tag)
	const updated = await findTaskForUser(id, userId)
	if (!updated) throw new Error(`Task not found: ${id}`)
	return { detail: toMcpTaskDetail(updated), message: result.message }
}

export async function reparseTask(_id: string) {
	throw new Error('TODO: implementér reparse_task')
}

export async function deleteTaskById(_id: string) {
	throw new Error('TODO: implementér delete_task')
}
