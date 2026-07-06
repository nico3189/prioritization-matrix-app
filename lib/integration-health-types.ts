import type { OpenAiErrorCode } from '@/lib/openai-errors'

export interface IntegrationHealthStatus {
	service: string
	healthy: boolean
	errorCode: OpenAiErrorCode | null
	message: string | null
	actionUrl: string | null
	checkedAt: string
}
