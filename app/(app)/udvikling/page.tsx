'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
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

function useUdviklingTasks() {
	return useQuery({
		queryKey: ['tasks', 'udvikling'],
		queryFn: () => fetch('/api/tasks?view=udvikling').then((r) => r.json()),
	})
}

export default function UdviklingPage() {
	const router = useRouter()
	const [completingId, setCompletingId] = useState<string | null>(null)
	const [sortBy, setSortBy] = useState<SortOption>('newest')
	const [filters, setFilters] = useState<TaskListFilters>(
		DEFAULT_TASK_LIST_FILTERS
	)
	const [searchQuery, setSearchQuery] = useState('')
	const [viewMode, setViewMode] = useTaskListViewMode()
	const showToast = useToast()
	const { data: tasks = [], isLoading } = useUdviklingTasks()
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
			<h1 className="text-3xl font-semibold text-slate-100 mb-2">
				Udviklingsliste
			</h1>
			<p className="text-xs text-app-muted mb-6">
				Idéer og udviklingspunkter — ikke en del af dagens to-do.
				{filteredTasks.length > 0 && ` ${filteredTasks.length} opgaver.`}
			</p>
			{isLoading ? (
				<p className="text-sm text-app-muted">Henter...</p>
			) : tasks.length === 0 ? (
				<p className="text-sm text-slate-300">
					Ingen opgaver på udviklingslisten. Brug ⋮ på en opgave og vælg
					&quot;På udviklingslisten&quot;, eller opret en idé som AI parkerer
					automatisk.
				</p>
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
							{filteredTasks.map((task) => (
								<TaskCard
									key={task.id}
									task={task as TaskCardTask}
									onClick={() => router.push(`/tasks/${task.id}`)}
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
		</div>
	)
}
