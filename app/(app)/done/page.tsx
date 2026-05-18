'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TaskCard, type TaskCardTask } from '@/components/task-card'
import {
  TaskListFiltersBar,
  useFilteredAndSortedTasks,
  useTaskListViewMode,
  DEFAULT_TASK_LIST_FILTERS,
  type SortOption,
  type TaskListFilters,
} from '@/components/task-list-filters'
import { TaskTable } from '@/components/task-table'

function useDoneTasks() {
  return useQuery({
    queryKey: ['tasks', 'done'],
    queryFn: () => fetch('/api/tasks?status=done').then((r) => r.json()),
  })
}

export default function DonePage() {
  const router = useRouter()
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [filters, setFilters] = useState<TaskListFilters>(DEFAULT_TASK_LIST_FILTERS)
  const [viewMode, setViewMode] = useTaskListViewMode()
  const { data: tasks = [], isLoading } = useDoneTasks()
  const filteredTasks = useFilteredAndSortedTasks(tasks, sortBy, filters)

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
              onTaskClick={(t) => router.push(`/tasks/${t.id}`)}
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredTasks.map((task: TaskCardTask) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onClick={() => router.push(`/tasks/${task.id}`)}
                />
              ))}
            </div>
          )}
        </>
      )}

    </div>
  )
}
