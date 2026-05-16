export interface TeamMemberRecord {
	id: string
	name: string
	code: string | null
}

function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Initialer fra fulde navn (første bogstav per ord). */
export function computeMemberInitials(name: string): string {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.map((part) => part[0])
		.join('')
		.toUpperCase()
}

/**
 * Om teammedlem er nævnt i teksten (navn, kode eller initialer).
 */
export function teamMemberMentionedInText(
	member: TeamMemberRecord,
	rawText: string
): boolean {
	const text = rawText.toLowerCase()
	const nameLower = member.name.toLowerCase()

	if (text.includes(nameLower)) return true

	if (member.code) {
		const re = new RegExp(`\\b${escapeRegex(member.code)}\\b`, 'i')
		if (re.test(rawText)) return true
	}

	const parts = member.name.split(/\s+/).filter((p) => p.length >= 2)
	if (parts.length >= 2 && parts.every((p) => text.includes(p.toLowerCase()))) {
		return true
	}

	const initials = computeMemberInitials(member.name)
	if (initials.length >= 2) {
		const re = new RegExp(`\\b${escapeRegex(initials)}\\b`, 'i')
		if (re.test(rawText)) return true
	}

	const first = member.name.split(/\s+/)[0]
	if (first && first.length >= 3 && text.includes(first.toLowerCase())) {
		return true
	}

	return false
}

/** Delegationsfraser: "deleger til VSE", "deleg vse", osv. */
export function extractDelegationQueryFromText(
	rawText: string
): string | null {
	const patterns = [
		/(?:deleger(?:e|et|er)?|deleg(?:er|ér)?)\s+(?:til\s+)?([A-Za-zÀ-ÿ]{2,})/i,
		/(?:bed|bede)\s+([A-Za-zÀ-ÿ]{2,})\s+om/i,
	]
	for (const p of patterns) {
		const m = rawText.match(p)
		if (m?.[1]) return m[1].trim()
	}
	return null
}

export function resolveTeamMemberMatch(
	query: string,
	members: TeamMemberRecord[]
): TeamMemberRecord | null {
	const q = query.trim().toLowerCase()
	if (!q) return null

	const exact = members.find(
		(m) =>
			m.name.toLowerCase() === q ||
			(m.code && m.code.toLowerCase() === q)
	)
	if (exact) return exact

	const byInitials = members.filter(
		(m) => computeMemberInitials(m.name).toLowerCase() === q
	)
	if (byInitials.length === 1) return byInitials[0]
	if (byInitials.length > 1) {
		const byCode = byInitials.find((m) => m.code?.toLowerCase() === q)
		return byCode ?? byInitials[0]
	}

	const byFirst = members.filter(
		(m) => m.name.split(/\s+/)[0]?.toLowerCase() === q
	)
	if (byFirst.length === 1) return byFirst[0]

	return null
}
