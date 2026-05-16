import { prisma } from '@/lib/db'
import { TaskStatus } from '@prisma/client'
import { google } from 'googleapis'
import type { Task } from '@prisma/client'

const RECURRENCE_RULES = ['DAILY', 'WEEKLY', 'MONTHLY'] as const
export type RecurrenceRule = (typeof RECURRENCE_RULES)[number]

/**
 * Beregner næste dueAt baseret på anchor-dato og gentagelsesregel.
 */
export function computeNextDueAt(
	anchor: Date,
	rule: RecurrenceRule
): Date {
	const next = new Date(anchor)
	switch (rule) {
		case 'DAILY':
			next.setDate(next.getDate() + 1)
			break
		case 'WEEKLY':
			next.setDate(next.getDate() + 7)
			break
		case 'MONTHLY': {
			next.setMonth(next.getMonth() + 1)
			// Håndter 31. jan → 28. feb: Date ruller automatisk til 28.
			if (next.getDate() !== anchor.getDate()) {
				next.setDate(0) // Sidste dag i forrige måned
			}
			break
		}
		default:
			return anchor
	}
	return next
}

interface CalendarEvent {
	id: string
	summary: string
	start: string
	end: string
	htmlLink: string | null
}

/**
 * Henter events fra Google Calendar og finder det bedste match:
 * - Samme kalenderdag som nextDueAt
 * - Inden for ±2 timer af nextDueAt
 * - Titel ligner linkedEventTitle (identisk eller indeholder nøgleord)
 */
async function findMatchingCalendarEvent(
	nextDueAt: Date,
	linkedEventTitle: string,
	accessToken: string
): Promise<CalendarEvent | null> {
	const TWO_HOURS_MS = 2 * 60 * 60 * 1000

	// Samme dag ± 2 timer: begræns vinduet til samme kalenderdag
	const startOfDay = new Date(nextDueAt)
	startOfDay.setUTCHours(0, 0, 0, 0)
	const endOfDay = new Date(nextDueAt)
	endOfDay.setUTCHours(23, 59, 59, 999)

	const timeMin = new Date(Math.max(startOfDay.getTime(), nextDueAt.getTime() - TWO_HOURS_MS))
	const timeMax = new Date(Math.min(endOfDay.getTime(), nextDueAt.getTime() + TWO_HOURS_MS))

	const oauth2Client = new google.auth.OAuth2()
	oauth2Client.setCredentials({ access_token: accessToken })
	const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

	const res = await calendar.events.list({
		calendarId: 'primary',
		timeMin: timeMin.toISOString(),
		timeMax: timeMax.toISOString(),
		singleEvents: true,
		orderBy: 'startTime',
		eventTypes: ['default'],
	})

	const items = res.data.items ?? []
	const refLower = linkedEventTitle.toLowerCase().trim()
	const keywords = refLower.split(/\s+/).filter((w) => w.length >= 2).slice(0, 3)

	for (const e of items) {
		const summary = (e.summary ?? '').trim()
		if (!summary) continue

		const startStr = e.start?.dateTime ?? e.start?.date
		if (!startStr) continue

		const eventStart = new Date(startStr)
		const diffMs = Math.abs(eventStart.getTime() - nextDueAt.getTime())
		if (diffMs > TWO_HOURS_MS) continue

		const summaryLower = summary.toLowerCase()
		const titleMatch =
			summaryLower === refLower ||
			summaryLower.includes(refLower) ||
			refLower.includes(summaryLower) ||
			keywords.some((kw) => summaryLower.includes(kw))

		if (!titleMatch) continue

		return {
			id: e.id!,
			summary,
			start: startStr,
			end: (e.end?.dateTime ?? e.end?.date) ?? startStr,
			htmlLink: e.htmlLink ?? null,
		}
	}
	return null
}

/**
 * Opretter næste opgave i en gentagende serie. Hvis task har kalenderlink,
 * forsøges auto-match mod Google Calendar (samme dag ± 2 timer).
 */
export async function spawnRecurringNext(
	task: Task & { taskTags?: { tagId: string }[] },
	accessToken: string | null
): Promise<Awaited<ReturnType<typeof prisma.task.create>> | null> {
	const rule = task.recurrenceRule as RecurrenceRule | null
	if (!rule || !RECURRENCE_RULES.includes(rule)) return null

	const anchor = task.dueAt ?? task.createdAt
	const nextDueAt = computeNextDueAt(anchor, rule)

	let linkedEventId: string | null = null
	let linkedEventTitle: string | null = null
	let linkedEventUrl: string | null = null
	let eventStartAt: Date | null = null
	let eventEndAt: Date | null = null

	const hasCalendarRef =
		task.linkedEventId && task.linkedEventTitle && task.eventStartAt

	if (hasCalendarRef && accessToken) {
		try {
			const match = await findMatchingCalendarEvent(
				nextDueAt,
				task.linkedEventTitle!,
				accessToken
			)
			if (match) {
				linkedEventId = match.id
				linkedEventTitle = match.summary
				linkedEventUrl = match.htmlLink
				eventStartAt = new Date(match.start)
				eventEndAt = new Date(match.end)
			}
		} catch (err) {
			console.error('[recurrence] Calendar match failed:', err)
		}
	}

	const tagIds = task.taskTags?.map((tt) => tt.tagId) ?? []

	return prisma.$transaction(async (tx) => {
		await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`recur:${task.id}`}))`

		const existing = await tx.task.findFirst({
			where: {
				userId: task.userId,
				recurrenceRule: rule,
				title: task.title,
				dueAt: nextDueAt,
				status: {
					in: [TaskStatus.qualified, TaskStatus.needs_clarification],
				},
			},
		})
		if (existing) {
			return tx.task.findUniqueOrThrow({
				where: { id: existing.id },
				include: {
					customer: true,
					delegatedTo: true,
					taskTags: { include: { tag: true } },
				},
			})
		}

		return tx.task.create({
		data: {
			userId: task.userId,
			title: task.title,
			notes: task.notes,
			durationBucket: task.durationBucket,
			type: task.type,
			customerId: task.customerId,
			importance: task.importance,
			urgency: task.urgency,
			nextAction: task.nextAction,
			tag: task.tag,
			recurrenceRule: task.recurrenceRule,
			dueAt: nextDueAt,
			status: TaskStatus.qualified,
			parseStatus: 'parsed',
			linkedEventId,
			linkedEventTitle,
			linkedEventUrl,
			eventStartAt,
			eventEndAt,
			...(tagIds.length > 0 && {
				taskTags: {
					create: tagIds.map((tagId) => ({ tagId })),
				},
			}),
		},
			include: {
				customer: true,
				delegatedTo: true,
				taskTags: { include: { tag: true } },
			},
		})
	})
}
