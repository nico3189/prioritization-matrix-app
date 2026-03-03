import type { Metadata } from 'next'
import { SettingsNav } from './_components/settings-nav'

export const metadata: Metadata = {
  title: 'Indstillinger',
}

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col lg:flex-row gap-8 min-w-0 max-w-full">
      <SettingsNav />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}
