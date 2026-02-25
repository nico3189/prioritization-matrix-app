'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { TaskOverlay } from '@/components/task-overlay'
import { getQuadrant, getScore, getEffectiveUrgency } from '@/lib/eisenhower'

function useMatrixTasks() {
  return useQuery({
    queryKey: ['tasks', 'matrix'],
    queryFn: () => fetch('/api/tasks?view=matrix').then((r) => r.json()),
  })
}

function useSyncUrgency() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      fetch('/api/tasks/sync-urgency', { method: 'POST' }).then(async (r) => {
        const data = await r.json()
        if (!r.ok) throw new Error(data?.error ?? 'Kunne ikke opdatere')
        return data as { ok: boolean; updated: number; total: number }
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

const QUADRANTS = [
  { id: 'Q1', title: 'Do now', importance: 60, urgency: 60 },
  { id: 'Q2', title: 'Schedule', importance: 60, urgency: 40 },
  { id: 'Q3', title: 'Delegate/Limit', importance: 40, urgency: 60 },
  { id: 'Q4', title: 'Drop/Backlog', importance: 40, urgency: 40 },
] as const

export default function MatrixPage() {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const { data: tasks = [], isLoading } = useMatrixTasks()
  const syncUrgency = useSyncUrgency()
  const byQuadrant = useMemo(() => {
    const map: Record<string, Array<{ importance?: number | null; urgency?: number | null; dueAt?: string | null; id: string; [k: string]: unknown }>> = { Q1: [], Q2: [], Q3: [], Q4: [] }
    ;(tasks as Array<{ importance?: number | null; urgency?: number | null; dueAt?: string | null; id: string; [k: string]: unknown }>).forEach((t) => {
      const imp = t.importance ?? 0
      const effectiveUrg = getEffectiveUrgency(t.urgency ?? 0, t.dueAt ?? null)
      const q = getQuadrant(imp, effectiveUrg)
      map[q].push(t)
    })
    QUADRANTS.forEach((q) => {
      map[q.id].sort((a, b) => {
        const impA = a.importance ?? 0
        const impB = b.importance ?? 0
        const urgA = getEffectiveUrgency(a.urgency ?? 0, a.dueAt ?? null)
        const urgB = getEffectiveUrgency(b.urgency ?? 0, b.dueAt ?? null)
        return getScore(impB, urgB) - getScore(impA, urgA)
      })
    })
    return map
  }, [tasks])

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-slate-100 mb-2">Matrix</h1>
          <p className="text-xs text-app-muted">Eisenhower Q1–Q4. Klik for at redigere.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSyncMessage(null)
            syncUrgency.mutate(undefined, {
              onSuccess: (data) => {
                if (data.updated > 0) {
                  setSyncMessage(`Hastegrad opdateret for ${data.updated} opgave${data.updated !== 1 ? 'r' : ''}.`)
                } else {
                  setSyncMessage('Prioritering er ajour.')
                }
              },
            })
          }}
          disabled={syncUrgency.isPending}
          className="text-sm text-app-muted hover:text-slate-200 transition disabled:opacity-50"
        >
          {syncUrgency.isPending ? 'Opdaterer...' : 'Opdater nu'}
        </button>
      </div>
      {syncMessage && (
        <p className="text-sm text-amber-400 mb-4">{syncMessage}</p>
      )}
      {isLoading ? (
        <p className="text-sm text-app-muted">Henter...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {QUADRANTS.map((q) => (
            <div key={q.id} className="bg-app-surface rounded-xl2 p-4 border border-white/5">
              <h2 className="text-lg font-medium text-slate-200 mb-4">
                {q.id}: {q.title}
              </h2>
              <ul className="space-y-3">
                {byQuadrant[q.id].map((task) => {
                  const t = task as {
                    id: string
                    title: string
                    nextAction?: string | null
                    importance?: number | null
                    urgency?: number | null
                    dueAt?: string | null
                  }
                  const effUrg = getEffectiveUrgency(t.urgency ?? 0, t.dueAt ?? null)
                  const score = getScore(t.importance ?? 0, effUrg)
                  return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setSelectedTaskId(t.id)
                      }}
                      className="block w-full text-left bg-app-card rounded-lg p-4 shadow-card border border-white/5 transition-all duration-200 hover:shadow-hover hover:-translate-y-0.5 hover:border-white/10"
                    >
                      <p className="text-base font-medium text-slate-100">{t.title}</p>
                      {t.nextAction && (
                        <p className="text-sm text-slate-300 mt-1 line-clamp-1">{t.nextAction}</p>
                      )}
                      <p className="text-xs text-app-muted mt-1">
                        Score: {score.toFixed(0)} (deadline tæller med)
                      </p>
                    </button>
                  </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      <TaskOverlay
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
      />
    </div>
  )
}
