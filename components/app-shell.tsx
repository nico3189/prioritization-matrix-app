'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { AddTaskModalProvider } from '@/components/add-task-modal'

const iconClass = 'w-5 h-5 shrink-0'

function IconClock() {
  return (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function IconQuestion() {
  return (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function IconStar() {
  return (
    <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24">
      <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  )
}

function IconList() {
  return (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  )
}

function IconLightbulb() {
  return (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function IconCalendar() {
  return (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}

function IconCog() {
  return (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function IconLogout() {
  return (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  )
}

function IconChevronLeft() {
  return (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  )
}

function IconChevronRight() {
  return (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  )
}

const navItems = [
  { href: '/today', label: 'Fokusopgaver', icon: IconStar, iconColor: 'text-amber-400' },
  { href: '/clarify', label: 'Kræver handling', icon: IconQuestion, iconColor: 'text-orange-400' },
  { href: '/alle-opgaver', label: 'Alle opgaver', icon: IconList, iconColor: 'text-sky-400' },
  { href: '/udvikling', label: 'Udvikling', icon: IconLightbulb, iconColor: 'text-violet-400' },
  { href: '/done', label: 'Udførte', icon: IconCheck, iconColor: 'text-emerald-400' },
  { href: '/calendar', label: 'Kalender', icon: IconCalendar, iconColor: 'text-sky-400' },
]
const navItemsSecondary = [
  { href: '/historik', label: 'Historik', icon: IconClock, iconColor: 'text-app-muted' },
  { href: '/settings', label: 'Indstillinger', icon: IconCog, iconColor: 'text-slate-400' },
]

interface AppShellProps {
  user: { name?: string | null; email?: string | null; image?: string | null }
  children: React.ReactNode
}

function NavLinks({
  pathname,
  onNavigate,
  collapsed,
}: {
  pathname: string
  onNavigate?: () => void
  collapsed?: boolean
}) {
  const renderItem = (item: (typeof navItems)[0] | (typeof navItemsSecondary)[0]) => {
    const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
    const Icon = item.icon
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        title={collapsed ? item.label : undefined}
        className={cn(
          'flex items-center gap-3 rounded-lg text-sm transition-colors duration-200',
          collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2',
          isActive
            ? 'bg-app-accent/10 text-slate-100'
            : 'text-slate-300 hover:text-white hover:bg-white/5'
        )}
      >
        <span className={item.iconColor}>
          <Icon />
        </span>
        {!collapsed && <span>{item.label}</span>}
      </Link>
    )
  }
  return (
    <>
      {navItems.map(renderItem)}
      {!collapsed && <div className="my-2 border-t border-white/5" />}
      {navItemsSecondary.map(renderItem)}
    </>
  )
}

const MENU_ANIMATION_MS = 250
const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed'

export function AppShell({ user, children }: AppShellProps) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
    if (stored !== null) setSidebarCollapsed(stored === 'true')
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed))
  }, [sidebarCollapsed])

  const closeMenu = () => {
    if (!mobileMenuOpen) return
    setIsClosing(true)
    closeTimeoutRef.current = setTimeout(() => {
      setMobileMenuOpen(false)
      setIsClosing(false)
      closeTimeoutRef.current = null
    }, MENU_ANIMATION_MS)
  }

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current)
    }
  }, [])

  return (
    <AddTaskModalProvider>
    <div className="flex min-h-screen bg-transparent">
      {/* Desktop sidebar – fixed så den følger med ved scroll */}
      <aside
        className={cn(
          'hidden md:flex shrink-0 app-surface-gradient border-r border-white/5 flex-col fixed left-0 top-0 z-30 h-screen transition-[width] duration-200 ease-out overflow-hidden',
          sidebarCollapsed ? 'w-[64px]' : 'w-[260px]'
        )}
      >
        <div className={cn('border-b border-white/5 flex-shrink-0', sidebarCollapsed ? 'p-2' : 'p-4')}>
          <div className={cn('flex items-center gap-3', sidebarCollapsed && 'justify-center')}>
            {sidebarCollapsed ? (
              <button
                type="button"
                onClick={() => setSidebarCollapsed(false)}
                className="p-2 rounded-lg text-app-muted hover:text-white hover:bg-white/5 transition-colors duration-200"
                aria-label="Vis sidebar"
              >
                <IconChevronRight />
              </button>
            ) : (
              <>
                {user.image ? (
                  <Image
                    src={user.image}
                    alt=""
                    width={40}
                    height={40}
                    className="rounded-full shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full app-card-gradient border border-white/5 flex items-center justify-center text-app-muted text-sm shrink-0">
                    {user.name?.charAt(0) ?? '?'}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-100 truncate">
                    {user.name ?? 'Bruger'}
                  </p>
                  <p className="text-xs text-app-muted truncate">{user.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed(true)}
                  className="p-1.5 rounded-lg text-app-muted hover:text-white hover:bg-white/5 transition-colors duration-200 shrink-0"
                  aria-label="Skjul sidebar"
                >
                  <IconChevronLeft />
                </button>
              </>
            )}
          </div>
        </div>
        <nav className="flex-1 p-2 overflow-y-auto">
          <NavLinks pathname={pathname} collapsed={sidebarCollapsed} />
        </nav>
        <div className="p-2 border-t border-white/5">
          {sidebarCollapsed ? (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="p-2 rounded-lg text-app-muted hover:text-white hover:bg-white/5 transition-colors duration-200"
                title="Log ud"
                aria-label="Log ud"
              >
                <IconLogout />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:text-white transition-colors duration-200"
            >
              <IconLogout />
              Log ud
            </button>
          )}
        </div>
      </aside>

      {/* Mobile burger orb – bottom left */}
      <button
        type="button"
        onClick={() => setMobileMenuOpen(true)}
        className="md:hidden fixed bottom-6 left-6 z-40 w-14 h-14 rounded-full app-card-gradient border border-blue-700/40 shadow-card text-blue-400 hover:text-blue-300 hover:border-blue-600 flex items-center justify-center transition-all duration-200 ease-out active:scale-95"
        aria-label="Åbn menu"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <>
          <div
            className={cn(
              'md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm',
              isClosing
                ? 'animate-[menuOverlayOut_250ms_ease-out_forwards]'
                : 'animate-[menuOverlayIn_200ms_ease-out_forwards]'
            )}
            onClick={closeMenu}
            aria-hidden
          />
          <aside
            className={cn(
              'md:hidden fixed top-0 left-0 z-50 w-[260px] max-w-[85vw] h-full app-surface-gradient border-r border-white/10 shadow-xl flex flex-col',
              isClosing
                ? 'animate-[menuDrawerOut_250ms_ease-out_forwards]'
                : 'animate-[menuDrawerIn_250ms_ease-out_forwards]'
            )}
          >
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <div className="flex items-center gap-3 min-w-0">
                {user.image ? (
                  <Image
                    src={user.image}
                    alt=""
                    width={40}
                    height={40}
                    className="rounded-full shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full app-card-gradient border border-white/5 flex items-center justify-center text-app-muted text-sm shrink-0">
                    {user.name?.charAt(0) ?? '?'}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-100 truncate">
                    {user.name ?? 'Bruger'}
                  </p>
                  <p className="text-xs text-app-muted truncate">{user.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeMenu}
                className="p-2 rounded-lg text-app-muted hover:text-white hover:bg-white/5 transition-colors duration-200 shrink-0"
                aria-label="Luk menu"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 p-2 overflow-y-auto">
              <NavLinks pathname={pathname} onNavigate={closeMenu} />
            </nav>
            <div className="p-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:text-white transition-colors duration-200"
              >
                <IconLogout />
                Log ud
              </button>
            </div>
          </aside>
        </>
      )}

      {/* Main content – margin-left så det ikke overlapper fixed sidebar */}
      <main
        className={cn(
          'flex-1 min-w-0 p-4 pb-20 md:pb-8 md:p-8 w-full transition-[margin] duration-200 ease-out',
          sidebarCollapsed ? 'md:ml-[64px]' : 'md:ml-[260px]'
        )}
      >
        <div className="w-full max-w-screen-2xl mx-auto">
          {children}
        </div>
      </main>
    </div>
    </AddTaskModalProvider>
  )
}
