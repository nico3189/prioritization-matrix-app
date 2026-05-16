import { prisma } from '@/lib/db'

const TAG_COLORS = ['#8B5CF6', '#10B981', '#F59E0B', '#0EA5E9', '#EC4899']

type TaskWithTagRelations = {
	tag?: string | null
	taskTags?: { tag: { id: string; name: string } }[]
}

/** Trim, drop tomme, dedupe case-insensitive (bevarer første forekomsts casing). */
export function normalizeTagNames(names: string[]): string[] {
	const seen = new Set<string>()
	const result: string[] = []
	for (const raw of names) {
		const trimmed = raw.trim()
		if (!trimmed) continue
		const key = trimmed.toLowerCase()
		if (seen.has(key)) continue
		seen.add(key)
		result.push(trimmed)
	}
	return result
}

export function getTaskTagNames(task: TaskWithTagRelations): string[] {
	if (task.taskTags && task.taskTags.length > 0) {
		return task.taskTags.map((tt) => tt.tag.name)
	}
	if (task.tag) {
		return task.tag
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean)
	}
	return []
}

function tagListsEqual(a: string[], b: string[]): boolean {
	const norm = (arr: string[]) =>
		[...arr].map((s) => s.toLowerCase()).sort().join('\0')
	return norm(a) === norm(b)
}

export async function findOrCreateTagForUser(
	userId: string,
	name: string
): Promise<string> {
	const trimmed = name.trim()
	if (!trimmed) throw new Error('Tom tag-værdi')

	const existing = await prisma.tag.findFirst({
		where: { userId, name: { equals: trimmed, mode: 'insensitive' } },
	})
	if (existing) return existing.id

	const color = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)]
	const tag = await prisma.tag.create({
		data: { userId, name: trimmed, color },
	})
	return tag.id
}

async function syncTaskTagString(
	taskId: string,
	tagNames: string[]
): Promise<void> {
	await prisma.task.update({
		where: { id: taskId },
		data: {
			tag:
				tagNames.length > 0 ? tagNames.slice(0, 4).join(', ') : null,
		},
	})
}

/** Erstat alle tags på en opgave (tom liste = fjern alle). */
export async function replaceTaskTags(
	taskId: string,
	userId: string,
	tagNames: string[]
): Promise<boolean> {
	const normalized = normalizeTagNames(tagNames)
	const tagIds: string[] = []
	for (const name of normalized) {
		tagIds.push(await findOrCreateTagForUser(userId, name))
	}

	await prisma.taskTag.deleteMany({ where: { taskId } })
	if (tagIds.length > 0) {
		await prisma.taskTag.createMany({
			data: tagIds.map((tagId) => ({ taskId, tagId })),
			skipDuplicates: true,
		})
	}
	await syncTaskTagString(taskId, normalized)
	return true
}

export function findTagOnTask(
	task: TaskWithTagRelations,
	tagName: string
): { tagId: string | null; name: string } | null {
	const key = tagName.trim().toLowerCase()
	if (!key) return null

	const fromRelation = task.taskTags?.find(
		(tt) => tt.tag.name.toLowerCase() === key
	)
	if (fromRelation) {
		return { tagId: fromRelation.tag.id, name: fromRelation.tag.name }
	}

	const fromString = getTaskTagNames(task).find(
		(n) => n.toLowerCase() === key
	)
	if (fromString) {
		return { tagId: null, name: fromString }
	}
	return null
}

export async function addTagToTaskRecord(
	taskId: string,
	userId: string,
	task: TaskWithTagRelations,
	tagName: string
): Promise<{ changed: boolean; message: string }> {
	const trimmed = tagName.trim()
	if (!trimmed) throw new Error('Tom tag-værdi')

	const existing = findTagOnTask(task, trimmed)
	if (existing) {
		return {
			changed: false,
			message: `Tag "${existing.name}" var allerede på opgaven`,
		}
	}

	const tagId = await findOrCreateTagForUser(userId, trimmed)
	await prisma.taskTag.create({
		data: { taskId, tagId },
	})

	const nextNames = [...getTaskTagNames(task), trimmed]
	await syncTaskTagString(taskId, normalizeTagNames(nextNames))

	return {
		changed: true,
		message: `Tilføjet tag: ${trimmed}`,
	}
}

export async function removeTagFromTaskRecord(
	taskId: string,
	task: TaskWithTagRelations,
	tagName: string
): Promise<{ changed: boolean; message: string }> {
	const trimmed = tagName.trim()
	if (!trimmed) throw new Error('Tom tag-værdi')

	const key = trimmed.toLowerCase()
	const match = findTagOnTask(task, trimmed)

	if (!match) {
		return {
			changed: false,
			message: `Tag "${trimmed}" var ikke på opgaven`,
		}
	}

	if (match.tagId) {
		await prisma.taskTag.delete({
			where: { taskId_tagId: { taskId, tagId: match.tagId } },
		})
	}

	const nextNames = getTaskTagNames(task).filter(
		(n) => n.toLowerCase() !== key
	)
	await syncTaskTagString(taskId, nextNames)

	return {
		changed: true,
		message: `Fjernet tag: ${match.name}`,
	}
}

export function tagsFieldChanged(
	prev: string[],
	next: string[]
): boolean {
	return !tagListsEqual(prev, next)
}
