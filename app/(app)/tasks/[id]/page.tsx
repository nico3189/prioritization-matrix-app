'use client'

import { useParams, useRouter } from 'next/navigation'
import { TaskOverlay } from '@/components/task-overlay'

export default function TaskPage() {
	const params = useParams()
	const router = useRouter()
	const id = typeof params.id === 'string' ? params.id : null

	if (!id) {
		return (
			<p className="text-sm text-app-muted">Ugyldig opgave.</p>
		)
	}

	return (
		<TaskOverlay
			taskId={id}
			onClose={() => router.push('/alle-opgaver')}
		/>
	)
}
