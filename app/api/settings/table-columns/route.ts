import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
	DEFAULT_TASK_TABLE_COLUMNS_SETTINGS,
	normalizeTaskTableColumnsSettings,
	TASK_TABLE_COLUMNS,
	type TaskTableColumnId,
	type TaskTableColumnsSettings,
} from '@/lib/task-table-columns'

const columnIdSchema = z.enum(TASK_TABLE_COLUMNS as [TaskTableColumnId, ...TaskTableColumnId[]])

const schema = z.object({
	order: z.array(columnIdSchema).optional(),
	enabled: z.record(z.boolean()).optional(),
})

export async function GET() {
	const session = await getServerSession(authOptions)
	if (!session?.user?.id) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
	}
	const settings = await prisma.userSettings.findUnique({
		where: { userId: session.user.id },
	})
	return NextResponse.json(
		normalizeTaskTableColumnsSettings(settings?.tableColumns)
	)
}

export async function PATCH(req: Request) {
	const session = await getServerSession(authOptions)
	if (!session?.user?.id) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
	}
	try {
		const body = await req.json()
		const parsed = schema.safeParse(body)
		if (!parsed.success) {
			return NextResponse.json(parsed.error.flatten(), { status: 400 })
		}
		const settings = await prisma.userSettings.findUnique({
			where: { userId: session.user.id },
		})
		const current = normalizeTaskTableColumnsSettings(settings?.tableColumns)
		const merged: TaskTableColumnsSettings = {
			order: parsed.data.order ?? current.order,
			enabled: { ...current.enabled },
		}
		if (parsed.data.enabled) {
			for (const id of TASK_TABLE_COLUMNS) {
				const v = (parsed.data.enabled as Record<string, unknown>)[id]
				if (typeof v === 'boolean') merged.enabled[id] = v
			}
		}
		// Ensure order contains all columns exactly once.
		const normalized = normalizeTaskTableColumnsSettings(merged)

		await prisma.userSettings.upsert({
			where: { userId: session.user.id },
			create: {
				userId: session.user.id,
				tableColumns:
					(normalized as unknown as object) ??
					(DEFAULT_TASK_TABLE_COLUMNS_SETTINGS as unknown as object),
			},
			update: {
				tableColumns: normalized as unknown as object,
			},
		})
		return NextResponse.json(normalized)
	} catch (err) {
		console.error('[PATCH /api/settings/table-columns]', err)
		return NextResponse.json(
			{ error: 'Kunne ikke gemme tabel-kolonner' },
			{ status: 500 }
		)
	}
}

