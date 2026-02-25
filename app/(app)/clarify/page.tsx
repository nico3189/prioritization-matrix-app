'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import Link from 'next/link'

const DURATION_BUCKETS = [
  { value: 'LT15', label: 'Under 15 min' },
  { value: 'M15_30', label: '15–30 min' },
  { value: 'M30_60', label: '30–60 min' },
  { value: 'GT60', label: 'Over 60 min' },
] as const

const inputClass =
  'w-full bg-slate-900/60 border border-white/5 rounded-lg px-4 py-2 text-sm text-slate-200 placeholder:text-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent/40'
const labelClass = 'block text-sm font-medium text-slate-200 mb-1'

function useClarifyTasks() {
  return useQuery({
    queryKey: ['tasks', 'clarify'],
    queryFn: () => fetch('/api/tasks?view=clarify').then((r) => r.json()),
  })
}

function useTask(id: string | null) {
  return useQuery({
    queryKey: ['task', id],
    queryFn: () => fetch(`/api/tasks/${id}`).then((r) => r.json()),
    enabled: !!id,
  })
}

function useCustomers(enabled: boolean) {
  return useQuery({
    queryKey: ['customers'],
    queryFn: () => fetch('/api/settings/customers').then((r) => r.json()),
    enabled,
  })
}

function useTeamMembers(enabled: boolean) {
  return useQuery({
    queryKey: ['teamMembers'],
    queryFn: () => fetch('/api/settings/team-members').then((r) => r.json()),
    enabled,
  })
}

function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; [k: string]: unknown }) =>
      fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: (_data) => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['task', _data.id] })
    },
  })
}

interface TaskFormState {
  title: string
  notes: string
  customerId: string
  importance: string
  urgency: string
  durationBucket: string
  reviewAt: string
  delegatedToId: string
  url: string
  tag: string
}

function emptyForm(): TaskFormState {
  return {
    title: '',
    notes: '',
    customerId: '',
    importance: '',
    urgency: '',
    durationBucket: '',
    reviewAt: '',
    delegatedToId: '',
    url: '',
    tag: '',
  }
}

function formFromTask(task: {
  title?: string | null
  notes?: string | null
  customerId?: string | null
  importance?: number | null
  urgency?: number | null
  durationBucket?: string | null
  reviewAt?: string | null
  delegatedToId?: string | null
  url?: string | null
  tag?: string | null
}): TaskFormState {
  return {
    title: task.title ?? '',
    notes: task.notes ?? '',
    customerId: task.customerId ?? '',
    importance: task.importance != null ? String(task.importance) : '',
    urgency: task.urgency != null ? String(task.urgency) : '',
    durationBucket: task.durationBucket ?? '',
    reviewAt: task.reviewAt
      ? new Date(task.reviewAt).toISOString().slice(0, 16)
      : '',
    delegatedToId: task.delegatedToId ?? '',
    url: task.url ?? '',
    tag: task.tag ?? '',
  }
}

