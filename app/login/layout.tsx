import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Log ind',
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
