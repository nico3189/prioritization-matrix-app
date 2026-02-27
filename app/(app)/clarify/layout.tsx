import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mangler afklaring',
}

export default function ClarifyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
