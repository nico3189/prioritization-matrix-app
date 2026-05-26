'use client'

import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import {
	DEFAULT_TASK_TABLE_COLUMNS_SETTINGS,
	TASK_TABLE_COLUMN_LABEL,
	TASK_TABLE_COLUMNS,
	normalizeTaskTableColumnsSettings,
	type TaskTableColumnId,
	type TaskTableColumnsSettings,
} from '@/lib/task-table-columns'
import {
	useTaskTableColumns,
	useUpdateTaskTableColumns,
} from '../_lib/settings-hooks'

function moveItem<T>(arr: T[], from: number, to: number): T[] {
	const next = [...arr]
	const [item] = next.splice(from, 1)
	next.splice(to, 0, item)
	return next
}

export default function TabeloversigtPage() {
	const { data, isLoading } = useTaskTableColumns()
	const update = useUpdateTaskTableColumns()
	const [draft, setDraft] = useState<TaskTableColumnsSettings | null>(null)
	const [saved, setSaved] = useState(false)

	const settings = useMemo(
		() => normalizeTaskTableColumnsSettings(data),
		[data]
	)

	useEffect(() => {
		if (!draft) return
		setSaved(false)
	}, [draft])

	const effective = draft ?? settings

	const enabled = (id: TaskTableColumnId) =>
		Boolean(effective.enabled[id] ?? false)

	const handleToggle = (id: TaskTableColumnId) => {
		setDraft((prev) => {
			const base = prev ?? settings
			return {
				...base,
				enabled: { ...base.enabled, [id]: !enabled(id) },
			}
		})
	}

	const handleMove = (id: TaskTableColumnId, dir: -1 | 1) => {
		setDraft((prev) => {
			const base = prev ?? settings
			const idx = base.order.indexOf(id)
			if (idx === -1) return base
			const nextIdx = idx + dir
			if (nextIdx < 0 || nextIdx >= base.order.length) return base
			return { ...base, order: moveItem(base.order, idx, nextIdx) }
		})
	}

	const handleDrag = (fromId: TaskTableColumnId, toId: TaskTableColumnId) => {
		setDraft((prev) => {
			const base = prev ?? settings
			const from = base.order.indexOf(fromId)
			const to = base.order.indexOf(toId)
			if (from === -1 || to === -1 || from === to) return base
			return { ...base, order: moveItem(base.order, from, to) }
		})
	}

	const handleSave = () => {
		update.mutate(
			{
				order: effective.order,
				enabled: effective.enabled as Record<string, boolean>,
			},
			{
				onSuccess: () => {
					setDraft(null)
					setSaved(true)
					setTimeout(() => setSaved(false), 2000)
				},
			}
		)
	}

	const handleReset = () => {
		update.mutate(DEFAULT_TASK_TABLE_COLUMNS_SETTINGS as unknown as object, {
			onSuccess: () => {
				setDraft(null)
				setSaved(true)
				setTimeout(() => setSaved(false), 2000)
			},
		})
	}

	return (
		<div className="min-w-0 max-w-full">
			<h1 className="text-3xl font-semibold text-slate-100 mb-2">
				Tabeloversigt
			</h1>
			<p className="text-xs text-app-muted mb-6 max-w-2xl leading-relaxed">
				Vælg hvilke kolonner der vises i tabelvisning, og hvilken rækkefølge
				de vises i. Titel + første linje af beskrivelse vises altid som første
				kolonne. Handlinger (kopiér link / udfør) er altid sidst.
			</p>

			{isLoading ? (
				<p className="text-sm text-app-muted">Henter...</p>
			) : (
				<div className="space-y-4 max-w-2xl">
					<div className="rounded-xl2 border border-white/5 app-card-gradient">
						<div className="px-4 py-3 border-b border-white/5">
							<span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
								Kolonner
							</span>
						</div>
						<ul className="p-3 space-y-2">
							{effective.order.map((id) => (
								<li
									key={id}
									draggable
									onDragStart={(e) => {
										e.dataTransfer.setData('text/plain', id)
										e.dataTransfer.effectAllowed = 'move'
									}}
									onDragOver={(e) => {
										e.preventDefault()
										e.dataTransfer.dropEffect = 'move'
									}}
									onDrop={(e) => {
										e.preventDefault()
										const from = e.dataTransfer.getData('text/plain') as TaskTableColumnId
										if (from) handleDrag(from, id)
									}}
									className={cn(
										'flex items-center gap-3 rounded-lg border border-white/5 bg-slate-900/40 px-3 py-2',
										'hover:bg-slate-900/50 transition-colors'
									)}
								>
									<span
										className="text-app-muted cursor-grab select-none"
										title="Træk for at ændre rækkefølge"
										aria-hidden
									>
										⋮⋮
									</span>
									<label className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
										<input
											type="checkbox"
											checked={enabled(id)}
											onChange={() => handleToggle(id)}
											className="rounded border-white/20 bg-slate-900/60 text-app-accent focus:ring-app-accent/40"
										/>
										<span className="text-sm text-slate-200 truncate">
											{TASK_TABLE_COLUMN_LABEL[id]}
										</span>
									</label>
									<div className="flex items-center gap-1 shrink-0">
										<button
											type="button"
											onClick={() => handleMove(id, -1)}
											className="p-1.5 rounded-md text-app-muted hover:text-slate-200 hover:bg-white/5 transition-colors"
											aria-label={`Flyt ${TASK_TABLE_COLUMN_LABEL[id]} op`}
										>
											↑
										</button>
										<button
											type="button"
											onClick={() => handleMove(id, 1)}
											className="p-1.5 rounded-md text-app-muted hover:text-slate-200 hover:bg-white/5 transition-colors"
											aria-label={`Flyt ${TASK_TABLE_COLUMN_LABEL[id]} ned`}
										>
											↓
										</button>
									</div>
								</li>
							))}
						</ul>
						<div className="px-4 py-3 border-t border-white/5 flex flex-wrap items-center gap-3">
							<button
								type="button"
								onClick={handleSave}
								disabled={update.isPending}
								className="bg-app-accent text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md hover:opacity-90 active:scale-95 transition disabled:opacity-50"
							>
								{update.isPending ? 'Gemmer...' : 'Gem'}
							</button>
							<button
								type="button"
								onClick={handleReset}
								disabled={update.isPending}
								className="text-sm text-slate-300 hover:text-white transition"
							>
								Nulstil til standard
							</button>
							{saved && <span className="text-sm text-app-success">Gemt</span>}
						</div>
					</div>

					<p className="text-xs text-app-muted">
						Noter: På små skærme skjules visse kolonner automatisk, selv om de er
						slået til (som før).
					</p>
				</div>
			)}
		</div>
	)
}

