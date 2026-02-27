import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Historik',
}

export default function HistorikLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
