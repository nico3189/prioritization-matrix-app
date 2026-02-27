'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { TaskOverlay } from '@/components/task-overlay'
import { TaskCard } from '@/components/task-card'
import { useMarkTaskDone } from '@/lib/use-mark-task-done'
import { useToast } from '@/components/toast'

function useHistorikTasks() {
  return useQuery({
    queryKey: ['tasks', 'inbox'],
    queryFn: async () => {
      const r = await fetch('/api/tasks')
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error ?? `Fejl ${r.status}`)
      return data
    },
    refetchInterval: (query) => {
      const data = query.state.data as Array<{ parseStatus?: string | null }> | undefined
      const hasParsing = data?.some((t) => t.parseStatus === 'parsing' || t.parseStatus === 'pending')
      return hasParsing ? 2000 : false
    },
  })
}

export default function HistorikPage() {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [completingId, setCompletingId] = useState<string | null>(null)
  const showToast = useToast()
  const { data: tasks = [], isLoading, isError, error, refetch } = useHistorikTasks()
  const markDone = useMarkTaskDone({
    onSuccess: () => {
      showToast('Opgave udført!')
      setTimeout(() => setCompletingId(null), 600)
    },
  })

  return (
    <div>
      <h1 className="text-3xl font-semibold text-slate-100 mb-6">Historik</h1>

      {isLoading ? (
        <p className="text-sm text-app-muted">Henter opgaver...</p>
      ) : isError ? (
        <div className="rounded-lg border border-app-danger/30 bg-app-danger/10 p-4 text-sm text-slate-200">
          <p className="font-medium">Kunne ikke hente opgaver</p>
          <p className="mt-1 text-app-muted">{error?.message ?? 'Ukendt fejl'}</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 text-app-accent hover:underline transition-colors duration-200"
          >
            Prøv igen
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {tasks.map((task: {
            id: string
            title: string
            status: string
            parseStatus?: string | null
            createdAt: string
            nextAction?: string | null
            notes?: string | null
            type?: string | null
            customer?: { name: string } | null
            delegatedTo?: { name: string } | null
            importance?: number | null
            urgency?: number | null
            dueAt?: string | null
            durationBucket?: string | null
            tag?: string | null
            }) => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={() => setSelectedTaskId(task.id)}
                onMarkDone={() => {
                  setCompletingId(task.id)
                  markDone.mutate(task.id)
                }}
                isCompleting={completingId === task.id}
                badge={
                  task.parseStatus === 'parsing' || task.parseStatus === 'pending' ? (
                    <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded bg-sky-500/20 text-sky-300">
                      <span className="inline-block w-3 h-3 border-2 border-sky-400/60 border-t-sky-300 rounded-full animate-spin" aria-hidden />
                      Kvalificerer…
                    </span>
                  ) : task.parseStatus === 'failed' ? (
                    <span className="text-xs px-2 py-1 rounded bg-amber-500/20 text-amber-400">
                      AI fejlede
                    </span>
                  ) : task.status === 'inbox_raw' ? (
                    <span className="text-xs px-2 py-1 rounded bg-app-muted/20 text-app-muted">
                      Ukvalificeret
                    </span>
                  ) : undefined
                }
              />
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
