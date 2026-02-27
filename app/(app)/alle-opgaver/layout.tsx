import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Alle opgaver',
}

export default function AlleOpgaverLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
