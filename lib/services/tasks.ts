import { prisma } from '@/lib/db'
import { TaskStatus, LinkedEventType } from '@prisma/client'
import { logTaskEvent } from '@/lib/events'
import { runParseForTask } from '@/lib/parse-task'

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

export async function listTasks(/* filter */) {
	throw new Error('TODO: implementér list_tasks')
}

export async function getTask(_id: string) {
	throw new Error('TODO: implementér get_task')
}

export async function updateTask(
	_id: string,
	_fields: Partial<Record<string, unknown>>
) {
	throw new Error('TODO: implementér update_task')
}

export async function reparseTask(_id: string) {
	throw new Error('TODO: implementér reparse_task')
}

export async function completeTask(_id: string) {
	throw new Error('TODO: implementér complete_task')
}

export async function deleteTaskById(_id: string) {
	throw new Error('TODO: implementér delete_task')
}
