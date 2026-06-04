'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { closeTaskModal } from '@/lib/task-modal-navigation'

export function useCloseTask() {
	const router = useRouter()
	return useCallback(() => {
		closeTaskModal(router)
	}, [router])
}
