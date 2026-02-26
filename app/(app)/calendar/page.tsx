'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useRef, useEffect } from 'react'
import { signOut, signIn } from 'next-auth/react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

type CalendarEvent = {
  id: string
  summary: string
  start?: string
  end?: string
  htmlLink?: string | null
  attendees?: Array<{
    email: string | null
    displayName: string | null
    organizer?: boolean
    self?: boolean
    responseStatus?: string | null
  }>
}

const DAY_NAMES = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag']
const MONTH_NAMES = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december']

function formatDateDDMMYYYY(iso: string): string {
  const d = new Date(iso)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${day}/${month}/${year}, ${h}:${m}`
}

function IconClipboard() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  )
}

function IconPaperAirplane() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
    </svg>
  )
}

function formatTimeRange(start: string | undefined, end: string | undefined): string {
  if (!start) return ''
  const h = String(new Date(start).getHours()).padStart(2, '0')
  const m = String(new Date(start).getMinutes()).padStart(2, '0')
  if (!end) return `${h}:${m}`
  const eh = String(new Date(end).getHours()).padStart(2, '0')
  const em = String(new Date(end).getMinutes()).padStart(2, '0')
  return `${h}:${m}–${eh}:${em}`
}

function getDateKey(iso: string | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDayLabel(dateKey: string): string {
  const [y, m, day] = dateKey.split('-').map(Number)
  const date = new Date(y, m - 1, day)
  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowKey = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`

  const dayName = DAY_NAMES[date.getDay()]
  const dateStr = `${day}. ${MONTH_NAMES[m - 1]}`

  if (dateKey === todayKey) return `I dag – ${dayName} ${dateStr}`
  if (dateKey === yesterdayKey) return `I går – ${dayName} ${dateStr}`
  if (dateKey === tomorrowKey) return `I morgen – ${dayName} ${dateStr}`
  return dayName.charAt(0).toUpperCase() + dayName.slice(1) + ' ' + dateStr
}

function useCalendarEvents() {
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
      if (!r.ok) throw new Error(json.error ?? 'Kunne ikke hente kalender')
      return Array.isArray(json) ? json : []
    },
  })
}

function useCreateTaskFromEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { rawText: string; [k: string]: unknown }) => {
      const r = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const text = await r.text()
      const json = text ? JSON.parse(text) : {}
      if (!r.ok) {
        const msg = json.error ?? json.message ?? 'Kunne ikke oprette opgave'
        throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
      }
      const task = json
      let parseFailed = false
      let parseErrorDetail: string | null = null
      try {
        const parseRes = await fetch(`/api/tasks/${task.id}/parse`, {
          method: 'POST',
        })
        if (!parseRes.ok) {
          parseFailed = true
          const err = await parseRes.json().catch(() => ({}))
          parseErrorDetail =
            (err as { detail?: string; error?: string }).detail ??
            (err as { detail?: string; error?: string }).error ??
            null
        }
      } catch (e) {
        parseFailed = true
        parseErrorDetail = e instanceof Error ? e.message : 'Netværksfejl'
      }
      return { task, parseFailed, parseErrorDetail }
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['task', data.task.id] })
    },
  })
}

