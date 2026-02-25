'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

function useCalendarEvents() {
  const now = new Date()
  const in14 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
  return useQuery({
    queryKey: ['calendar', 'events'],
    queryFn: () =>
      fetch(
        `/api/calendar/events?timeMin=${now.toISOString()}&timeMax=${in14.toISOString()}`
      ).then((r) => r.json()),
  })
}

function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { rawText: string; [k: string]: unknown }) =>
      fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

export default function CalendarPage() {
  const { data: events = [], isLoading, error } = useCalendarEvents()
  const createTask = useCreateTask()
  const [creatingFor, setCreatingFor] = useState<{ id: string; type: 'prep' | 'followup'; title: string; start?: string; end?: string } | null>(null)

  const handlePrep = (e: { id: string; summary: string; start?: string; end?: string }) => {
    const startAt = e.start ? new Date(e.start) : null
    createTask.mutate(
      {
        rawText: `Prep: ${e.summary}`,
        linkedEventId: e.id,
        linkedEventType: 'prep',
        dueAt: startAt?.toISOString(),
        eventStartAt: startAt?.toISOString(),
        eventEndAt: e.end ? new Date(e.end).toISOString() : undefined,
      },
      { onSettled: () => setCreatingFor(null) }
    )
    setCreatingFor({ id: e.id, type: 'prep', title: e.summary, start: e.start, end: e.end })
  }

  const handleFollowUp = (e: { id: string; summary: string; start?: string; end?: string }) => {
    const endAt = e.end ? new Date(e.end) : null
    const reviewAt = endAt ? new Date(endAt.getTime() + 3 * 60 * 60 * 1000) : null
    createTask.mutate(
      {
        rawText: `Follow-up: ${e.summary}`,
        linkedEventId: e.id,
        linkedEventType: 'followup',
        reviewAt: reviewAt?.toISOString(),
        eventStartAt: e.start ? new Date(e.start).toISOString() : undefined,
        eventEndAt: e.end ? new Date(e.end).toISOString() : undefined,
      },
      { onSettled: () => setCreatingFor(null) }
    )
    setCreatingFor({ id: e.id, type: 'followup', title: e.summary, start: e.start, end: e.end })
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold text-slate-100 mb-2">Calendar</h1>
      <p className="text-xs text-app-muted mb-6">Kommende events og prep/follow-up opgaver.</p>
      {error && (
        <p className="text-sm text-app-danger mb-4">
          Kunne ikke hente kalender. Tjek at du har givet Calendar læseadgang ved log ind.
        </p>
      )}
      {isLoading ? (
        <p className="text-sm text-app-muted">Henter events...</p>
      ) : (
        <ul className="space-y-4">
          {events.map((e: { id: string; summary: string; start?: string; end?: string }) => (
            <li
              key={e.id}
              className="bg-app-card rounded-xl2 p-5 shadow-card border border-white/5 transition-all duration-200 hover:shadow-hover hover:-translate-y-0.5 hover:border-white/10"
            >
              <p className="text-base font-medium text-slate-100">{e.summary}</p>
              <p className="text-xs text-app-muted mt-1">
                {e.start ? new Date(e.start).toLocaleString('da-DK') : ''}
                {e.end ? ` – ${new Date(e.end).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}` : ''}
              </p>
              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => handlePrep(e)}
                  disabled={createTask.isPending}
                  className="bg-app-accent text-white px-3 py-1.5 rounded-lg text-sm font-medium shadow-md hover:opacity-90 disabled:opacity-50 transition"
                >
                  Create prep task
                </button>
                <button
                  type="button"
                  onClick={() => handleFollowUp(e)}
                  disabled={createTask.isPending}
                  className="text-slate-300 hover:text-white border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg text-sm transition"
                >
                  Create follow-up task
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
