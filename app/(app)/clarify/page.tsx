'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useCallback } from 'react'

const DURATION_BUCKETS = [
  { value: 'LT15', label: 'Under 15 min' },
  { value: 'M15_30', label: '15–30 min' },
  { value: 'M30_60', label: '30–60 min' },
  { value: 'GT60', label: 'Over 60 min' },
] as const

const DURATION_LABEL: Record<string, string> = Object.fromEntries(
  DURATION_BUCKETS.map((b) => [b.value, b.label])
)

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

function formatDeadline(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('da-DK', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

type TaskForCard = {
  id: string
  title: string
  customer?: { name: string } | null
  durationBucket?: string | null
  reviewAt?: string | null
  tag?: string | null
  urgency?: number | null
}

export default function ClarifyPage() {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const { data: tasks = [], isLoading } = useClarifyTasks()
  const { data: task, isLoading: taskLoading } = useTask(selectedTaskId)
  const { data: customers = [] } = useCustomers(!!selectedTaskId)
  const { data: teamMembers = [] } = useTeamMembers(!!selectedTaskId)
  const updateTask = useUpdateTask()
  const [form, setForm] = useState<TaskFormState>(emptyForm)
  const [tagInput, setTagInput] = useState('')

  const closeOverlay = useCallback(() => setSelectedTaskId(null), [])

  useEffect(() => {
    if (task) setForm(formFromTask(task))
    else if (!selectedTaskId) setForm(emptyForm())
  }, [task, selectedTaskId])

  useEffect(() => {
    if (!selectedTaskId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeOverlay()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [selectedTaskId, closeOverlay])

  const update = (patch: Partial<TaskFormState>) =>
    setForm((prev) => ({ ...prev, ...patch }))

  const tagsArray = form.tag
    ? form.tag.split(',').map((s) => s.trim()).filter(Boolean)
    : []

  const addTag = () => {
    const t = tagInput.trim()
    if (!t) return
    const next = tagsArray.includes(t) ? tagsArray : [...tagsArray, t]
    update({ tag: next.join(', ') })
    setTagInput('')
  }

  const removeTag = (index: number) => {
    const next = tagsArray.filter((_, i) => i !== index)
    update({ tag: next.join(', ') })
  }

  const handleSaveAndQualify = () => {
    if (!task || !form.durationBucket.trim()) return
    const payload = {
      id: task.id,
      title: form.title.trim() || undefined,
      notes: form.notes.trim() || undefined,
      customerId: form.customerId || null,
      urgency: form.urgency === '' ? undefined : Number(form.urgency),
      durationBucket: form.durationBucket,
      reviewAt: form.reviewAt ? new Date(form.reviewAt).toISOString() : null,
      delegatedToId: form.delegatedToId || null,
      url: form.url.trim() || null,
      tag: form.tag.trim() || null,
      status: 'qualified',
    }
    updateTask.mutate(payload, {
      onSuccess: () => closeOverlay(),
    })
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold text-slate-100 mb-2">Clarify</h1>
      <p className="text-xs text-app-muted mb-6">
        Du har {tasks.length} opgaver der kan kvalificeres bedre.
      </p>

      {isLoading ? (
        <p className="text-sm text-app-muted">Henter...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(tasks as TaskForCard[]).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedTaskId(t.id)}
              className="text-left bg-app-card rounded-xl2 p-5 shadow-card border border-white/5 transition-all duration-200 hover:shadow-hover hover:-translate-y-0.5 hover:border-white/10"
            >
              <p className="text-base font-medium text-slate-100">{t.title}</p>
              <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-app-muted">
                {t.customer?.name && (
                  <span>{t.customer.name}</span>
                )}
                {t.durationBucket && (
                  <span>{DURATION_LABEL[t.durationBucket] ?? t.durationBucket}</span>
                )}
                {t.reviewAt && (
                  <span>{formatDeadline(t.reviewAt)}</span>
                )}
              </div>
              {t.tag && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {t.tag.split(',').map((tag, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded bg-white/10 text-slate-300 text-xs"
                    >
                      {tag.trim()}
                    </span>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {selectedTaskId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clarify-overlay-title"
          onClick={closeOverlay}
        >
          <div
            className="bg-app-card rounded-xl2 shadow-card border border-white/10 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between shrink-0 border-b border-white/5 px-5 py-3">
              <h2 id="clarify-overlay-title" className="text-lg font-medium text-slate-100 truncate">
                {task?.title ?? 'Opgave'}
              </h2>
              <button
                type="button"
                onClick={closeOverlay}
                className="text-slate-400 hover:text-slate-200 p-1 rounded transition"
                aria-label="Luk"
              >
                <span className="text-xl leading-none">×</span>
              </button>
            </div>

            <div className="overflow-y-auto p-5 space-y-4">
              {taskLoading ? (
                <p className="text-sm text-app-muted">Henter opgave...</p>
              ) : task ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className={labelClass}>Titel</label>
                      <input
                        type="text"
                        value={form.title}
                        onChange={(e) => update({ title: e.target.value })}
                        placeholder="Kort titel"
                        className={inputClass}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={labelClass}>Beskrivelse</label>
                      <textarea
                        value={form.notes}
                        onChange={(e) => update({ notes: e.target.value })}
                        placeholder="Beskrivelse af opgaven"
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
                        onChange={(e) =>
                          update({ delegatedToId: e.target.value })
                        }
                        className={inputClass}
                      >
                        <option value="">Ingen</option>
                        {(teamMembers as { id: string; name: string }[]).map(
                          (tm) => (
                            <option key={tm.id} value={tm.id}>
                              {tm.name}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Hastegrad (0–100)</label>
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
                        Varighed <span className="text-app-danger">*</span>
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
                      <label className={labelClass}>Deadline</label>
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
                    <div className="sm:col-span-2">
                      <label className={labelClass}>Tags</label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {tagsArray.map((tag, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/10 text-slate-200 text-sm"
                          >
                            {tag}
                            <button
                              type="button"
                              onClick={() => removeTag(i)}
                              className="text-app-muted hover:text-slate-200"
                              aria-label={`Fjern ${tag}`}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            addTag()
                          }
                        }}
                        placeholder="Skriv og tryk Enter for at tilføje"
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      disabled={
                        !form.durationBucket.trim() || updateTask.isPending
                      }
                      onClick={handleSaveAndQualify}
                      className="bg-app-accent text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md hover:opacity-90 disabled:opacity-50 transition"
                    >
                      Færdig - Send til to-do liste
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-app-muted">Opgave ikke fundet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