export default function CalendarPage() {
  const { data, isLoading, error } = useCalendarEvents()
  const events = Array.isArray(data) ? data : []
  const createTask = useCreateTaskFromEvent()
  const [creatingFor, setCreatingFor] = useState<{
    event: CalendarEvent
    type: 'prep' | 'followup'
  } | null>(null)
  const [inputText, setInputText] = useState('')
  const [followUpTimeFrame, setFollowUpTimeFrame] = useState<string>('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [pastDaysOpen, setPastDaysOpen] = useState(false)

  const FOLLOW_UP_TIME_OPTIONS = [
    { value: '1 time', label: 'Inden for 1 time' },
    { value: '1 dag', label: 'Inden for 1 dag' },
    { value: '2 dage', label: 'Inden for 2 dage' },
    { value: '1 uge', label: 'Inden for 1 uge' },
  ] as const
  const [followUpTimeCustom, setFollowUpTimeCustom] = useState('')

  useEffect(() => {
    if (creatingFor) {
      const prefix = creatingFor.type === 'prep' ? 'Prep: ' : 'Follow-up: '
      setInputText(`${prefix}${creatingFor.event.summary}`)
      setFollowUpTimeFrame(creatingFor.type === 'followup' ? '' : '')
      setFollowUpTimeCustom('')
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [creatingFor])

  useEffect(() => {
    if (!creatingFor) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !createTask.isPending) setCreatingFor(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [creatingFor, createTask.isPending])

  const handleOpenPrep = (e: CalendarEvent) => {
    setCreatingFor({ event: e, type: 'prep' })
  }

  const handleOpenFollowUp = (e: CalendarEvent) => {
    setCreatingFor({ event: e, type: 'followup' })
  }

  const handleSubmitFromModal = () => {
    if (!creatingFor || !inputText.trim() || createTask.isPending) return
    const effectiveTimeFrame =
      creatingFor.type === 'followup'
        ? followUpTimeFrame.trim() || followUpTimeCustom.trim()
        : ''
    if (creatingFor.type === 'followup' && !effectiveTimeFrame) return
    const { event, type } = creatingFor
    let rawText = inputText.trim()
    if (type === 'followup' && effectiveTimeFrame) {
      rawText += `\n\nOpfølgning skal ske inden for: ${effectiveTimeFrame}`
    }
    const body: { rawText: string; [k: string]: unknown } = {
      rawText,
      linkedEventId: event.id,
      linkedEventType: type,
      linkedEventTitle: event.summary,
      linkedEventUrl: event.htmlLink ?? undefined,
      dueAt: event.start ? new Date(event.start).toISOString() : undefined,
      eventStartAt: event.start ? new Date(event.start).toISOString() : undefined,
      eventEndAt: event.end ? new Date(event.end).toISOString() : undefined,
    }
    createTask.mutate(body, {
      onSettled: () => setCreatingFor(null),
    })
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold text-slate-100 mb-2">Kalender</h1>
      <p className="text-xs text-app-muted mb-6">Events fra de sidste 3 dage og 14 dage frem. Opret prep- eller follow-up opgaver.</p>
      {createTask.isSuccess && (
        <div
          className={`mb-4 p-4 rounded-lg border ${
            createTask.data?.parseFailed
              ? 'bg-amber-500/10 border-amber-500/30'
              : 'bg-emerald-500/10 border-emerald-500/30'
          }`}
        >
          <p
            className={`text-sm ${
              createTask.data?.parseFailed ? 'text-amber-200' : 'text-emerald-200'
            }`}
          >
            {createTask.data?.parseFailed
              ? 'Opgave oprettet. AI kunne ikke udfylde felterne – tjek opgaven i Alle inputs.'
              : 'Opgave oprettet. AI har udfyldt felterne.'}{' '}
            <Link href="/inbox" className="underline hover:no-underline">
              Gå til Alle inputs
            </Link>
          </p>
        </div>
      )}
      {createTask.isError && (
        <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30">
          <p className="text-sm text-red-200">
            {createTask.error?.message ?? 'Kunne ikke oprette opgave'}
          </p>
        </div>
      )}
      {error && (
        <div className="mb-4 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <p className="text-sm text-amber-200 mb-2">
            Kunne ikke hente kalender. Giv kalendertilladelse ved at logge ind igen.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => signIn('google', { callbackUrl: '/calendar', prompt: 'consent' })}
              className="text-sm text-app-accent hover:underline font-medium"
            >
              Log ind igen med kalendertilladelse
            </button>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="text-sm text-app-muted hover:text-slate-200"
            >
              Log ud
            </button>
          </div>
        </div>
      )}
      {isLoading ? (
        <p className="text-sm text-app-muted">Henter events...</p>
      ) : (
        <div className="space-y-8">
          {(() => {
            const byDay = new Map<string, CalendarEvent[]>()
            for (const e of events) {
              const key = getDateKey(e.start)
              if (!key) continue
              const list = byDay.get(key) ?? []
              list.push(e)
              byDay.set(key, list)
            }
            const today = new Date()
            const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
            const sortedKeys = Array.from(byDay.keys()).sort()
            const pastKeys = sortedKeys.filter((k) => k < todayKey)
            const futureKeys = sortedKeys.filter((k) => k >= todayKey)

            const renderDaySection = (dateKey: string) => (
              <section key={dateKey} className="rounded-xl2 app-surface-gradient px-4 py-4">
                <h2 className="text-base font-semibold text-slate-100 mb-3 pb-2 border-b border-white/15">
                  {formatDayLabel(dateKey)}
                </h2>
                <ul className="divide-y divide-white/5">
                  {byDay.get(dateKey)!.map((e) => {
                    const eventEnd = e.end ? new Date(e.end) : e.start ? new Date(e.start) : null
                    const isPastEvent = eventEnd ? eventEnd < new Date() : false
                    return (
                      <li
                        key={e.id}
                        className="flex items-start gap-4 py-4 first:pt-0 last:pb-0 group"
                      >
                        <span className="text-xs font-medium text-app-muted shrink-0 w-16 tabular-nums">
                          {formatTimeRange(e.start, e.end)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-100">{e.summary}</p>
                          {e.attendees && e.attendees.length > 0 && (
                            <p className="text-xs text-slate-400 mt-0.5 truncate">
                              {e.attendees
                                .map((a) => a.displayName || a.email || '')
                                .filter(Boolean)
                                .join(', ')}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          {!isPastEvent && (
                            <button
                              type="button"
                              onClick={() => handleOpenPrep(e)}
                              disabled={createTask.isPending}
                              className="shrink-0 p-2 rounded-lg bg-emerald-700/80 text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors duration-200 ease-out active:scale-[0.98]"
                              title="Forberedelse"
                              aria-label="Forberedelse"
                            >
                              <IconClipboard />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenFollowUp(e)}
                            disabled={createTask.isPending}
                            className="shrink-0 p-2 rounded-lg border border-white/10 bg-white/5 text-app-muted hover:text-slate-200 hover:bg-white/10 disabled:opacity-50 transition-colors duration-200 ease-out"
                            title="Opfølgning"
                            aria-label="Opfølgning"
                          >
                            <IconPaperAirplane />
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )

            return (
              <>
                {pastKeys.length > 0 && (
                  <div className="border border-white/10 rounded-xl2 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setPastDaysOpen((o) => !o)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left app-input-gradient hover:opacity-90 transition-opacity duration-200"
                      aria-expanded={pastDaysOpen}
                    >
                      <span className="text-sm font-medium text-slate-100">
                        Tidligere dage ({pastKeys.length} dag{pastKeys.length !== 1 ? 'e' : ''})
                      </span>
                      <svg
                        className={cn('w-5 h-5 text-app-muted shrink-0 transition-transform duration-200', pastDaysOpen && 'rotate-180')}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {pastDaysOpen && (
                      <div className="p-4 pt-4 space-y-6 border-t border-white/5">
                        {pastKeys.map(renderDaySection)}
                      </div>
                    )}
                  </div>
                )}
                {futureKeys.map(renderDaySection)}
              </>
            )
          })()}
        </div>
      )}

      {/* Modal: indtast besked før oprettelse */}
      {creatingFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-[modalOverlayIn_200ms_ease-out_forwards]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-task-modal-title"
          onClick={() => !createTask.isPending && setCreatingFor(null)}
        >
          <div
            className="app-card-gradient rounded-lg shadow-hover border border-white/10 w-full max-w-lg p-5 animate-[modalContentIn_250ms_ease-out_forwards]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="create-task-modal-title"
              className="text-lg font-semibold text-slate-100 mb-1"
            >
              {creatingFor.type === 'prep' ? 'Forberedelse' : 'Opfølgning'}
            </h3>
            <p className="text-xs text-app-muted mb-3">
              {creatingFor.event.summary}
            </p>
            {creatingFor.type === 'followup' && (
              <div className="mb-4">
                <label htmlFor="followup-time-frame" className="block text-sm font-medium text-slate-200 mb-2">
                  Hvor lang tid har du til opfølgningen?
                </label>
                <div className="flex flex-wrap gap-2">
                  {FOLLOW_UP_TIME_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      id={opt.value === followUpTimeFrame ? 'followup-time-frame' : undefined}
                      onClick={() => {
                        setFollowUpTimeFrame(opt.value)
                        setFollowUpTimeCustom('')
                      }}
                      className={cn(
                        'px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200',
                        followUpTimeFrame === opt.value
                          ? 'bg-app-accent text-white'
                          : 'border border-white/10 text-slate-300 hover:text-white hover:bg-white/5'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-app-muted">Eller:</span>
                  <input
                    type="text"
                    value={followUpTimeCustom}
                    onChange={(e) => {
                      setFollowUpTimeCustom(e.target.value)
                      if (e.target.value.trim()) setFollowUpTimeFrame('')
                    }}
                    placeholder="fx 3 dage, inden fredag..."
                    className="flex-1 min-w-0 app-input-gradient border border-white/10 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder:text-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent/40"
                  />
                </div>
              </div>
            )}
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  handleSubmitFromModal()
                }
              }}
              placeholder="Skriv din besked (som ved opgave fra Alle inputs)..."
              rows={4}
              className="w-full app-input-gradient border border-white/10 rounded-lg px-4 py-3 text-sm text-slate-200 placeholder:text-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent/40 resize-none mb-4"
              disabled={createTask.isPending}
            />
            <p className="text-xs text-app-muted mb-4">
              ⌘+Enter / Ctrl+Enter opretter; AI udfylder felter bagefter.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setCreatingFor(null)}
                disabled={createTask.isPending}
                className="px-4 py-2 text-sm text-slate-300 hover:text-white border border-white/10 rounded-lg transition-colors duration-200 ease-out disabled:opacity-50"
              >
                Annuller
              </button>
              <button
                type="button"
                onClick={handleSubmitFromModal}
                disabled={
                  !inputText.trim() ||
                  createTask.isPending ||
                  (creatingFor.type === 'followup' &&
                    !followUpTimeFrame.trim() &&
                    !followUpTimeCustom.trim())
                }
                className="px-4 py-2 text-sm font-medium bg-app-accent text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-colors duration-200 ease-out active:scale-[0.98]"
              >
                {createTask.isPending ? 'Opretter...' : 'Opret opgave'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
