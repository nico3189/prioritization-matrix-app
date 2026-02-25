'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { TaskOverlay } from '@/components/task-overlay'

function useInboxTasks() {
  return useQuery({
    queryKey: ['tasks', 'inbox'],
    queryFn: async () => {
      const r = await fetch('/api/tasks')
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error ?? `Fejl ${r.status}`)
      return data
    },
  })
}

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
      let parseFailed = false
      let parseErrorDetail: string | null = null
      try {
        const parseRes = await fetch(`/api/tasks/${task.id}/parse`, { method: 'POST' })
        if (!parseRes.ok) {
          parseFailed = true
          const err = await parseRes.json().catch(() => ({}))
          parseErrorDetail = (err as { detail?: string; error?: string }).detail ?? (err as { detail?: string; error?: string }).error ?? null
          console.warn('AI parse failed:', err)
        }
      } catch (e) {
        parseFailed = true
        parseErrorDetail = e instanceof Error ? e.message : 'Netværksfejl'
        console.warn('AI parse error:', e)
      }
      return { task, parseFailed, parseErrorDetail }
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['task', data.task.id] })
    },
  })
}

const STATUS_LABEL: Record<string, string> = {
  inbox_raw: 'Raw',
  needs_clarification: 'Clarify',
  qualified: 'Qualified',
  done: 'Done',
  snoozed: 'Snoozed',
}

export default function InboxPage() {
  const [input, setInput] = useState('')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [parseMessage, setParseMessage] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const { data: tasks = [], isLoading, isError, error, refetch } = useInboxTasks()
  const createTask = useCreateTask()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = () => {
    const raw = input.trim()
    if (!raw || createTask.isPending) return
    setParseMessage(null)
    createTask.mutate(raw, {
      onSuccess: (data) => {
        setInput('')
        if (data.parseFailed) {
          const msg = data.parseErrorDetail
            ? `Opgave oprettet. AI: ${data.parseErrorDetail}`
            : 'Opgave oprettet. AI kunne ikke udfylde felterne – tjek OPENAI_API_KEY eller prøv igen.'
          setParseMessage(msg)
        }
      },
    })
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold text-slate-100 mb-2">Inbox</h1>
      <p className="text-xs text-app-muted mb-6">Lynhurtig capture. ⌘+Enter (Mac) / Ctrl+Enter (PC) = opret opgave.</p>

      <div className="mb-6">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              handleSubmit()
            }
          }}
          placeholder="Skriv eller indsæt en opgave (⌘+Enter / Ctrl+Enter = opret)"
          rows={2}
          className="w-full bg-slate-900/60 border border-white/5 rounded-lg px-4 py-3 text-sm text-slate-200 placeholder:text-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent/40 resize-none"
          disabled={createTask.isPending}
        />
        <p className="text-xs text-app-muted mt-1">
          {createTask.isPending
            ? 'Opretter og kvalificerer med AI...'
            : '⌘+Enter / Ctrl+Enter opretter opgave; AI udfylder felter.'}
        </p>
        {createTask.isError && (
          <p className="mt-2 text-sm text-app-danger">
            Kunne ikke oprette opgave: {createTask.error?.message}
          </p>
        )}
        {parseMessage && (
          <p className="mt-2 text-sm text-amber-400">{parseMessage}</p>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-app-muted">Henter opgaver...</p>
      ) : isError ? (
        <div className="rounded-lg border border-app-danger/30 bg-app-danger/10 p-4 text-sm text-slate-200">
          <p className="font-medium">Kunne ikke hente opgaver</p>
          <p className="mt-1 text-app-muted">{error?.message ?? 'Ukendt fejl'}</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 text-app-accent hover:underline"
          >
            Prøv igen
          </button>
        </div>
      ) : (
        <ul className="space-y-4">
          {tasks.map((task: {
            id: string
            title: string
            status: string
            createdAt: string
            nextAction?: string | null
          }) => (
            <li key={task.id}>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setSelectedTaskId(task.id)
                }}
                className="block w-full text-left bg-app-card rounded-xl2 p-5 shadow-card border border-white/5 transition-all duration-200 hover:shadow-hover hover:-translate-y-0.5 hover:border-white/10"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-medium text-slate-100">{task.title}</p>
                    {task.nextAction && (
                      <p className="text-sm text-slate-300 mt-1">{task.nextAction}</p>
                    )}
                  </div>
                  <span
                    className={cn(
                      'shrink-0 text-xs px-2 py-1 rounded',
                      task.status === 'inbox_raw' && 'bg-app-muted/20 text-app-muted',
                      task.status === 'needs_clarification' && 'bg-amber-500/20 text-amber-400',
                      task.status === 'qualified' && 'bg-app-success/20 text-app-success'
                    )}
                  >
                    {STATUS_LABEL[task.status] ?? task.status}
                  </span>
                </div>
                <p className="text-xs text-app-muted mt-2">
                  {new Date(task.createdAt).toLocaleDateString('da-DK')}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      <TaskOverlay
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
      />
    </div>
  )
}
