'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TaskOverlay } from '@/components/task-overlay'
import { TaskCard, type TaskCardTask } from '@/components/task-card'
import { getMatrixQuadrant, getScore, getEffectiveUrgency } from '@/lib/eisenhower'
import { useMarkTaskDone } from '@/lib/use-mark-task-done'
import { useToast } from '@/components/toast'

function useMatrixTasks() {
  return useQuery({
    queryKey: ['tasks', 'matrix'],
    queryFn: () => fetch('/api/tasks?view=matrix').then((r) => r.json()),
  })
}

const QUADRANTS = [
  { id: 'Q1', title: 'Opgaver der skal gøres nu' },
  { id: 'Q2', title: 'Opgaver der skal forberedes' },
  { id: 'Q3', title: 'Opgaver der skal delegeres' },
  { id: 'Q4', title: 'Opgaver der skal droppes eller genvurderes' },
] as const

export default function MatrixPage() {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [completingId, setCompletingId] = useState<string | null>(null)
  const showToast = useToast()
  const { data: tasks = [], isLoading } = useMatrixTasks()
  const markDone = useMarkTaskDone({
    onSuccess: () => {
      showToast('Opgave udført!')
      setTimeout(() => setCompletingId(null), 600)
    },
  })
  const byQuadrant = useMemo(() => {
    const map: Record<string, Array<{ importance?: number | null; urgency?: number | null; dueAt?: string | null; id: string; [k: string]: unknown }>> = { Q1: [], Q2: [], Q3: [], Q4: [] }
    ;(tasks as Array<{ importance?: number | null; urgency?: number | null; dueAt?: string | null; durationBucket?: string | null; delegatedToId?: string | null; delegatedTo?: { name?: string } | null; id: string; [k: string]: unknown }>).forEach((t) => {
      const q = getMatrixQuadrant(t)
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
      <h1 className="text-3xl font-semibold text-slate-100 mb-2">Matrix</h1>
      <p className="text-xs text-app-muted mb-6">Matrix Q1–Q4. Klik for at redigere.</p>
      {isLoading ? (
        <p className="text-sm text-app-muted">Henter...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {QUADRANTS.map((q) => (
            <div key={q.id} className="app-surface-gradient rounded-xl2 p-4 border border-white/5">
              <h2 className="text-lg font-medium text-slate-200 mb-4">
                {q.id}: {q.title}
              </h2>
              <ul className="space-y-3">
                {byQuadrant[q.id].map((task) => {
                  const t = task as unknown as TaskCardTask
                  return (
                    <li key={t.id}>
                      <TaskCard
                        task={t}
                        onClick={() => setSelectedTaskId(t.id)}
                        onMarkDone={() => {
                          setCompletingId(t.id)
                          markDone.mutate(t.id)
                        }}
                        isCompleting={completingId === t.id}
                      />
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
