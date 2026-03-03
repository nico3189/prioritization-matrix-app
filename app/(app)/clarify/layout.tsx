import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kræver handling',
}

export default function ClarifyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
