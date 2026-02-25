'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'

const DURATION_BUCKETS = [
  { value: 'LT15', label: 'Under 15 min' },
  { value: 'M15_30', label: '15–30 min' },
  { value: 'M30_60', label: '30–60 min' },
  { value: 'GT60', label: 'Over 60 min' },
] as const

function useClarifyTasks() {
  return useQuery({
    queryKey: ['tasks', 'clarify'],
    queryFn: () => fetch('/api/tasks?view=clarify').then((r) => r.json()),
  })
}

function useTask(id: string | null) {
  return useQuery({
    queryKey: ['task', id],
    queryFn: () => fetch(`/api/tasks/${id}`).then((r) => r.json()),
    enabled: !!id,
  })
}

function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; [k: string]: unknown }) =>
      fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: (_data) => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['task', _data.id] })
    },
  })
}

export default function ClarifyPage() {
  const searchParams = useSearchParams()
  const taskId = searchParams.get('id')
  const { data: tasks = [], isLoading } = useClarifyTasks()
  const { data: task, isLoading: taskLoading } = useTask(taskId)
  const updateTask = useUpdateTask()
  const [durationBucket, setDurationBucket] = useState<string>('')

  const currentBucket = (task?.durationBucket ?? durationBucket) || ''

  return (
    <div>
      <h1 className="text-3xl font-semibold text-slate-100 mb-2">Clarify</h1>
      <p className="text-xs text-app-muted mb-6">
        Du har {tasks.length} opgaver der kan kvalificeres bedre.
      </p>

      {taskId ? (
        <div className="space-y-6">
          {taskLoading ? (
            <p className="text-sm text-app-muted">Henter opgave...</p>
          ) : task ? (
            <>
              <div className="bg-app-card rounded-xl2 p-5 shadow-card border border-white/5">
                <h2 className="text-base font-medium text-slate-100 mb-2">{task.title}</h2>
                {task.notes && (
                  <p className="text-sm text-slate-300 mb-4">{task.notes}</p>
                )}
                <p className="text-xs text-app-muted">
                  Importance: {task.importance ?? '–'} / Urgency: {task.urgency ?? '–'}
                  {task.nextAction && ` · ${task.nextAction}`}
                </p>
              </div>
              <div className="bg-app-surface rounded-xl2 p-5 border border-white/5">
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Varighed (påkrævet for qualified)
                </label>
                <select
                  value={currentBucket}
                  onChange={(e) => setDurationBucket(e.target.value)}
                  className="w-full max-w-xs bg-slate-900/60 border border-white/5 rounded-lg px-4 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-app-accent/40"
                >
                  <option value="">Vælg...</option>
                  {DURATION_BUCKETS.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!currentBucket || updateTask.isPending}
                  onClick={() =>
                    updateTask.mutate({
                      id: task.id,
                      durationBucket: currentBucket,
                      status: 'qualified',
                    })
                  }
                  className="mt-4 bg-app-accent text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md hover:opacity-90 disabled:opacity-50 transition"
                >
                  Mark as qualified
                </button>
              </div>
              <Link
                href="/clarify"
                className="text-sm text-app-muted hover:text-slate-300 transition"
              >
                ← Tilbage til listen
              </Link>
            </>
          ) : (
            <p className="text-sm text-app-muted">Opgave ikke fundet.</p>
          )}
        </div>
      ) : (
        <ul className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-app-muted">Henter...</p>
          ) : (
            tasks.map((t: { id: string; title: string; nextAction?: string | null }) => (
              <li key={t.id}>
                <Link
                  href={`/clarify?id=${t.id}`}
                  className="block bg-app-card rounded-xl2 p-5 shadow-card border border-white/5 transition-all duration-200 hover:shadow-hover hover:-translate-y-0.5 hover:border-white/10"
                >
                  <p className="text-base font-medium text-slate-100">{t.title}</p>
                  {t.nextAction && (
                    <p className="text-sm text-slate-300 mt-1">{t.nextAction}</p>
                  )}
                </Link>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
