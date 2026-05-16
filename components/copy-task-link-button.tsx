'use client'

import { getTaskUrl } from '@/lib/task-url'
import { useToast } from '@/components/toast'
import { cn } from '@/lib/utils'

export async function copyTaskUrl(
	taskId: string,
	onCopied?: (url: string) => void
) {
	const url = getTaskUrl(taskId)
	await navigator.clipboard.writeText(url)
	onCopied?.(url)
}

function IconLink({ className }: { className?: string }) {
	return (
		<svg
			className={cn('w-4 h-4', className)}
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			strokeWidth={2}
		>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
			/>
		</svg>
	)
}

export interface CopyTaskLinkButtonProps {
	taskId: string
	onCopied?: (url: string) => void
	className?: string
	iconClassName?: string
}

export function CopyTaskLinkButton({
	taskId,
	onCopied,
	className,
	iconClassName,
}: CopyTaskLinkButtonProps) {
	const showToast = useToast()

	return (
		<button
			type="button"
			onClick={(e) => {
				e.stopPropagation()
				e.preventDefault()
				void copyTaskUrl(
					taskId,
					onCopied ?? (() => showToast('Link kopieret'))
				)
			}}
			className={cn(
				'p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors duration-200 ease-out active:scale-95',
				className
			)}
			aria-label="Kopiér link til opgave"
		>
			<IconLink className={iconClassName} />
		</button>
	)
}
