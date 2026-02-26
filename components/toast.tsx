'use client'

import { createContext, useContext, useState, useCallback, useEffect } from 'react'

interface ToastState {
  message: string
  visible: boolean
}

const ToastContext = createContext<((message: string) => void) | null>(null)

export function useToast() {
  const show = useContext(ToastContext)
  return show ?? (() => {})
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState>({ message: '', visible: false })

  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true })
  }, [])

  useEffect(() => {
    if (!toast.visible) return
    const t = setTimeout(() => setToast((s) => ({ ...s, visible: false })), 2500)
    return () => clearTimeout(t)
  }, [toast.visible])

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {toast.visible && (
        <div
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-4 rounded-lg bg-emerald-600/95 text-white shadow-hover border border-emerald-500/30"
          style={{
            animation: 'toastIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
          role="status"
          aria-live="polite"
        >
          <svg
            className="w-6 h-6 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
          <span className="font-medium">{toast.message}</span>
        </div>
      )}
    </ToastContext.Provider>
  )
}
