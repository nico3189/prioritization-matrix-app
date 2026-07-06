import { APIError } from 'openai'

export type OpenAiErrorCode =
	| 'missing_key'
	| 'invalid_key'
	| 'insufficient_quota'
	| 'rate_limit'
	| 'server_error'
	| 'unknown'

export interface ClassifiedOpenAiError {
	code: OpenAiErrorCode
	message: string
	actionUrl?: string
}

const BILLING_URL =
	'https://platform.openai.com/settings/organization/billing'

function isQuotaError(err: APIError): boolean {
	const code = err.code ?? ''
	const text = `${err.message} ${JSON.stringify(err.error ?? '')}`.toLowerCase()
	return (
		code === 'insufficient_quota' ||
		text.includes('insufficient_quota') ||
		text.includes('exceeded your current quota') ||
		text.includes('credit balance') ||
		text.includes('billing')
	)
}

export function classifyOpenAiError(err: unknown): ClassifiedOpenAiError {
	if (err instanceof APIError) {
		if (err.status === 401) {
			return {
				code: 'invalid_key',
				message:
					'OpenAI API-nøglen er ugyldig. Tjek OPENAI_API_KEY i Heroku Config Vars.',
			}
		}
		if (isQuotaError(err)) {
			return {
				code: 'insufficient_quota',
				message:
					'OpenAI-kredit er brugt op. AI-parse virker ikke, før der er tilføjet kredit.',
				actionUrl: BILLING_URL,
			}
		}
		if (err.status === 429) {
			return {
				code: 'rate_limit',
				message:
					'OpenAI rate limit nået. Prøv igen om et øjeblik.',
			}
		}
		if (err.status != null && err.status >= 500) {
			return {
				code: 'server_error',
				message:
					'OpenAI-serveren svarer ikke lige nu. Prøv igen senere.',
			}
		}
		if (err.message) {
			return { code: 'unknown', message: err.message }
		}
	}

	if (err instanceof Error) {
		const lower = err.message.toLowerCase()
		if (lower.includes('openai_api_key er ikke sat')) {
			return {
				code: 'missing_key',
				message: err.message,
			}
		}
		if (
			lower.includes('insufficient_quota') ||
			lower.includes('credit balance') ||
			lower.includes('billing')
		) {
			return {
				code: 'insufficient_quota',
				message:
					'OpenAI-kredit er brugt op. AI-parse virker ikke, før der er tilføjet kredit.',
				actionUrl: BILLING_URL,
			}
		}
		return { code: 'unknown', message: err.message }
	}

	return {
		code: 'unknown',
		message: 'Ukendt fejl ved kontakt til OpenAI.',
	}
}
