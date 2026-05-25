'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { getFaviconUrl } from '@/lib/link-favicon'

function IconLinkFallback({ className }: { className?: string }) {
	return (
		<svg
			className={className}
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			strokeWidth={2}
			aria-hidden
		>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
			/>
		</svg>
	)
}

interface LinkFaviconProps {
	url: string
	className?: string
}

/** Dynamisk favicon med link-ikon som fallback. */
export function LinkFavicon({ url, className }: LinkFaviconProps) {
	const [failed, setFailed] = useState(false)
	const src = getFaviconUrl(url)

	if (!src || failed) {
		return (
			<IconLinkFallback
				className={cn('w-4 h-4 shrink-0 text-app-muted', className)}
			/>
		)
	}

	return (
		<img
			src={src}
			alt=""
			width={16}
			height={16}
			className={cn('w-4 h-4 shrink-0 rounded-sm object-contain', className)}
			onError={() => setFailed(true)}
			loading="lazy"
			decoding="async"
		/>
	)
}
