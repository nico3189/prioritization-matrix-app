'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { TaskOverlay } from '@/components/task-overlay'
import { TaskCard, type TaskCardTask } from '@/components/task-card'
import { useMarkTaskDone } from '@/lib/use-mark-task-done'
import { useToast } from '@/components/toast'

function useTodayTasks() {
  return useQuery({
    queryKey: ['tasks', 'today'],
    queryFn: () => fetch('/api/tasks/today').then((r) => r.json()),
  })
}

export default function TodayPage() {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [completingId, setCompletingId] = useState<string | null>(null)
  const showToast = useToast()
  const { data: tasks = [], isLoading } = useTodayTasks()
  const markDone = useMarkTaskDone({
    onSuccess: () => {
      showToast('Opgave udført!')
      setTimeout(() => setCompletingId(null), 600)
    },
  })

  return (
    <div>
      <h1 className="text-3xl font-semibold text-slate-100 mb-2">Fokusopgaver</h1>
      <p className="text-xs text-app-muted mb-6">6 fokusopgaver + 3 i kø.</p>
      {isLoading ? (
        <p className="text-sm text-app-muted">Henter...</p>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-slate-300">Ingen opgaver i dag. Brug Matrix eller Alle inputs.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {tasks.map((task: TaskCardTask & { greyedOutLevel?: 'subtle' | 'strong' }) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={() => setSelectedTaskId(task.id)}
              onMarkDone={() => {
                setCompletingId(task.id)
                markDone.mutate(task.id)
              }}
              isCompleting={completingId === task.id}
              greyedOutLevel={task.greyedOutLevel}
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
