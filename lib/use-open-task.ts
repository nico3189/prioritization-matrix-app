'use client'

import { useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
	openTaskModal,
	rememberTaskModalReturn,
} from '@/lib/task-modal-navigation'

export function useOpenTaskModal() {
	const router = useRouter()
	const pathname = usePathname()

	return useCallback(
		(taskId: string, options?: { replace?: boolean }) => {
			if (!options?.replace) {
				rememberTaskModalReturn(pathname)
			}
			openTaskModal(router, taskId, options)
		},
		[router, pathname]
	)
}
