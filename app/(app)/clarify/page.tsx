'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { TaskOverlay } from '@/components/task-overlay'

const DURATION_BUCKETS = [
  { value: 'LT15', label: 'Under 15 min' },
  { value: 'M15_30', label: '15–30 min' },
  { value: 'M30_60', label: '30–60 min' },
  { value: 'GT60', label: 'Over 60 min' },
] as const

const DURATION_LABEL: Record<string, string> = Object.fromEntries(
  DURATION_BUCKETS.map((b) => [b.value, b.label])
)

function formatDeadline(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('da-DK', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

function useClarifyTasks() {
  return useQuery({
    queryKey: ['tasks', 'clarify'],
    queryFn: () => fetch('/api/tasks?view=clarify').then((r) => r.json()),
  })
}

type TaskForCard = {
  id: string
  title: string
  customer?: { name: string } | null
  durationBucket?: string | null
  reviewAt?: string | null
  tag?: string | null
  urgency?: number | null
}

export default function ClarifyPage() {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const { data: tasks = [], isLoading } = useClarifyTasks()

  return (
    <div>
      <h1 className="text-3xl font-semibold text-slate-100 mb-2">Clarify</h1>
      <p className="text-xs text-app-muted mb-6">
        Du har {tasks.length} opgaver der kan kvalificeres bedre.
      </p>

      {isLoading ? (
        <p className="text-sm text-app-muted">Henter...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(tasks as TaskForCard[]).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setSelectedTaskId(t.id)
              }}
              className="text-left bg-app-card rounded-xl2 p-5 shadow-card border border-white/5 transition-all duration-200 hover:shadow-hover hover:-translate-y-0.5 hover:border-white/10"
            >
              <p className="text-base font-medium text-slate-100">{t.title}</p>
              <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-app-muted">
                {t.customer?.name && (
                  <span>{t.customer.name}</span>
                )}
                {t.durationBucket && (
                  <span>{DURATION_LABEL[t.durationBucket] ?? t.durationBucket}</span>
                )}
                {t.reviewAt && (
                  <span>{formatDeadline(t.reviewAt)}</span>
                )}
              </div>
              {t.tag && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {t.tag.split(',').map((tag, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded bg-white/10 text-slate-300 text-xs"
                    >
                      {tag.trim()}
                    </span>
                  ))}
                </div>
              )}
            </button>
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
