'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const SETTINGS_NAV = [
  { href: '/settings/arbejdstider', label: 'Arbejdstider' },
  { href: '/settings/prioriteringsfaktorer', label: 'Prioriteringsfaktorer' },
  { href: '/settings/api', label: 'API-nøgle' },
  { href: '/settings/kunder', label: 'Kunder' },
  { href: '/settings/teammedlemmer', label: 'Teammedlemmer' },
  { href: '/settings/tags', label: 'Tags' },
]

export function SettingsNav() {
  const pathname = usePathname()

  return (
    <nav
      className="shrink-0 lg:w-52 flex flex-row lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0"
      aria-label="Indstillinger undermenu"
    >
      {SETTINGS_NAV.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors duration-200',
              isActive
                ? 'bg-app-accent/10 text-slate-100 font-medium'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
