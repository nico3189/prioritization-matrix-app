'use client'

import { useQuery } from '@tanstack/react-query'

export interface CalendarEventItem {
	id: string
	summary: string
	start?: string
	end?: string
	htmlLink?: string | null
}

export function useCalendarEvents(enabled = true) {
	const now = new Date()
	const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
	const in14 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
	return useQuery({
		queryKey: ['calendar', 'events'],
		queryFn: async () => {
			const r = await fetch(
				`/api/calendar/events?timeMin=${threeDaysAgo.toISOString()}&timeMax=${in14.toISOString()}`
			)
			const text = await r.text()
			const json = text ? JSON.parse(text) : {}
			if (!r.ok) {
				throw new Error(
					(json as { error?: string }).error ?? 'Kunne ikke hente kalender'
				)
			}
			return Array.isArray(json) ? (json as CalendarEventItem[]) : []
		},
		enabled,
		staleTime: 5 * 60 * 1000,
		retry: (failureCount, err) => {
			const msg = err instanceof Error ? err.message : ''
			if (msg === 'No Google token' || msg === 'Calendar auth expired') {
				return failureCount < 2
			}
			return failureCount < 1
		},
		retryDelay: (attempt) => Math.min(800 * 2 ** attempt, 3000),
	})
}
