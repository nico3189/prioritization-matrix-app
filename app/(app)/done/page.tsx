'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { TaskOverlay } from '@/components/task-overlay'
import { TaskCard, type TaskCardTask } from '@/components/task-card'

function useDoneTasks() {
  return useQuery({
    queryKey: ['tasks', 'done'],
    queryFn: () => fetch('/api/tasks?status=done').then((r) => r.json()),
  })
}

export default function DonePage() {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const { data: tasks = [], isLoading } = useDoneTasks()

  return (
    <div>
      <h1 className="text-3xl font-semibold text-slate-100 mb-2">Udførte opgaver</h1>
      <p className="text-xs text-app-muted mb-6">
        Opgaver du har markeret som udførte.
      </p>
      {isLoading ? (
        <p className="text-sm text-app-muted">Henter...</p>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-slate-300">Ingen udførte opgaver endnu.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {tasks.map((task: TaskCardTask) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={() => setSelectedTaskId(task.id)}
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
