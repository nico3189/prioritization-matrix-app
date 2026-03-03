import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
	normalizePriorityFactors,
	type PriorityFactors,
} from '@/lib/priority-factors'
import type { TaskType } from '@prisma/client'

const TASK_TYPES: TaskType[] = ['kunde', 'salg', 'ledelse', 'internt']

const typeFactorsSchema = z.object({
	kunde: z.number().min(-50).max(50).optional(),
	salg: z.number().min(-50).max(50).optional(),
	ledelse: z.number().min(-50).max(50).optional(),
	internt: z.number().min(-50).max(50).optional(),
})

const keywordWeightSchema = z.object({
	terms: z.union([
		z.array(z.string()),
		z.string().transform((s) =>
			s.split(/[,;]/).map((t) => t.trim()).filter(Boolean)
		),
	]),
	importance: z.number().min(-50).max(50),
	urgency: z.number().min(-50).max(50),
})

const schema = z.object({
	typeImportance: typeFactorsSchema.optional(),
	typeUrgency: typeFactorsSchema.optional(),
	customerMultiplier: z.number().min(0).max(10).optional(),
	keywordWeights: z.array(keywordWeightSchema).optional(),
})

export async function GET() {
	const session = await getServerSession(authOptions)
	if (!session?.user?.id) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
	}
	const settings = await prisma.userSettings.findUnique({
		where: { userId: session.user.id },
	})
	const factors = normalizePriorityFactors(settings?.priorityFactors)
	return NextResponse.json(factors)
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
		const current = normalizePriorityFactors(settings?.priorityFactors)
		const merged: PriorityFactors = {
			typeImportance: { ...current.typeImportance },
			typeUrgency: { ...current.typeUrgency },
			customerMultiplier:
				parsed.data.customerMultiplier ?? current.customerMultiplier,
			keywordWeights:
				parsed.data.keywordWeights ?? current.keywordWeights,
		}
		if (parsed.data.typeImportance) {
			for (const t of TASK_TYPES) {
				const v = parsed.data.typeImportance[t as keyof typeof parsed.data.typeImportance]
				if (typeof v === 'number') merged.typeImportance[t] = v
			}
		}
		if (parsed.data.typeUrgency) {
			for (const t of TASK_TYPES) {
				const v = parsed.data.typeUrgency[t as keyof typeof parsed.data.typeUrgency]
				if (typeof v === 'number') merged.typeUrgency[t] = v
			}
		}
		await prisma.userSettings.upsert({
			where: { userId: session.user.id },
			create: {
				userId: session.user.id,
				priorityFactors: merged as unknown as object,
			},
			update: { priorityFactors: merged as unknown as object },
		})
		return NextResponse.json(merged)
	} catch (err) {
		console.error('[PATCH /api/settings/priority-factors]', err)
		return NextResponse.json(
			{ error: 'Kunne ikke gemme prioriteringsfaktorer' },
			{ status: 500 }
		)
	}
}
