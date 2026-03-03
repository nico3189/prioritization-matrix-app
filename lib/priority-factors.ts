import type { TaskType } from '@prisma/client'

const TASK_TYPES: TaskType[] = ['kunde', 'salg', 'ledelse', 'internt']

export interface KeywordWeight {
	terms: string[]
	importance: number
	urgency: number
}

export interface PriorityFactors {
	typeImportance: Record<TaskType, number>
	typeUrgency: Record<TaskType, number>
	customerMultiplier: number
	keywordWeights: KeywordWeight[]
}

export const DEFAULT_PRIORITY_FACTORS: PriorityFactors = {
	typeImportance: { kunde: 15, salg: 10, ledelse: 5, internt: 0 },
	typeUrgency: { kunde: 12, salg: 8, ledelse: 4, internt: 0 },
	customerMultiplier: 2,
	keywordWeights: [],
}

/**
 * Beregner importance- og urgency-offset fra keywords i rawText.
 * Hvis rawText indeholder et af ordene i en keyword-gruppe, lægges værdierne til.
 */
export function getKeywordOffsets(
	rawText: string,
	keywordWeights: KeywordWeight[]
): { importance: number; urgency: number } {
	if (!rawText?.trim() || !keywordWeights?.length) {
		return { importance: 0, urgency: 0 }
	}
	const textLower = rawText.toLowerCase()
	let importance = 0
	let urgency = 0
	for (const kw of keywordWeights) {
		const terms = kw.terms?.filter((t) => t.trim().length > 0) ?? []
		if (terms.length === 0) continue
		const matches = terms.some((t) =>
			textLower.includes(t.trim().toLowerCase())
		)
		if (matches) {
			importance += kw.importance ?? 0
			urgency += kw.urgency ?? 0
		}
	}
	return { importance, urgency }
}

function isRecordOfNumbers(
	val: unknown
): val is Record<string, number> {
	if (!val || typeof val !== 'object') return false
	for (const v of Object.values(val)) {
		if (typeof v !== 'number') return false
	}
	return true
}

/**
 * Normaliserer rå JSON fra DB til PriorityFactors med defaults for manglende felter.
 */
export function normalizePriorityFactors(
	raw: unknown
): PriorityFactors {
	if (!raw || typeof raw !== 'object') {
		return DEFAULT_PRIORITY_FACTORS
	}
	const obj = raw as Record<string, unknown>
	const typeImportance: Record<TaskType, number> = {
		...DEFAULT_PRIORITY_FACTORS.typeImportance,
	}
	const typeUrgency: Record<TaskType, number> = {
		...DEFAULT_PRIORITY_FACTORS.typeUrgency,
	}
	if (isRecordOfNumbers(obj.typeImportance)) {
		for (const t of TASK_TYPES) {
			if (typeof obj.typeImportance[t] === 'number') {
				typeImportance[t] = obj.typeImportance[t]
			}
		}
	}
	if (isRecordOfNumbers(obj.typeUrgency)) {
		for (const t of TASK_TYPES) {
			if (typeof obj.typeUrgency[t] === 'number') {
				typeUrgency[t] = obj.typeUrgency[t]
			}
		}
	}
	const customerMultiplier =
		typeof obj.customerMultiplier === 'number' &&
		obj.customerMultiplier >= 0 &&
		obj.customerMultiplier <= 10
			? obj.customerMultiplier
			: DEFAULT_PRIORITY_FACTORS.customerMultiplier

	const keywordWeights: KeywordWeight[] = []
	if (Array.isArray(obj.keywordWeights)) {
		for (const kw of obj.keywordWeights) {
			if (!kw || typeof kw !== 'object') continue
			const k = kw as Record<string, unknown>
			const terms = Array.isArray(k.terms)
				? (k.terms as unknown[]).filter((t): t is string => typeof t === 'string')
				: typeof k.terms === 'string'
					? k.terms.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
					: []
			const importance = typeof k.importance === 'number' ? k.importance : 0
			const urgency = typeof k.urgency === 'number' ? k.urgency : 0
			if (terms.length > 0) {
				keywordWeights.push({ terms, importance, urgency })
			}
		}
	}

	return { typeImportance, typeUrgency, customerMultiplier, keywordWeights }
}
