import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
	normalizeTaskVisualCue,
	type TaskVisualCueSettings,
	isValidHexColor,
	TASK_TYPES,
} from '@/lib/task-visual-cue'
import type { TaskType } from '@prisma/client'

const hexColorSchema = z
	.string()
	.refine(isValidHexColor, { message: 'Ugyldig hex-farve' })

const colorsSchema = z
	.object({
		kunde: hexColorSchema.optional(),
		salg: hexColorSchema.optional(),
		ledelse: hexColorSchema.optional(),
		internt: hexColorSchema.optional(),
	})
	.optional()

const schema = z.object({
	enabled: z.boolean().optional(),
	colors: colorsSchema,
})

export async function GET() {
	const session = await getServerSession(authOptions)
	if (!session?.user?.id) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
	}
	const settings = await prisma.userSettings.findUnique({
		where: { userId: session.user.id },
	})
	return NextResponse.json(normalizeTaskVisualCue(settings?.visualCue))
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
		const current = normalizeTaskVisualCue(settings?.visualCue)
		const merged: TaskVisualCueSettings = {
			enabled: parsed.data.enabled ?? current.enabled,
			colors: { ...current.colors },
		}
		if (parsed.data.colors) {
			for (const t of TASK_TYPES) {
				const v = parsed.data.colors[t as TaskType]
				if (v) merged.colors[t] = v
			}
		}
		await prisma.userSettings.upsert({
			where: { userId: session.user.id },
			create: {
				userId: session.user.id,
				visualCue: merged as unknown as object,
			},
			update: { visualCue: merged as unknown as object },
		})
		return NextResponse.json(merged)
	} catch (err) {
		console.error('[PATCH /api/settings/visual-cue]', err)
		return NextResponse.json(
			{ error: 'Kunne ikke gemme opgavefarver' },
			{ status: 500 }
		)
	}
}
