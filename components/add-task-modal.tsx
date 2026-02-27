'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/toast'
import { cn } from '@/lib/utils'

function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (rawText: string) => {
      const createRes = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText }),
      })
      const task = await createRes.json()
      if (!createRes.ok) throw new Error(task?.error ?? task?.message ?? `Fejl ${createRes.status}`)
      fetch(`/api/tasks/${task.id}/parse`, { method: 'POST', keepalive: true })
      return { task }
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['task', data.task.id] })
    },
  })
}

function IconPlus() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  )
}

export function AddTaskModal() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [isClosing, setIsClosing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = useToast()
  const createTask = useCreateTask()

  const openModal = useCallback(() => {
    setOpen(true)
    setInput('')
  }, [])

  const closeModal = useCallback(() => {
    if (!open) return
    setIsClosing(true)
    closeTimeoutRef.current = setTimeout(() => {
      setOpen(false)
      setIsClosing(false)
      closeTimeoutRef.current = null
    }, 200)
  }, [open])

  useEffect(() => {
    if (open && !isClosing) {
      const t = setTimeout(() => {
        containerRef.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus()
      }, 50)
      return () => clearTimeout(t)
    }
  }, [open, isClosing])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'n' || e.key === 'N') {
        if (open) return
        const target = e.target as HTMLElement
        const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '') || target?.isContentEditable
        if (!isInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault()
          openModal()
        }
      }
      if (e.key === 'Escape') {
        closeModal()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, openModal, closeModal])

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current)
    }
  }, [])

  const handleSubmit = () => {
    const raw = input.trim()
    if (!raw || createTask.isPending) return
    createTask.mutate(raw, {
      onSuccess: () => {
        setInput('')
        showToast('Opgave oprettet. AI kvalificerer i baggrunden.')
        closeModal()
      },
    })
  }

  return (
    <>
      {/* Floating add button – right on desktop, left (next to burger) on mobile */}
      <button
        type="button"
        onClick={openModal}
        className={cn(
          'fixed bottom-6 z-40 w-14 h-14 rounded-full app-card-gradient border border-blue-700/40 shadow-card text-blue-400 hover:text-blue-300 hover:border-blue-600 flex items-center justify-center transition-all duration-200 ease-out active:scale-95',
          'left-[88px] md:left-auto md:right-6'
        )}
        aria-label="Tilføj opgave (N)"
        title="Tilføj opgave (N)"
      >
        <IconPlus />
      </button>

      {/* Modal */}
      {open && (
        <>
          <div
            className={cn(
              'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm',
              isClosing
                ? 'animate-[modalOverlayOut_200ms_ease-out_forwards]'
                : 'animate-[modalOverlayIn_200ms_ease-out_forwards]'
            )}
            onClick={closeModal}
            aria-hidden
          />
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeModal()
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-task-title"
              className={cn(
                'w-full max-w-2xl',
                isClosing
                  ? 'animate-[modalContentOut_200ms_ease-out_forwards]'
                  : 'animate-[modalContentIn_200ms_ease-out_forwards]'
              )}
            >
            <div
              ref={containerRef}
              className="bg-app-card rounded-xl2 p-8 shadow-card border border-white/5"
            >
              <h2 id="add-task-title" className="text-xl font-medium text-slate-100 mb-6">
                Tilføj opgave
              </h2>
              <div className="flex flex-col gap-4">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault()
                      handleSubmit()
                    }
                  }}
                  placeholder="Skriv eller indsæt en opgave (⌘+Enter = opret)"
                  rows={6}
                  className="w-full bg-slate-900/60 border border-white/5 rounded-lg px-4 py-3 text-sm text-slate-200 placeholder:text-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent/40 resize-none"
                  disabled={createTask.isPending}
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!input.trim() || createTask.isPending}
                    className="bg-emerald-700 hover:bg-emerald-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium shadow-md active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {createTask.isPending ? 'Opretter...' : 'Opret'}
                  </button>
                </div>
              </div>
              {createTask.isError && (
                <p className="mt-2 text-sm text-app-danger">
                  Kunne ikke oprette: {createTask.error?.message}
                </p>
              )}
            </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
