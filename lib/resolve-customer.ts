export interface CustomerRecord {
	id: string
	name: string
	code: string | null
}

function tokenize(s: string): string[] {
	return s
		.toLowerCase()
		.split(/[\s/\-,]+/)
		.map((t) => t.trim())
		.filter(Boolean)
}

/** Eksplicit "Kunde: …" i rawText (før AI). */
export function extractExplicitCustomerFromText(
	rawText: string
): string | null {
	const m = rawText.match(/(?:^|\n)\s*kunde\s*:\s*([^\n]+)/i)
	if (!m) return null
	const name = m[1].trim()
	return name.length > 0 ? name : null
}

/**
 * Matcher kundenavn mod brugerens kunder (exact, code, token-overlap).
 * Returnerer bedste match ved score >= threshold.
 */
export function resolveCustomerMatch(
	query: string,
	customers: CustomerRecord[],
	threshold = 0.7
): CustomerRecord | null {
	const q = query.trim()
	if (!q) return null
	const qLower = q.toLowerCase()

	const exact = customers.find(
		(c) =>
			c.name.toLowerCase() === qLower ||
			(c.code && c.code.toLowerCase() === qLower)
	)
	if (exact) return exact

	const qTokens = tokenize(q)
	if (qTokens.length === 0) return null

	let best: CustomerRecord | null = null
	let bestScore = 0

	for (const c of customers) {
		const nameLower = c.name.toLowerCase()
		if (nameLower.includes(qLower) || qLower.includes(nameLower)) {
			const score = Math.max(qTokens.length, tokenize(c.name).length) /
				Math.max(qTokens.length, tokenize(c.name).length)
			if (score > bestScore) {
				bestScore = score
				best = c
			}
			continue
		}

		const nTokens = tokenize(c.name)
		const matched = qTokens.filter((qt) =>
			nTokens.some(
				(nt) => nt === qt || nt.includes(qt) || qt.includes(nt)
			)
		)
		const score = matched.length / qTokens.length
		if (score > bestScore) {
			bestScore = score
			best = c
		}
	}

	return bestScore >= threshold ? best : null
}
