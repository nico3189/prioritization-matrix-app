import type { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Udviklingsliste',
}

export default function UdviklingLayout({
	children,
}: {
	children: React.ReactNode
}) {
	return children
}
