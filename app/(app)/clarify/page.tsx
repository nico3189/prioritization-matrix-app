'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TaskCard, type TaskCardTask } from '@/components/task-card'
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
import { TaskTable } from '@/components/task-table'

function useClarifyTasks() {
  return useQuery({
    queryKey: ['tasks', 'clarify'],
    queryFn: () => fetch('/api/tasks?view=clarify').then((r) => r.json()),
  })
}

export default function ClarifyPage() {
  const router = useRouter()
  const [completingId, setCompletingId] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortOption>('oldest')
  const [filters, setFilters] = useState<TaskListFilters>(DEFAULT_TASK_LIST_FILTERS)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useTaskListViewMode()
  const showToast = useToast()
  const { data: tasks = [], isLoading } = useClarifyTasks()
  const filteredTasks = useFilteredAndSortedTasks(
    tasks,
    sortBy,
    filters,
    searchQuery
  )
  const markDone = useMarkTaskDone({
    onSuccess: () => {
      showToast('Opgave udført!')
      setTimeout(() => setCompletingId(null), 600)
    },
  })

  return (
    <div>
      <h1 className="text-3xl font-semibold text-slate-100 mb-2">Kræver handling</h1>
      <p className="text-xs text-app-muted mb-6">
        Du har {tasks.length} opgaver der kan kvalificeres bedre.
      </p>

      {isLoading ? (
        <p className="text-sm text-app-muted">Henter...</p>
      ) : (
        <>
          <TaskListFiltersBar
            sortBy={sortBy}
            onSortChange={setSortBy}
            filters={filters}
            onFiltersChange={setFilters}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
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
              onMarkDone={(t) => {
                setCompletingId(t.id)
                markDone.mutate(t.id)
              }}
              completingId={completingId}
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredTasks.map((t: TaskCardTask) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  onClick={() => router.push(`/tasks/${t.id}`)}
                  onMarkDone={() => {
                    setCompletingId(t.id)
                    markDone.mutate(t.id)
                  }}
                  isCompleting={completingId === t.id}
                />
              ))}
            </div>
          )}
        </>
      )}

    </div>
  )
}
