'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useOpenTaskModal } from '@/lib/use-open-task'
import { TaskCard, type TaskCardTask } from '@/components/task-card'
import { useMarkTaskDone } from '@/lib/use-mark-task-done'
import { useToast } from '@/components/toast'
import { getScore, getEffectiveUrgency } from '@/lib/eisenhower'

function useTodayTasks() {
  return useQuery({
    queryKey: ['tasks', 'today'],
    queryFn: () => fetch('/api/tasks/today').then((r) => r.json()),
  })
}

function sortByPriority<T extends { importance?: number | null; urgency?: number | null; dueAt?: string | Date | null }>(
  tasks: T[]
): T[] {
  return [...tasks].sort((a, b) => {
    const impA = a.importance ?? 0
    const impB = b.importance ?? 0
    const urgA = getEffectiveUrgency(a.urgency ?? 0, a.dueAt ?? null)
    const urgB = getEffectiveUrgency(b.urgency ?? 0, b.dueAt ?? null)
    return getScore(impB, urgB) - getScore(impA, urgA)
  })
}

export default function TodayPage() {
  const openTask = useOpenTaskModal()
  const [completingId, setCompletingId] = useState<string | null>(null)
  const showToast = useToast()
  const markDone = useMarkTaskDone({
    onSuccess: () => {
      showToast('Opgave udført!')
      setTimeout(() => setCompletingId(null), 600)
    },
  })
  const { data: tasks = [], isLoading } = useTodayTasks()
  const sortedTasks = useMemo(() => sortByPriority(tasks), [tasks])
  const displayTasks = useMemo(() => sortedTasks.slice(0, 4), [sortedTasks])
  const [primaryTask, ...nextTasks] = displayTasks

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-semibold text-slate-100 mb-2">Fokusopgaver</h1>
      <p className="text-xs text-app-muted mb-8">
        {tasks.length === 0
          ? 'Ingen opgaver.'
          : `${displayTasks.length} fokusopgaver i rangorden.`}
      </p>
      {isLoading ? (
        <p className="text-sm text-app-muted">Henter...</p>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-slate-300">
          Ingen opgaver i dag. Tilføj en opgave ovenfor.
        </p>
      ) : (
        <div className="space-y-8">
          {primaryTask && (
            <section>
              <p className="text-xs font-medium text-app-muted uppercase tracking-wider mb-3">
                Fokus nu
              </p>
              <TaskCard
                task={primaryTask as TaskCardTask}
                onClick={() => openTask((primaryTask as TaskCardTask).id)}
                onMarkDone={() => {
                  setCompletingId((primaryTask as TaskCardTask).id)
                  markDone.mutate((primaryTask as TaskCardTask).id)
                }}
                isCompleting={completingId === (primaryTask as TaskCardTask).id}
              />
            </section>
          )}

          {nextTasks.length > 0 && (
            <section>
              <p className="text-xs font-medium text-app-muted uppercase tracking-wider mb-3">
                Næste opgaver
              </p>
              <div className="grid grid-cols-1 gap-4">
                {nextTasks.map((task, idx) => {
                  const t = task as TaskCardTask
                  const opacityClass = ['opacity-75', 'opacity-60', 'opacity-50'][idx] ?? 'opacity-60'
                  return (
                  <div
                    key={t.id}
                    className={`${opacityClass} hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200 ease-out rounded-xl2`}
                  >
                    <TaskCard
                      task={t}
                      onClick={() => openTask(t.id)}
                      onMarkDone={() => {
                        setCompletingId(t.id)
                        markDone.mutate(t.id)
                      }}
                      isCompleting={completingId === t.id}
                    />
                  </div>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      )}

    </div>
  )
}
