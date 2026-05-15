'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { TaskOverlay } from '@/components/task-overlay'
import { TaskCard, type TaskCardTask } from '@/components/task-card'
import { TaskTable } from '@/components/task-table'
import { useMarkTaskDone } from '@/lib/use-mark-task-done'
import { useToast } from '@/components/toast'
import {
  TaskListFiltersBar,
  useFilteredAndSortedTasks,
  useTaskListViewMode,
  DEFAULT_TASK_LIST_FILTERS,
  type SortOption,
  type TaskListFilters,
} from '@/components/task-list-filters'

function useAlleOpgaverTasks() {
  return useQuery({
    queryKey: ['tasks', 'alle-opgaver'],
    queryFn: () => fetch('/api/tasks/today').then((r) => r.json()),
  })
}

export default function AlleOpgaverPage() {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [completingId, setCompletingId] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortOption>('priority')
  const [filters, setFilters] = useState<TaskListFilters>(DEFAULT_TASK_LIST_FILTERS)
  const [viewMode, setViewMode] = useTaskListViewMode()
  const showToast = useToast()
  const { data: tasks = [], isLoading } = useAlleOpgaverTasks()
  const filteredTasks = useFilteredAndSortedTasks(tasks, sortBy, filters)

  const markDone = useMarkTaskDone({
    onSuccess: () => {
      showToast('Opgave udført!')
      setTimeout(() => setCompletingId(null), 600)
    },
  })

  return (
    <div>
      <h1 className="text-3xl font-semibold text-slate-100 mb-2">Alle opgaver</h1>
      <p className="text-xs text-app-muted mb-6">
        {filteredTasks.length === 0
          ? 'Ingen opgaver.'
          : `${filteredTasks.length} opgaver.`}
      </p>
      {isLoading ? (
        <p className="text-sm text-app-muted">Henter...</p>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-slate-300">Ingen opgaver. Tilføj en opgave ovenfor.</p>
      ) : (
        <>
          <TaskListFiltersBar
            sortBy={sortBy}
            onSortChange={setSortBy}
            filters={filters}
            onFiltersChange={setFilters}
            tasks={tasks}
            resultCount={filteredTasks.length}
            totalCount={tasks.length}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
          {viewMode === 'table' ? (
            <TaskTable
              tasks={filteredTasks as TaskCardTask[]}
              onTaskClick={(t) => setSelectedTaskId(t.id)}
              onMarkDone={(t) => {
                setCompletingId(t.id)
                markDone.mutate(t.id)
              }}
              completingId={completingId}
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task as TaskCardTask}
                  onClick={() => setSelectedTaskId(task.id)}
                  onMarkDone={() => {
                    setCompletingId(task.id)
                    markDone.mutate(task.id)
                  }}
                  isCompleting={completingId === task.id}
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
