'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useRef } from 'react'

const DURATION_BUCKETS = [
  { value: 'LT15', label: 'Under 15 min' },
  { value: 'M15_30', label: '15–30 min' },
  { value: 'M30_60', label: '30–60 min' },
  { value: 'GT60', label: 'Over 60 min' },
] as const

const inputClass =
  'w-full bg-slate-900/60 border border-white/5 rounded-lg px-4 py-2 text-sm text-slate-200 placeholder:text-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent/40'
const labelClass = 'block text-sm font-medium text-slate-200 mb-1'

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

function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/tasks/${id}`, { method: 'DELETE' }).then((r) => {
        if (!r.ok) throw new Error('Kunne ikke slette')
        return r
      }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['task', id] })
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

export interface TaskOverlayProps {
  taskId: string | null
  onClose: () => void
}

export function TaskOverlay({ taskId, onClose }: TaskOverlayProps) {
  const { data: task, isLoading: taskLoading } = useTask(taskId)
  const { data: customers = [] } = useCustomers(!!taskId)
  const { data: teamMembers = [] } = useTeamMembers(!!taskId)
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const [form, setForm] = useState<TaskFormState>(emptyForm)
  const [tagInput, setTagInput] = useState('')
  const backdropClickedRef = useRef(false)

  useEffect(() => {
    if (task) setForm(formFromTask(task))
    else if (!taskId) setForm(emptyForm())
  }, [task, taskId])

  useEffect(() => {
    if (!taskId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [taskId, onClose])

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
      importance: form.importance === '' ? undefined : Number(form.importance),
      urgency: form.urgency === '' ? undefined : Number(form.urgency),
      durationBucket: form.durationBucket,
      reviewAt: form.reviewAt ? new Date(form.reviewAt).toISOString() : null,
      delegatedToId: form.delegatedToId || null,
      url: form.url.trim() || null,
      tag: form.tag.trim() || null,
      status: 'qualified',
    }
    updateTask.mutate(payload, {
      onSuccess: () => onClose(),
    })
  }

  const handleDelete = () => {
    if (!task) return
    if (!confirm('Er du sikker på at du vil slette denne opgave?')) return
    deleteTask.mutate(task.id, {
      onSuccess: () => onClose(),
    })
  }

  if (!taskId) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-overlay-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) backdropClickedRef.current = true
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && backdropClickedRef.current) onClose()
        backdropClickedRef.current = false
      }}
    >
      <div
        className="bg-app-card rounded-xl2 shadow-card border border-white/10 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onMouseDown={() => { backdropClickedRef.current = false }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between shrink-0 border-b border-white/5 px-5 py-3">
          <h2 id="task-overlay-title" className="text-lg font-medium text-slate-100 truncate">
            {task?.title ?? 'Opgave'}
          </h2>
          <button
            type="button"
            onClick={onClose}
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

              <div className="pt-2 flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleteTask.isPending}
                  className="text-app-danger hover:underline text-sm disabled:opacity-50"
                >
                  {deleteTask.isPending ? 'Sletter...' : 'Slet opgave'}
                </button>
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
  )
}
