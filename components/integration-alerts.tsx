'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { IntegrationHealthStatus } from '@/lib/integration-health-types'

async function fetchIntegrationHealth(): Promise<IntegrationHealthStatus[]> {
	const res = await fetch('/api/integrations/health')
	if (!res.ok) return []
	const data = (await res.json()) as { integrations?: IntegrationHealthStatus[] }
	return data.integrations ?? []
}

export function IntegrationAlerts() {
	const queryClient = useQueryClient()
	const { data: integrations = [] } = useQuery({
		queryKey: ['integration-health'],
		queryFn: fetchIntegrationHealth,
		refetchInterval: 5 * 60 * 1000,
		refetchOnWindowFocus: true,
		staleTime: 60 * 1000,
	})

	useEffect(() => {
		const onParseAttempt = () => {
			void queryClient.invalidateQueries({ queryKey: ['integration-health'] })
		}
		window.addEventListener('integration-health:refresh', onParseAttempt)
		return () => {
			window.removeEventListener('integration-health:refresh', onParseAttempt)
		}
	}, [queryClient])

	const alerts = integrations.filter((item) => !item.healthy)
	if (alerts.length === 0) return null

	return (
		<div className="mb-4 space-y-2" role="alert" aria-live="polite">
			{alerts.map((alert) => (
				<div
					key={alert.service}
					className="rounded-xl2 border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
				>
					<p className="font-medium">
						{alert.service === 'openai'
							? 'OpenAI-forbindelse'
							: alert.service}
					</p>
					<p className="mt-1 text-amber-100/90 leading-relaxed">
						{alert.message ?? 'Integrationen svarer ikke.'}
					</p>
					{alert.actionUrl ? (
						<a
							href={alert.actionUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="mt-2 inline-block text-app-accent hover:underline"
						>
							Åbn OpenAI billing →
						</a>
					) : null}
				</div>
			))}
		</div>
	)
}

export function notifyIntegrationHealthRefresh() {
	if (typeof window === 'undefined') return
	window.dispatchEvent(new Event('integration-health:refresh'))
}
