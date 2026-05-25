'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
	normalizeTaskVisualCue,
	resolveTaskTypeStripeColor,
	taskTypeStripeStyle,
} from '@/lib/task-visual-cue'

export function useTaskVisualCueSettings() {
	return useQuery({
		queryKey: ['taskVisualCue'],
		queryFn: async () => {
			const r = await fetch('/api/settings/visual-cue')
			if (!r.ok) throw new Error('Kunne ikke hente opgavefarver')
			return normalizeTaskVisualCue(await r.json())
		},
		staleTime: 60_000,
	})
}

/** Venstre streg-farve og inline style for en opgaves type. */
export function useTaskTypeStripe(type: string | null | undefined) {
	const { data: settings } = useTaskVisualCueSettings()
	return useMemo(() => {
		const normalized = normalizeTaskVisualCue(settings)
		const color = resolveTaskTypeStripeColor(type, normalized)
		return {
			color,
			style: taskTypeStripeStyle(color),
			enabled: normalized.enabled,
		}
	}, [type, settings])
}
