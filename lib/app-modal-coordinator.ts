'use client'

export type AppModalId = 'task' | 'addTask'

const MODAL_TRANSITION_MS = 200

const closers: Partial<Record<AppModalId, () => void>> = {}

export function getModalTransitionMs() {
	return MODAL_TRANSITION_MS
}

export function registerAppModalCloser(
	id: AppModalId,
	close: (() => void) | null
) {
	if (close) closers[id] = close
	else delete closers[id]
}

export function closeAppModal(id: AppModalId) {
	closers[id]?.()
}

export function isAppModalRegistered(id: AppModalId) {
	return Boolean(closers[id])
}

export function closeAppModalsExcept(keep: AppModalId) {
	;(Object.keys(closers) as AppModalId[]).forEach((id) => {
		if (id !== keep) closers[id]?.()
	})
}
