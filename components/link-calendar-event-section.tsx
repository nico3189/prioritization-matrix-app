'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { SearchableSelect } from '@/components/searchable-select'
import {
	useCalendarEvents,
	type CalendarEventItem,
} from '@/lib/use-calendar-events'
import { formatCalendarEventOptionLabel } from '@/lib/calendar-event-label'

function IconGoogleCalendar({ className }: { className?: string }) {
	return (
		<svg
			className={className ?? 'w-4 h-4 shrink-0'}
			viewBox="0 0 256 256"
			preserveAspectRatio="xMidYMid meet"
			aria-hidden
		>
			<polygon
				fill="#FFFFFF"
				points="195.368421 60.6315789 60.6315789 60.6315789 60.6315789 195.368421 195.368421 195.368421"
			/>
			<polygon
				fill="#EA4335"
				points="195.368421 256 256 195.368421 225.684211 190.196005 195.368421 195.368421 189.835162 223.098002"
			/>
			<path
				fill="#188038"
				d="M1.42108547e-14,195.368421 L1.42108547e-14,235.789474 C1.42108547e-14,246.955789 9.04421053,256 20.2105263,256 L60.6315789,256 L66.8568645,225.684211 L60.6315789,195.368421 L27.5991874,190.196005 L1.42108547e-14,195.368421 Z"
			/>
			<path
				fill="#1967D2"
				d="M256,60.6315789 L256,20.2105263 C256,9.04421053 246.955789,1.42108547e-14 235.789474,1.42108547e-14 L195.368421,1.42108547e-14 C191.679582,15.0358547 189.835162,26.1010948 189.835162,33.1957202 C189.835162,40.2903456 191.679582,49.4356319 195.368421,60.6315789 C208.777986,64.4714866 218.883249,66.3914404 225.684211,66.3914404 C232.485172,66.3914404 242.590435,64.4714866 256,60.6315789 Z"
			/>
			<polygon
				fill="#FBBC04"
				points="256 60.6315789 195.368421 60.6315789 195.368421 195.368421 256 195.368421"
			/>
			<polygon
				fill="#34A853"
				points="195.368421 195.368421 60.6315789 195.368421 60.6315789 256 195.368421 256"
			/>
			<path
				fill="#4285F4"
				d="M195.368421,0 L20.2105263,0 C9.04421053,0 0,9.04421053 0,20.2105263 L0,195.368421 L60.6315789,195.368421 L60.6315789,60.6315789 L195.368421,60.6315789 L195.368421,0 Z"
			/>
		</svg>
	)
}

export interface LinkedCalendarEvent {
	linkedEventId: string
	linkedEventTitle: string | null
	linkedEventUrl: string | null
}

interface LinkCalendarEventSectionProps {
	linked: LinkedCalendarEvent | null
	isPending?: boolean
	onLink: (event: CalendarEventItem) => void
	onUnlink: () => void
}

export function LinkCalendarEventSection({
	linked,
	isPending = false,
	onLink,
	onUnlink,
}: LinkCalendarEventSectionProps) {
	const [pickerOpen, setPickerOpen] = useState(false)
	const [selectedEventId, setSelectedEventId] = useState('')
	const showPicker = pickerOpen || !linked?.linkedEventId

	const { data: events = [], isLoading, error, refetch } = useCalendarEvents(
		showPicker
	)

	const eventOptions = useMemo(
		() =>
			events.map((e) => ({
				value: e.id,
				label: formatCalendarEventOptionLabel(e.summary, e.start, e.end),
			})),
		[events]
	)

	const handleSelect = (eventId: string) => {
		const event = events.find((e) => e.id === eventId)
		if (!event) return
		setSelectedEventId('')
		setPickerOpen(false)
		onLink(event)
	}

	const authError =
		error instanceof Error &&
		(error.message === 'No Google token' ||
			error.message === 'Calendar auth expired')

	return (
		<div className="space-y-3">
			{linked?.linkedEventId && (
				<div className="flex flex-wrap items-center gap-2">
					{linked.linkedEventUrl ? (
						<a
							href={linked.linkedEventUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm text-slate-200 bg-sky-500/15 border border-sky-500/25 hover:bg-sky-500/25 hover:border-sky-500/40 transition-colors"
						>
							<IconGoogleCalendar />
							<span className="truncate max-w-[16rem]">
								{linked.linkedEventTitle ?? 'Kalenderbegivenhed'}
							</span>
						</a>
					) : (
						<span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm text-slate-200 bg-sky-500/15 border border-sky-500/25">
							<IconGoogleCalendar />
							<span className="truncate max-w-[16rem]">
								{linked.linkedEventTitle ?? 'Kalenderbegivenhed'}
							</span>
						</span>
					)}
					<button
						type="button"
						onClick={() => setPickerOpen(true)}
						disabled={isPending}
						className="text-xs text-slate-300 hover:text-white transition-colors disabled:opacity-50"
					>
						Skift
					</button>
					<button
						type="button"
						onClick={onUnlink}
						disabled={isPending}
						className="text-xs text-app-muted hover:text-red-400 transition-colors disabled:opacity-50"
					>
						Fjern kobling
					</button>
				</div>
			)}

			{!linked?.linkedEventId && !pickerOpen && (
				<button
					type="button"
					onClick={() => setPickerOpen(true)}
					disabled={isPending}
					className="text-sm text-app-accent hover:text-blue-300 transition-colors disabled:opacity-50"
				>
					Kobl til kalenderbegivenhed
				</button>
			)}

			{showPicker && (
				<div className="space-y-2 rounded-lg border border-white/5 bg-slate-900/40 p-3">
					{isLoading && (
						<p className="text-xs text-app-muted">Henter kalender…</p>
					)}
					{authError && (
						<div className="text-xs text-amber-200/90 space-y-2">
							<p>
								Kalender er ikke tilgængelig. Log ind med Google igen for at
								vælge begivenheder.
							</p>
							<Link
								href="/calendar"
								className="text-app-accent hover:underline"
							>
								Gå til kalender
							</Link>
						</div>
					)}
					{error && !authError && (
						<div className="flex flex-wrap items-center gap-2 text-xs text-app-muted">
							<span>Kunne ikke hente begivenheder.</span>
							<button
								type="button"
								onClick={() => refetch()}
								className="text-app-accent hover:underline"
							>
								Prøv igen
							</button>
						</div>
					)}
					{!isLoading && !error && events.length === 0 && (
						<p className="text-xs text-app-muted">
							Ingen begivenheder i de næste 14 dage (eller 3 dage tilbage).
						</p>
					)}
					{!isLoading && !error && events.length > 0 && (
						<SearchableSelect
							value={selectedEventId}
							onChange={handleSelect}
							options={eventOptions}
							placeholder="Vælg begivenhed…"
							searchPlaceholder="Søg i kalender…"
							className="w-full"
						/>
					)}
					{linked?.linkedEventId && pickerOpen && (
						<button
							type="button"
							onClick={() => {
								setPickerOpen(false)
								setSelectedEventId('')
							}}
							className="text-xs text-app-muted hover:text-slate-300 transition-colors"
						>
							Annullér
						</button>
					)}
				</div>
			)}
		</div>
	)
}
