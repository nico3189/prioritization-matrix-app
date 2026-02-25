'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { TaskOverlay } from '@/components/task-overlay'

function useTodayTasks() {
  return useQuery({
    queryKey: ['tasks', 'today'],
    queryFn: () => fetch('/api/tasks/today').then((r) => r.json()),
  })
}

export default function TodayPage() {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const { data: tasks = [], isLoading } = useTodayTasks()

  return (
    <div>
      <h1 className="text-3xl font-semibold text-slate-100 mb-2">Today</h1>
      <p className="text-xs text-app-muted mb-6">Max 5 fokusopgaver.</p>
      {isLoading ? (
        <p className="text-sm text-app-muted">Henter...</p>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-slate-300">Ingen opgaver i dag. Brug Matrix eller Inbox.</p>
      ) : (
        <ul className="space-y-4">
          {tasks.map((task: {
            id: string
            title: string
            nextAction?: string | null
            dueAt?: string | null
            importance?: number | null
            urgency?: number | null
          }) => (
            <li key={task.id}>
              <button
                type="button"
                onClick={() => setSelectedTaskId(task.id)}
                className="block w-full text-left bg-app-card rounded-xl2 p-5 shadow-card border border-white/5 transition-all duration-200 hover:shadow-hover hover:-translate-y-0.5 hover:border-white/10"
              >
                <p className="text-base font-medium text-slate-100">{task.title}</p>
                {task.nextAction && (
                  <p className="text-sm text-slate-300 mt-1">{task.nextAction}</p>
                )}
                <p className="text-xs text-app-muted mt-2">
                  {task.dueAt
                    ? new Date(task.dueAt).toLocaleString('da-DK')
                    : `I/U: ${task.importance ?? 0}/${task.urgency ?? 0}`}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      <TaskOverlay
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
      />
    </div>
  )
}