export default function ClarifyPage() {
  const searchParams = useSearchParams()
  const taskId = searchParams.get('id')
  const { data: tasks = [], isLoading } = useClarifyTasks()
  const { data: task, isLoading: taskLoading } = useTask(taskId)
  const { data: customers = [] } = useCustomers(!!taskId)
  const { data: teamMembers = [] } = useTeamMembers(!!taskId)
  const updateTask = useUpdateTask()
  const [form, setForm] = useState<TaskFormState>(emptyForm)

  useEffect(() => {
    if (task) setForm(formFromTask(task))
    else if (!taskId) setForm(emptyForm())
  }, [task, taskId])

  const update = (patch: Partial<TaskFormState>) =>
    setForm((prev) => ({ ...prev, ...patch }))

  const handleSaveAndQualify = () => {
    if (!task || !form.durationBucket.trim()) return
    const payload = {
      id: task.id,
      title: form.title.trim() || undefined,
      notes: form.notes.trim() || undefined,
      customerId: form.customerId || null,
      importance: form.importance === '' ? undefined : Number(form.importance),
      urgency: form.urgency === '' ? undefined : Number(form.urgency),
      durationBucket: form.durationBucket,
      reviewAt: form.reviewAt ? new Date(form.reviewAt).toISOString() : null,
      delegatedToId: form.delegatedToId || null,
      url: form.url.trim() || null,
      tag: form.tag.trim() || null,
      status: 'qualified',
    }
    updateTask.mutate(payload)
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold text-slate-100 mb-2">Clarify</h1>
      <p className="text-xs text-app-muted mb-6">
        Du har {tasks.length} opgaver der kan kvalificeres bedre.
      </p>

      {taskId ? (
        <div className="space-y-6">
          {taskLoading ? (
            <p className="text-sm text-app-muted">Henter opgave...</p>
          ) : task ? (
            <>
              <div className="bg-app-card rounded-xl2 p-5 shadow-card border border-white/5 space-y-4">
                <h2 className="text-base font-medium text-slate-100 border-b border-white/5 pb-2">
                  Opgavefelter
                </h2>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Beskrivelse (title)</label>
                    <input
                      type="text"
                      value={form.title}
                      onChange={(e) => update({ title: e.target.value })}
                      placeholder="Kort beskrivelse"
                      className={inputClass}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Noter</label>
                    <textarea
                      value={form.notes}
                      onChange={(e) => update({ notes: e.target.value })}
                      placeholder="Ekstra noter"
                      rows={2}
                      className={inputClass + ' resize-none'}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Kunde</label>
                    <select
                      value={form.customerId}
                      onChange={(e) => update({ customerId: e.target.value })}
                      className={inputClass}
                    >
                      <option value="">Ingen</option>
                      {(customers as { id: string; name: string }[]).map(
                        (c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Delegér til</label>
                    <select
                      value={form.delegatedToId}
                      onChange={(e) => update({ delegatedToId: e.target.value })}
                      className={inputClass}
                    >
                      <option value="">Ingen</option>
                      {(teamMembers as { id: string; name: string }[]).map(
                        (t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Vigtighed (0–100)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={form.importance}
                      onChange={(e) => update({ importance: e.target.value })}
                      placeholder="–"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Hastighed (0–100)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={form.urgency}
                      onChange={(e) => update({ urgency: e.target.value })}
                      placeholder="–"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>
                      Varighed (påkrævet for qualified)
                    </label>
                    <select
                      value={form.durationBucket}
                      onChange={(e) =>
                        update({ durationBucket: e.target.value })
                      }
                      className={inputClass}
                    >
                      <option value="">Vælg...</option>
                      {DURATION_BUCKETS.map((b) => (
                        <option key={b.value} value={b.value}>
                          {b.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Gennemse dato</label>
                    <input
                      type="datetime-local"
                      value={form.reviewAt}
                      onChange={(e) => update({ reviewAt: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass}>URL</label>
                    <input
                      type="url"
                      value={form.url}
                      onChange={(e) => update({ url: e.target.value })}
                      placeholder="https://..."
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Tag</label>
                    <input
                      type="text"
                      value={form.tag}
                      onChange={(e) => update({ tag: e.target.value })}
                      placeholder="F.eks. projekt, kunde"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-4">
                  <button
                    type="button"
                    disabled={
                      !form.durationBucket.trim() || updateTask.isPending
                    }
                    onClick={handleSaveAndQualify}
                    className="bg-app-accent text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md hover:opacity-90 disabled:opacity-50 transition"
                  >
                    Mark as qualified
                  </button>
                  <span className="text-xs text-app-muted">
                    Varighed er påkrævet for at markere som qualified.
                  </span>
                </div>
              </div>
              <Link
                href="/clarify"
                className="text-sm text-app-muted hover:text-slate-300 transition"
              >
                ← Tilbage til listen
              </Link>
            </>
          ) : (
            <p className="text-sm text-app-muted">Opgave ikke fundet.</p>
          )}
        </div>
      ) : (
        <ul className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-app-muted">Henter...</p>
          ) : (
            (tasks as { id: string; title: string; nextAction?: string | null }[]).map((t) => (
              <li key={t.id}>
                <Link
                  href={`/clarify?id=${t.id}`}
                  className="block bg-app-card rounded-xl2 p-5 shadow-card border border-white/5 transition-all duration-200 hover:shadow-hover hover:-translate-y-0.5 hover:border-white/10"
                >
                  <p className="text-base font-medium text-slate-100">{t.title}</p>
                  {t.nextAction && (
                    <p className="text-sm text-slate-300 mt-1">{t.nextAction}</p>
                  )}
                </Link>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
