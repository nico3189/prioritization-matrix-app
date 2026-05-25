'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
	DEFAULT_TYPE_COLORS,
	TASK_TYPES,
	TYPE_LABELS,
	normalizeTaskVisualCue,
	type TaskVisualCueSettings,
} from '@/lib/task-visual-cue'
import {
	useTaskVisualCue,
	useUpdateTaskVisualCue,
} from '../_lib/settings-hooks'

export default function OpgavefarverPage() {
	const { data, isLoading } = useTaskVisualCue()
	const updateVisualCue = useUpdateTaskVisualCue()
	const [edit, setEdit] = useState<Partial<TaskVisualCueSettings> | null>(
		null
	)
	const [saved, setSaved] = useState(false)

	const settings = normalizeTaskVisualCue(data)
	const enabled = edit?.enabled ?? settings.enabled
	const colors = { ...settings.colors, ...edit?.colors }

	const handleSave = () => {
		updateVisualCue.mutate(
			{ enabled, colors },
			{
				onSuccess: () => {
					setEdit(null)
					setSaved(true)
					setTimeout(() => setSaved(false), 2000)
				},
			}
		)
	}

	const handleReset = () => {
		const resetColors = { ...DEFAULT_TYPE_COLORS }
		setEdit({ enabled: true, colors: resetColors })
		updateVisualCue.mutate(
			{ enabled: true, colors: resetColors },
			{
				onSuccess: () => {
					setEdit(null)
					setSaved(true)
					setTimeout(() => setSaved(false), 2000)
				},
			}
		)
	}

	return (
		<div className="min-w-0 max-w-full">
			<h1 className="text-3xl font-semibold text-slate-100 mb-2">
				Opgavefarver
			</h1>
			<p className="text-xs text-app-muted mb-6 max-w-xl">
				Vis en farvet venstre streg på opgavekort og i tabellen baseret på
				opgavens type (kunde, internt, salg, ledelse). Opgaver uden type
				vises uden streg.
			</p>

			{isLoading ? (
				<p className="text-sm text-app-muted">Henter...</p>
			) : (
				<div className="space-y-6 max-w-2xl">
					<label className="flex items-center gap-3 cursor-pointer">
						<input
							type="checkbox"
							checked={enabled}
							onChange={(e) =>
								setEdit((prev) => ({
									...prev,
									enabled: e.target.checked,
								}))
							}
							className="rounded border-white/20 bg-slate-900/60 text-app-accent focus:ring-app-accent/40"
						/>
						<span className="text-sm text-slate-200">
							Vis farvet streg på opgaver
						</span>
					</label>

					<div
						className={cn(
							'overflow-x-auto rounded-xl2 border border-white/5 app-card-gradient',
							!enabled && 'opacity-50 pointer-events-none'
						)}
					>
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-white/5">
									<th className="text-left px-4 py-2.5 text-xs font-medium text-app-muted uppercase tracking-wider">
										Type
									</th>
									<th className="text-left px-4 py-2.5 text-xs font-medium text-app-muted uppercase tracking-wider w-36">
										Farve
									</th>
									<th className="text-left px-4 py-2.5 text-xs font-medium text-app-muted uppercase tracking-wider">
										Forhåndsvisning
									</th>
								</tr>
							</thead>
							<tbody>
								{TASK_TYPES.map((key) => (
									<tr
										key={key}
										className="border-b border-white/5 last:border-0"
									>
										<td className="px-4 py-3 text-slate-200">
											{TYPE_LABELS[key]}
										</td>
										<td className="px-4 py-2">
											<div className="flex items-center gap-2">
												<input
													type="color"
													value={colors[key]}
													onChange={(e) =>
														setEdit((prev) => ({
															...prev,
															colors: {
																...settings.colors,
																...prev?.colors,
																[key]: e.target.value,
															},
														}))
													}
													className="w-10 h-9 rounded cursor-pointer border border-white/10 bg-transparent"
													aria-label={`Farve for ${TYPE_LABELS[key]}`}
												/>
												<input
													type="text"
													value={colors[key]}
													onChange={(e) => {
														const v = e.target.value
														if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) {
															setEdit((prev) => ({
																...prev,
																colors: {
																	...settings.colors,
																	...prev?.colors,
																	[key]: v,
																},
															}))
														}
													}}
													className="w-24 bg-slate-900/60 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-app-accent/40"
													maxLength={7}
												/>
											</div>
										</td>
										<td className="px-4 py-2">
											<div
												className="rounded-lg border border-white/5 bg-app-card px-3 py-2 text-xs text-slate-300"
												style={{
													borderLeftWidth: 4,
													borderLeftStyle: 'solid',
													borderLeftColor: colors[key],
												}}
											>
												Eksempel — {TYPE_LABELS[key]}
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>

					<div className="flex flex-wrap items-center gap-3">
						<button
							type="button"
							onClick={handleSave}
							disabled={updateVisualCue.isPending}
							className="bg-app-accent text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md hover:opacity-90 active:scale-95 transition disabled:opacity-50"
						>
							{updateVisualCue.isPending ? 'Gemmer...' : 'Gem'}
						</button>
						<button
							type="button"
							onClick={handleReset}
							disabled={updateVisualCue.isPending}
							className="text-sm text-slate-300 hover:text-white transition"
						>
							Nulstil til standard
						</button>
						{saved && (
							<span className="text-sm text-app-success">Gemt</span>
						)}
					</div>
				</div>
			)}
		</div>
	)
}
