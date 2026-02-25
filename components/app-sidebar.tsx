'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/inbox', label: 'Inbox' },
  { href: '/today', label: 'Today' },
  { href: '/matrix', label: 'Matrix' },
  { href: '/clarify', label: 'Clarify' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/settings', label: 'Settings' },
]

interface AppSidebarProps {
  user: { name?: string | null; email?: string | null; image?: string | null }
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="w-[260px] bg-app-surface border-r border-white/5 flex flex-col min-h-screen">
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          {user.image ? (
            <Image
              src={user.image}
              alt=""
              width={40}
              height={40}
              className="rounded-full"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-app-card border border-white/5 flex items-center justify-center text-app-muted text-sm">
              {user.name?.charAt(0) ?? '?'}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-100 truncate">
              {user.name ?? 'Bruger'}
            </p>
            <p className="text-xs text-app-muted truncate">{user.email}</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition duration-200',
                isActive
                  ? 'bg-app-accent/10 border-l-4 border-app-accent text-slate-100'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="p-2 border-t border-white/5">
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:text-white transition"
        >
          Log ud
        </button>
      </div>
    </aside>
  )
}
