'use client'

import { useParams } from 'next/navigation'
import { TaskOverlay } from '@/components/task-overlay'
import { useCloseTask } from '@/lib/use-close-task'

export function TaskModalPage() {
	const params = useParams()
	const closeTask = useCloseTask()
	const id = typeof params.id === 'string' ? params.id : null

	if (!id) {
		return (
			<p className="text-sm text-app-muted">Ugyldig opgave.</p>
		)
	}

	return <TaskOverlay taskId={id} onClose={closeTask} />
}
