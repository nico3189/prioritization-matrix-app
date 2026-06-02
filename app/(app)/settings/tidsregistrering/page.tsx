'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import {
	normalizeTimeTrackingSettings,
	type TimeTrackingSettings,
} from '@/lib/time-tracking-settings'
import {
	useTimeTrackingSettings,
	useUpdateTimeTrackingSettings,
} from '../_lib/settings-hooks'

export default function TidsregistreringPage() {
	const { data, isLoading } = useTimeTrackingSettings()
	const updateSettings = useUpdateTimeTrackingSettings()
	const [edit, setEdit] = useState<Partial<TimeTrackingSettings> | null>(null)
	const [saved, setSaved] = useState(false)

	const settings = normalizeTimeTrackingSettings(data)
	const url = edit?.url ?? settings.url
	const apiKey = edit?.apiKey ?? settings.apiKey
	const userId =
		edit?.userId !== undefined ? edit.userId : settings.userId
	const userIdInput = userId != null ? String(userId) : ''

	useEffect(() => {
		if (!saved) return
		const t = setTimeout(() => setSaved(false), 2000)
		return () => clearTimeout(t)
	}, [saved])

	const handleSave = () => {
		const payload: Partial<TimeTrackingSettings> = {
			url: url.trim(),
			apiKey,
			userId:
				userIdInput.trim() === ''
					? null
					: Number.parseInt(userIdInput, 10),
		}
		if (
			payload.userId != null &&
			(!Number.isFinite(payload.userId) || payload.userId <= 0)
		) {
			return
		}
		updateSettings.mutate(payload, {
			onSuccess: () => {
				setEdit(null)
				setSaved(true)
			},
		})
	}

	const hasChanges =
		edit != null &&
		(edit.url !== undefined ||
			edit.apiKey !== undefined ||
			edit.userId !== undefined)

	return (
		<div className="min-w-0 max-w-full">
			<h1 className="text-3xl font-semibold text-slate-100 mb-2">
				Tidsregistrering
			</h1>
			<p className="text-xs text-app-muted mb-6 max-w-xl">
				Indstillinger til at starte tidsregistrering fra opgavemodalen via
				jeres eksterne API. Kaldet sendes direkte fra browseren med de
				værdier du gemmer her.
			</p>

			{isLoading ? (
				<p className="text-sm text-app-muted">Henter...</p>
			) : (
				<div className="space-y-4 max-w-xl">
					<label className="block">
						<span className="text-xs font-medium text-app-muted uppercase tracking-wider">
							URL
						</span>
						<input
							type="url"
							value={url}
							onChange={(e) =>
								setEdit((prev) => ({
									...settings,
									...prev,
									url: e.target.value,
								}))
							}
							placeholder="https://..."
							className="mt-1 w-full bg-slate-900/60 border border-white/5 rounded-lg px-4 py-2 text-sm text-slate-200 placeholder:text-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent/40"
							autoComplete="off"
						/>
					</label>

					<label className="block">
						<span className="text-xs font-medium text-app-muted uppercase tracking-wider">
							API-nøgle (X-Apikey)
						</span>
						<input
							type="password"
							value={apiKey}
							onChange={(e) =>
								setEdit((prev) => ({
									...settings,
									...prev,
									apiKey: e.target.value,
								}))
							}
							className="mt-1 w-full bg-slate-900/60 border border-white/5 rounded-lg px-4 py-2 text-sm text-slate-200 placeholder:text-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent/40 font-mono"
							autoComplete="off"
						/>
					</label>

					<label className="block">
						<span className="text-xs font-medium text-app-muted uppercase tracking-wider">
							User ID
						</span>
						<input
							type="number"
							min={1}
							step={1}
							value={userIdInput}
							onChange={(e) => {
								const v = e.target.value
								setEdit((prev) => ({
									...settings,
									...prev,
									userId:
										v.trim() === ''
											? null
											: Number.parseInt(v, 10),
								}))
							}}
							className="mt-1 w-full max-w-[12rem] bg-slate-900/60 border border-white/5 rounded-lg px-4 py-2 text-sm text-slate-200 placeholder:text-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent/40"
							autoComplete="off"
						/>
					</label>

					<div className="flex flex-wrap items-center gap-3 pt-2">
						<button
							type="button"
							onClick={handleSave}
							disabled={
								updateSettings.isPending ||
								(!hasChanges &&
									url === settings.url &&
									apiKey === settings.apiKey &&
									userId === settings.userId)
							}
							className="bg-app-accent text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md hover:opacity-90 active:scale-95 transition-colors duration-200 ease-out disabled:opacity-50"
						>
							{updateSettings.isPending ? 'Gemmer...' : 'Gem'}
						</button>
						{saved && (
							<span className="text-sm text-emerald-400">Gemt</span>
						)}
						{updateSettings.isError && (
							<span className="text-sm text-app-danger">
								Kunne ikke gemme
							</span>
						)}
					</div>

					<p
						className={cn(
							'text-xs text-app-muted pt-2 border-t border-white/5'
						)}
					>
						I opgavemodalen bruges formatet{' '}
						<code className="text-slate-400">Type - Titel</code> som
						tekst til tidsregistreringen.
					</p>
				</div>
			)}
		</div>
	)
}
