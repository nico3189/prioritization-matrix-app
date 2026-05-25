/** Rens URL for trailing punctuation fra sætninger. */
export function normalizeExtractedUrl(url: string): string {
	let u = url.trim()
	u = u.replace(/[.,;:!?)>\]]+$/g, '')
	return u.length > 10 ? u : ''
}

const URL_IN_TEXT_RE = /https?:\/\/[^\s<>"')\]]+/gi

/** Alle http(s)-links i tekst, dedupliceret (bevarer rækkefølge). */
export function extractUrlsFromText(text: string): string[] {
	const matches = text.match(URL_IN_TEXT_RE) ?? []
	const seen = new Set<string>()
	const urls: string[] = []
	for (const m of matches) {
		const n = normalizeExtractedUrl(m)
		if (!n) continue
		const key = n.toLowerCase()
		if (seen.has(key)) continue
		seen.add(key)
		urls.push(n)
	}
	return urls
}

function parseUrlField(value: string): string[] {
	return value
		.split('\n')
		.map((s) => normalizeExtractedUrl(s) || s.trim())
		.filter((s) => s.length > 10)
}

/**
 * Saml links fra AI-parse og rå tekst til én newline-separeret streng (task.url).
 */
export function mergeTaskUrls(
	aiUrl: string | null | undefined,
	rawText: string
): string | null {
	const seen = new Set<string>()
	const all: string[] = []

	const add = (u: string) => {
		const n = normalizeExtractedUrl(u) || u.trim()
		if (n.length <= 10) return
		const key = n.toLowerCase()
		if (seen.has(key)) return
		seen.add(key)
		all.push(n)
	}

	for (const u of parseUrlField(aiUrl ?? '')) add(u)
	for (const u of extractUrlsFromText(rawText)) add(u)

	return all.length > 0 ? all.join('\n') : null
}

/** Opdel task.url til individuelle links. */
export function splitTaskUrls(url: string | null | undefined): string[] {
	if (!url?.trim()) return []
	return parseUrlField(url)
}
