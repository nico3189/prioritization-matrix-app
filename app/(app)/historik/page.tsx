'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { TaskOverlay } from '@/components/task-overlay'
import { TaskCard, type TaskCardTask } from '@/components/task-card'
import { TaskTable } from '@/components/task-table'
import {
  TaskListFiltersBar,
  useFilteredAndSortedTasks,
  useTaskListViewMode,
  type SortOption,
} from '@/components/task-list-filters'

function useHistorikTasks() {
  return useQuery({
    queryKey: ['tasks', 'historik'],
    queryFn: async () => {
      const r = await fetch('/api/tasks')
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error ?? `Fejl ${r.status}`)
      return data
    },
  })
}

export default function HistorikPage() {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useTaskListViewMode()
  const { data: tasks = [], isLoading, isError, error, refetch } = useHistorikTasks()
  const filteredTasks = useFilteredAndSortedTasks(tasks, sortBy, searchQuery)

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
      ) : tasks.length === 0 ? (
        <p className="text-sm text-slate-300">Ingen opgaver.</p>
      ) : (
        <>
          <TaskListFiltersBar
            sortBy={sortBy}
            onSortChange={setSortBy}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            resultCount={filteredTasks.length}
            totalCount={tasks.length}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
          {viewMode === 'table' ? (
            <TaskTable
              variant="historik"
              tasks={filteredTasks as TaskCardTask[]}
              onTaskClick={(t) => setSelectedTaskId(t.id)}
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  variant="historik"
                  task={task as TaskCardTask}
                  onClick={() => setSelectedTaskId(task.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      <TaskOverlay
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
      />
    </div>
  )
}
