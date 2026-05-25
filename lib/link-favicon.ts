/** Sikrer http(s) så URL kan parses og åbnes. */
export function ensureUrlProtocol(url: string): string {
	const t = url.trim()
	if (!t) return ''
	if (/^https?:\/\//i.test(t)) return t
	return `https://${t}`
}

/** Hostname uden www. — til visning i link-pills. */
export function getLinkHostname(url: string): string | null {
	try {
		return new URL(ensureUrlProtocol(url)).hostname.replace(/^www\./i, '')
	} catch {
		return null
	}
}

/** Google favicon-tjeneste (ingen server-fetch). */
export function getFaviconUrl(url: string, size = 32): string | null {
	const host = getLinkHostname(url)
	if (!host) return null
	return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=${size}`
}
