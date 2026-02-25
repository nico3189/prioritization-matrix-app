'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

function useInboxTasks() {
  return useQuery({
    queryKey: ['tasks', 'inbox'],
    queryFn: () => fetch('/api/tasks').then((r) => r.json()),
  })
}

function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (rawText: string) =>
      fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText }),
      }).then((r) => r.json()),
    onSuccess: (task) => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      return fetch(`/api/tasks/${task.id}/parse`, { method: 'POST' }).then(() => {
        qc.invalidateQueries({ queryKey: ['tasks'] })
      })
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
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const { data: tasks = [], isLoading, refetch } = useInboxTasks()
  const createTask = useCreateTask()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = () => {
    const raw = input.trim()
    if (!raw || createTask.isPending) return
    createTask.mutate(raw, {
      onSuccess: () => setInput(''),
    })
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold text-slate-100 mb-2">Inbox</h1>
      <p className="text-xs text-app-muted mb-6">Lynhurtig capture. Enter = opret opgave.</p>

      <div className="mb-6">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit()
            }
          }}
          placeholder="Skriv eller indsæt en opgave (Enter = opret)"
          rows={2}
          className="w-full bg-slate-900/60 border border-white/5 rounded-lg px-4 py-3 text-sm text-slate-200 placeholder:text-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent/40 resize-none"
          disabled={createTask.isPending}
        />
        <p className="text-xs text-app-muted mt-1">Enter opretter øjeblikkeligt; AI parser kører derefter.</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-app-muted">Henter opgaver...</p>
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
              <Link
                href={`/clarify?id=${task.id}`}
                className="block bg-app-card rounded-xl2 p-5 shadow-card border border-white/5 transition-all duration-200 hover:shadow-hover hover:-translate-y-0.5 hover:border-white/10"
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
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
