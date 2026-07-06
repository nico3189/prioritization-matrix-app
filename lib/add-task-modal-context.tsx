'use client'

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
	type ReactNode,
} from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { usePathname } from 'next/navigation'
import { useToast } from '@/components/toast'
import { notifyIntegrationHealthRefresh } from '@/components/integration-alerts'
import { cn } from '@/lib/utils'
import {
	closeAppModal,
	getModalTransitionMs,
	isAppModalRegistered,
	registerAppModalCloser,
} from '@/lib/app-modal-coordinator'

export interface OpenAddTaskModalOptions {
	dependencyIds?: string[]
	contextHint?: string
}

interface AddTaskModalContextValue {
	openAddTaskModal: (options?: OpenAddTaskModalOptions) => void
}

const AddTaskModalContext = createContext<AddTaskModalContextValue | null>(
	null
)

export function useAddTaskModal(): AddTaskModalContextValue {
	const ctx = useContext(AddTaskModalContext)
	if (!ctx) {
		throw new Error('useAddTaskModal skal bruges inden for AddTaskModalProvider')
	}
	return ctx
}

function useCreateTask() {
	const qc = useQueryClient()
	return useMutation({
		mutationFn: async (input: {
			rawText: string
			dependencyIds?: string[]
		}) => {
			const body: Record<string, unknown> = { rawText: input.rawText }
			if (input.dependencyIds?.length) {
				body.dependencyIds = input.dependencyIds
			}
			const createRes = await fetch('/api/tasks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			})
			const task = await createRes.json()
			if (!createRes.ok) {
				const detail =
					typeof task?.detail === 'string' ? ` (${task.detail})` : ''
				throw new Error(
					(task?.error ?? task?.message ?? `Fejl ${createRes.status}`) +
						detail
				)
			}
			return { task }
		},
		onSuccess: (data, variables) => {
			qc.invalidateQueries({ queryKey: ['tasks'] })
			qc.invalidateQueries({ queryKey: ['task', data.task.id] })
			const parentIds =
				variables.dependencyIds ??
				(
					data.task.dependencies as
						| Array<{ dependsOnTask: { id: string } }>
						| undefined
				)?.map((d) => d.dependsOnTask.id) ??
				[]
			parentIds.forEach((parentId) => {
				qc.invalidateQueries({ queryKey: ['task', parentId] })
			})
		},
		onSettled: () => {
			notifyIntegrationHealthRefresh()
		},
	})
}

function IconPlus() {
	return (
		<svg
			className="w-6 h-6"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			strokeWidth={2}
		>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				d="M12 4v16m8-8H4"
			/>
		</svg>
	)
}

export function AddTaskModalProvider({ children }: { children: ReactNode }) {
	const [open, setOpen] = useState(false)
	const [input, setInput] = useState('')
	const [isClosing, setIsClosing] = useState(false)
	const [pendingDependencyIds, setPendingDependencyIds] = useState<
		string[] | null
	>(null)
	const [contextHint, setContextHint] = useState<string | null>(null)
	const containerRef = useRef<HTMLDivElement>(null)
	const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const showToast = useToast()
	const createTask = useCreateTask()

	const clearCreateContext = useCallback(() => {
		setPendingDependencyIds(null)
		setContextHint(null)
	}, [])

	const forceCloseModal = useCallback(() => {
		if (closeTimeoutRef.current) {
			clearTimeout(closeTimeoutRef.current)
			closeTimeoutRef.current = null
		}
		setOpen(false)
		setIsClosing(false)
		clearCreateContext()
	}, [clearCreateContext])

	const showAddTaskModal = useCallback((options?: OpenAddTaskModalOptions) => {
		setIsClosing(false)
		setInput('')
		setPendingDependencyIds(options?.dependencyIds ?? null)
		setContextHint(options?.contextHint ?? null)
		setOpen(true)
	}, [])

	const openAddTaskModal = useCallback(
		(options?: OpenAddTaskModalOptions) => {
			const reveal = () => showAddTaskModal(options)
			if (open) {
				forceCloseModal()
				setTimeout(reveal, getModalTransitionMs())
				return
			}
			if (isAppModalRegistered('task')) {
				closeAppModal('task')
				setTimeout(reveal, getModalTransitionMs())
				return
			}
			reveal()
		},
		[open, forceCloseModal, showAddTaskModal]
	)

	const closeModal = useCallback(() => {
		if (!open) return
		setIsClosing(true)
		closeTimeoutRef.current = setTimeout(() => {
			forceCloseModal()
		}, getModalTransitionMs())
	}, [open, forceCloseModal])

	const pathname = usePathname()

	useEffect(() => {
		registerAppModalCloser('addTask', forceCloseModal)
		return () => registerAppModalCloser('addTask', null)
	}, [forceCloseModal])

	useEffect(() => {
		if (!pathname?.match(/^\/tasks\/[^/]+$/)) return
		forceCloseModal()
	}, [pathname, forceCloseModal])

	useEffect(() => {
		if (open && !isClosing) {
			const t = setTimeout(() => {
				containerRef.current
					?.querySelector<HTMLTextAreaElement>('textarea')
					?.focus()
			}, 50)
			return () => clearTimeout(t)
		}
	}, [open, isClosing])

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'n' || e.key === 'N') {
				if (open) return
				const target = e.target as HTMLElement
				const isInput =
					['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '') ||
					target?.isContentEditable
				if (!isInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
					e.preventDefault()
					openAddTaskModal()
				}
			}
			if (e.key === 'Escape' && open) {
				closeModal()
			}
		}
		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [open, openAddTaskModal, closeModal])

	useEffect(() => {
		return () => {
			if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current)
		}
	}, [])

	const handleSubmit = () => {
		const raw = input.trim()
		if (!raw || createTask.isPending) return
		const dependencyIds = pendingDependencyIds ?? undefined
		createTask.mutate(
			{ rawText: raw, dependencyIds },
			{
				onSuccess: () => {
					setInput('')
					showToast('Opgave oprettet')
					closeModal()
				},
				onError: (err) => {
					showToast(
						err instanceof Error
							? err.message
							: 'Kunne ikke oprette opgave'
					)
				},
			}
		)
	}

	return (
		<AddTaskModalContext.Provider value={{ openAddTaskModal }}>
			{children}
			<button
				type="button"
				onClick={() => openAddTaskModal()}
				className={cn(
					'fixed bottom-6 z-40 w-14 h-14 rounded-full app-card-gradient border border-blue-700/40 shadow-card text-blue-400 hover:text-blue-300 hover:border-blue-600 flex items-center justify-center transition-all duration-200 ease-out active:scale-95',
					'left-[88px] md:left-auto md:right-6'
				)}
				aria-label="Tilføj opgave (N)"
				title="Tilføj opgave (N)"
			>
				<IconPlus />
			</button>
			{open && (
				<>
					<div
						className={cn(
							'fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm',
							isClosing
								? 'animate-[modalOverlayOut_200ms_ease-out_forwards]'
								: 'animate-[modalOverlayIn_200ms_ease-out_forwards]'
						)}
						onClick={closeModal}
						aria-hidden
					/>
					<div
						className="fixed inset-0 z-[60] flex items-center justify-center p-4"
						onClick={(e) => {
							if (e.target === e.currentTarget) closeModal()
						}}
					>
						<div
							role="dialog"
							aria-modal="true"
							aria-labelledby="add-task-title"
							className={cn(
								'w-full max-w-2xl',
								isClosing
									? 'animate-[modalContentOut_200ms_ease-out_forwards]'
									: 'animate-[modalContentIn_200ms_ease-out_forwards]'
							)}
						>
							<div
								ref={containerRef}
								className="bg-app-card rounded-xl2 p-4 sm:p-8 shadow-card border border-white/5 max-w-[calc(100vw-2rem)]"
							>
								<h2
									id="add-task-title"
									className="text-xl font-medium text-slate-100 mb-2"
								>
									Tilføj opgave
								</h2>
								{contextHint && (
									<p className="text-sm text-app-muted mb-4">
										{contextHint}
									</p>
								)}
								{!contextHint && <div className="mb-4" />}
								<div className="flex flex-col gap-4">
									<textarea
										value={input}
										onChange={(e) => setInput(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
												e.preventDefault()
												handleSubmit()
											}
										}}
										placeholder="Skriv eller indsæt en opgave (⌘+Enter = opret)"
										rows={5}
										className="w-full min-w-0 bg-slate-900/60 border border-white/5 rounded-lg px-4 py-3 text-base sm:text-sm text-slate-200 placeholder:text-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent/40 resize-none"
										disabled={createTask.isPending}
									/>
									<div className="flex justify-end">
										<button
											type="button"
											onClick={handleSubmit}
											disabled={!input.trim() || createTask.isPending}
											className="bg-emerald-700 hover:bg-emerald-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium shadow-md active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
										>
											{createTask.isPending ? 'Opretter...' : 'Opret'}
										</button>
									</div>
								</div>
								{createTask.isError && (
									<p className="mt-2 text-sm text-app-danger">
										Kunne ikke oprette: {createTask.error?.message}
									</p>
								)}
							</div>
						</div>
					</div>
				</>
			)}
		</AddTaskModalContext.Provider>
	)
}
