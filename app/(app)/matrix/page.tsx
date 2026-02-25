'use client'

import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { TaskOverlay } from '@/components/task-overlay'

function useMatrixTasks() {
  return useQuery({
    queryKey: ['tasks', 'matrix'],
    queryFn: () => fetch('/api/tasks?view=matrix').then((r) => r.json()),
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
  const { data: tasks = [], isLoading } = useMatrixTasks()
  function getQuadrant(importance: number, urgency: number) {
    if (importance >= 60 && urgency >= 60) return 'Q1'
    if (importance >= 60 && urgency < 60) return 'Q2'
    if (importance < 60 && urgency >= 60) return 'Q3'
    return 'Q4'
  }
  const byQuadrant = useMemo(() => {
    const map: Record<string, typeof tasks> = { Q1: [], Q2: [], Q3: [], Q4: [] }
    tasks.forEach((t: { importance?: number | null; urgency?: number | null; id: string }) => {
      const imp = t.importance ?? 0
      const urg = t.urgency ?? 0
      const q = getQuadrant(imp, urg)
      map[q].push(t)
    })
    QUADRANTS.forEach((q) => {
      map[q.id].sort((a: { importance?: number | null; urgency?: number | null }, b: { importance?: number | null; urgency?: number | null }) => {
        const sa = 0.65 * (a.importance ?? 0) + 0.35 * (a.urgency ?? 0)
        const sb = 0.65 * (b.importance ?? 0) + 0.35 * (b.urgency ?? 0)
        return sb - sa
      })
    })
    return map
  }, [tasks])

  return (
    <div>
      <h1 className="text-3xl font-semibold text-slate-100 mb-2">Matrix</h1>
      <p className="text-xs text-app-muted mb-6">Eisenhower Q1–Q4. Klik for at redigere.</p>
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
                {byQuadrant[q.id].map((task: {
                  id: string
                  title: string
                  nextAction?: string | null
                  importance?: number | null
                  urgency?: number | null
                }) => (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedTaskId(task.id)}
                      className="block w-full text-left bg-app-card rounded-lg p-4 shadow-card border border-white/5 transition-all duration-200 hover:shadow-hover hover:-translate-y-0.5 hover:border-white/10"
                    >
                      <p className="text-base font-medium text-slate-100">{task.title}</p>
                      {task.nextAction && (
                        <p className="text-sm text-slate-300 mt-1 line-clamp-1">{task.nextAction}</p>
                      )}
                      <p className="text-xs text-app-muted mt-1">
                        Score: {(0.65 * (task.importance ?? 0) + 0.35 * (task.urgency ?? 0)).toFixed(0)}
                      </p>
                    </button>
                  </li>
                ))}
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
