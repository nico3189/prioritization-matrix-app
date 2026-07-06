import OpenAI from 'openai'
import { prisma } from '@/lib/db'
import {
	classifyOpenAiError,
	type OpenAiErrorCode,
} from '@/lib/openai-errors'
import type { IntegrationHealthStatus } from '@/lib/integration-health-types'

export const OPENAI_SERVICE = 'openai'

export type { IntegrationHealthStatus } from '@/lib/integration-health-types'

function billingUrlForCode(code: OpenAiErrorCode | null): string | null {
	if (code === 'insufficient_quota') {
		return 'https://platform.openai.com/settings/organization/billing'
	}
	return null
}

function toStatus(row: {
	service: string
	healthy: boolean
	errorCode: string | null
	message: string | null
	checkedAt: Date
}): IntegrationHealthStatus {
	const code = row.errorCode as OpenAiErrorCode | null
	return {
		service: row.service,
		healthy: row.healthy,
		errorCode: code,
		message: row.message,
		actionUrl: row.healthy ? null : billingUrlForCode(code),
		checkedAt: row.checkedAt.toISOString(),
	}
}

export async function recordIntegrationHealth(
	service: string,
	healthy: boolean,
	errorCode?: OpenAiErrorCode,
	message?: string
): Promise<void> {
	await prisma.integrationHealth.upsert({
		where: { service },
		create: {
			service,
			healthy,
			errorCode: errorCode ?? null,
			message: message ?? null,
			checkedAt: new Date(),
		},
		update: {
			healthy,
			errorCode: healthy ? null : (errorCode ?? null),
			message: healthy ? null : (message ?? null),
			checkedAt: new Date(),
		},
	})
}

export async function getIntegrationHealth(
	service: string
): Promise<IntegrationHealthStatus | null> {
	const row = await prisma.integrationHealth.findUnique({
		where: { service },
	})
	if (!row) return null
	return toStatus(row)
}

export async function getAllIntegrationHealth(): Promise<
	IntegrationHealthStatus[]
> {
	const rows = await prisma.integrationHealth.findMany({
		orderBy: { service: 'asc' },
	})
	return rows.map(toStatus)
}

export async function probeOpenAiHealth(): Promise<IntegrationHealthStatus> {
	const apiKey = process.env.OPENAI_API_KEY
	if (!apiKey?.trim()) {
		const message =
			'OPENAI_API_KEY er ikke sat. Tilføj den i .env (lokalt) eller Heroku Config Vars.'
		await recordIntegrationHealth(
			OPENAI_SERVICE,
			false,
			'missing_key',
			message
		)
		return {
			service: OPENAI_SERVICE,
			healthy: false,
			errorCode: 'missing_key',
			message,
			actionUrl: null,
			checkedAt: new Date().toISOString(),
		}
	}

	try {
		const openai = new OpenAI({ apiKey })
		await openai.chat.completions.create({
			model: 'gpt-4o-mini',
			messages: [{ role: 'user', content: 'ok' }],
			max_tokens: 1,
		})
		await recordIntegrationHealth(OPENAI_SERVICE, true)
		return {
			service: OPENAI_SERVICE,
			healthy: true,
			errorCode: null,
			message: null,
			actionUrl: null,
			checkedAt: new Date().toISOString(),
		}
	} catch (err) {
		const classified = classifyOpenAiError(err)
		await recordIntegrationHealth(
			OPENAI_SERVICE,
			false,
			classified.code,
			classified.message
		)
		return {
			service: OPENAI_SERVICE,
			healthy: false,
			errorCode: classified.code,
			message: classified.message,
			actionUrl: classified.actionUrl ?? null,
			checkedAt: new Date().toISOString(),
		}
	}
}
