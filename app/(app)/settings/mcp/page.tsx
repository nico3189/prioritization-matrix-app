'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useApiKeys } from '../_lib/settings-hooks'

const MCP_TOOLS = [
	{
		name: 'create_task',
		desc: 'Opret opgave fra fritekst (AI-parser).',
	},
	{
		name: 'list_tasks',
		desc: 'List opgaver med filtre (status, hastighed, kunde, søgning).',
	},
	{
		name: 'get_task',
		desc: 'Hent én opgave med alle felter.',
	},
	{
		name: 'update_task',
		desc: 'Opdater titel, deadline, tags, links, noter m.m.',
	},
	{
		name: 'add_tag',
		desc: 'Tilføj et tag til en opgave.',
	},
	{
		name: 'remove_tag',
		desc: 'Fjern et tag fra en opgave.',
	},
	{
		name: 'complete_task',
		desc: 'Marker opgave som udført.',
	},
] as const

export default function McpPage() {
	const { data: apiKeys = [], isLoading: apiKeysLoading } = useApiKeys()
	const [origin, setOrigin] = useState('https://din-app.example.com')
	const [copied, setCopied] = useState<string | null>(null)

	useEffect(() => {
		setOrigin(
			typeof window !== 'undefined'
				? window.location.origin
				: 'https://din-app.example.com'
		)
	}, [])

	const mcpUrl = `${origin}/api/mcp`

	const cursorConfig = `{
  "mcpServers": {
    "prioritization-matrix": {
      "url": "${mcpUrl}",
      "headers": {
        "Authorization": "Bearer pm_DIN_NØGLE"
      }
    }
  }
}`

	const handleCopy = useCallback(async (text: string, id: string) => {
		await navigator.clipboard.writeText(text)
		setCopied(id)
		setTimeout(() => setCopied(null), 2000)
	}, [])

	return (
		<div className="min-w-0 max-w-full">
			<h1 className="text-3xl font-semibold text-slate-100 mb-2">
				MCP-forbindelse
			</h1>
			<p className="text-xs text-app-muted mb-6 max-w-2xl leading-relaxed">
				Kobl Claude Desktop, Cursor eller andre MCP-klienter til din
				prioriteringsmatrix. Forbindelsen bruger samme API-nøgler som REST-API&apos;et
				— opret en nøgle under{' '}
				<Link href="/settings/api" className="text-app-accent hover:underline">
					API-nøgle
				</Link>
				.
			</p>

			<section className="mb-8 p-5 rounded-xl2 border border-white/5 app-card-gradient shadow-card max-w-2xl">
				<h2 className="text-sm font-medium text-slate-200 mb-2">
					Server-URL (Streamable HTTP)
				</h2>
				<p className="text-xs text-app-muted mb-3">
					Transport: MCP over HTTP. Send{' '}
					<code className="text-slate-400">Authorization: Bearer pm_…</code>{' '}
					i hver request.
				</p>
				<div className="flex items-center gap-2">
					<code className="flex-1 px-3 py-2 rounded-lg bg-slate-900/80 text-slate-200 text-sm font-mono break-all">
						{mcpUrl}
					</code>
					<button
						type="button"
						onClick={() => handleCopy(mcpUrl, 'url')}
						className="shrink-0 bg-app-accent hover:opacity-90 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
					>
						{copied === 'url' ? 'Kopieret' : 'Kopier'}
					</button>
				</div>
			</section>

			<section className="mb-8 max-w-2xl">
				<h2 className="text-sm font-medium text-slate-200 mb-2">
					Eksempel: Cursor
				</h2>
				<p className="text-xs text-app-muted mb-3">
					Tilføj under MCP-indstillinger (fx{' '}
					<code className="text-slate-400">.cursor/mcp.json</code>
					). Erstat <code className="text-slate-400">pm_DIN_NØGLE</code> med en
					nøgle fra API-nøgle-siden.
				</p>
				<div className="relative">
					<pre className="p-4 rounded-xl2 bg-slate-900/60 border border-white/5 text-xs text-slate-300 overflow-x-auto">
						{cursorConfig}
					</pre>
					<button
						type="button"
						onClick={() => handleCopy(cursorConfig, 'cursor')}
						className="absolute top-2 right-2 bg-slate-800/90 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 transition"
					>
						{copied === 'cursor' ? 'Kopieret' : 'Kopier JSON'}
					</button>
				</div>
			</section>

			<section className="mb-8 max-w-2xl">
				<h2 className="text-sm font-medium text-slate-200 mb-2">
					Tilgængelige tools
				</h2>
				<p className="text-xs text-app-muted mb-3">
					Klienten kan kalde disse værktøjer mod dine opgaver (samme data som i
					appen).
				</p>
				<ul className="rounded-xl2 border border-white/5 app-card-gradient divide-y divide-white/5">
					{MCP_TOOLS.map((tool) => (
						<li
							key={tool.name}
							className="px-4 py-3 flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3"
						>
							<code className="text-sm text-app-accent shrink-0">
								{tool.name}
							</code>
							<span className="text-sm text-slate-300">{tool.desc}</span>
						</li>
					))}
				</ul>
			</section>

			<section className="max-w-2xl">
				<h2 className="text-sm font-medium text-slate-200 mb-2">
					Dine API-nøgler
				</h2>
				<p className="text-xs text-app-muted mb-3">
					MCP og REST deler nøgler. Opret eller slet nøgler under{' '}
					<Link href="/settings/api" className="text-app-accent hover:underline">
						API-nøgle
					</Link>
					.
				</p>
				{apiKeysLoading ? (
					<p className="text-sm text-app-muted">Henter...</p>
				) : apiKeys.length > 0 ? (
					<ul className="text-sm text-slate-300 space-y-1">
						{(
							apiKeys as { id: string; name: string; createdAt: string }[]
						).map((k) => (
							<li key={k.id}>
								<span className="text-slate-200">{k.name}</span>
								<span className="text-app-muted text-xs ml-2">
									oprettet{' '}
									{new Date(k.createdAt).toLocaleDateString('da-DK')}
								</span>
							</li>
						))}
					</ul>
				) : (
					<p className="text-sm text-app-muted">
						Ingen nøgler endnu.{' '}
						<Link
							href="/settings/api"
							className="text-app-accent hover:underline"
						>
							Opret en API-nøgle
						</Link>{' '}
						først.
					</p>
				)}
			</section>
		</div>
	)
}
