'use client'

import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { closeAppModal } from '@/lib/app-modal-coordinator'

export const TASK_MODAL_RETURN_KEY = 'taskModalReturnPath'

const DEFAULT_RETURN = '/alle-opgaver'

/** Gem liste-side så lukning ikke åbner forrige opgave i historikken. */
export function rememberTaskModalReturn(pathname: string) {
	if (typeof window === 'undefined') return
	if (pathname.startsWith('/tasks/')) return
	sessionStorage.setItem(TASK_MODAL_RETURN_KEY, pathname)
}

export function openTaskModal(
	router: AppRouterInstance,
	taskId: string,
	options?: { replace?: boolean }
) {
	const href = `/tasks/${taskId}`
	if (options?.replace) router.replace(href)
	else router.push(href)
}

/** Luk opgavemodal og eventuelle andre app-modaler; gå tilbage til listen. */
export function closeTaskModal(router: AppRouterInstance) {
	closeAppModal('addTask')
	const returnPath =
		typeof window !== 'undefined'
			? sessionStorage.getItem(TASK_MODAL_RETURN_KEY) ?? DEFAULT_RETURN
			: DEFAULT_RETURN
	if (typeof window !== 'undefined') {
		sessionStorage.removeItem(TASK_MODAL_RETURN_KEY)
	}
	// back() lukker intercepting-modal korrekt; replace efter opgaveskift gør ikke
	if (typeof window !== 'undefined' && window.history.length > 1) {
		router.back()
		return
	}
	router.replace(returnPath)
}
