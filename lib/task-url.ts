/**
 * Offentlig URL til en opgave (direkte link / deling / MCP).
 */
export function getTaskUrl(taskId: string, origin?: string): string {
	if (origin) {
		return `${origin.replace(/\/$/, '')}/tasks/${taskId}`
	}
	if (typeof window !== 'undefined') {
		return `${window.location.origin}/tasks/${taskId}`
	}
	const base = process.env.NEXTAUTH_URL?.replace(/\/$/, '') ?? ''
	return `${base}/tasks/${taskId}`
}
