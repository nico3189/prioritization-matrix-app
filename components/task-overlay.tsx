'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AppSelect } from '@/components/app-select'
import { AppDatePicker } from '@/components/app-date-picker'
import { cn } from '@/lib/utils'
import { getScore } from '@/lib/eisenhower'
import { useToast } from '@/components/toast'
import { LinkFavicon } from '@/components/link-favicon'
import { ensureUrlProtocol, getLinkHostname } from '@/lib/link-favicon'
import { LinkCalendarEventSection } from '@/components/link-calendar-event-section'
import type { CalendarEventItem } from '@/lib/use-calendar-events'
import { SearchableMultiSelect } from '@/components/searchable-multi-select'
import { useTimeTrackingSettings } from '@/app/(app)/settings/_lib/settings-hooks'
import {
	buildTimeTrackingText,
	isTimeTrackingConfigured,
	normalizeTimeTrackingSettings,
} from '@/lib/time-tracking-settings'
import { startTimeTracking } from '@/lib/start-time-tracking'

const DURATION_BUCKETS = [
  { value: 'LT15', label: 'Under 15 min' },
  { value: 'M15_30', label: '15–30 min' },
  { value: 'M30_60', label: '30–60 min' },
  { value: 'GT60', label: 'Over 60 min' },
] as const

const TASK_TYPES = [
  { value: 'kunde', label: 'Kunde' },
  { value: 'internt', label: 'Internt' },
  { value: 'salg', label: 'Salg' },
  { value: 'ledelse', label: 'Ledelse' },
] as const

const TAG_COLORS = [
  'bg-violet-500/20 text-violet-300 border-violet-500/30',
  'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  'bg-amber-500/20 text-amber-300 border-amber-500/30',
  'bg-sky-500/20 text-sky-300 border-sky-500/30',
  'bg-rose-500/20 text-rose-300 border-rose-500/30',
]

const LOADING = {
  title: 'Kundemøde med Acme',
  description: 'Forbered indhold til mødet. Husk at tage materialet med og send noter til deltagerne bagefter.',
  type: 'Kunde',
  customer: 'Acme',
  importance: '75',
  duration: '30–60 min',
  delegatedTo: 'Martin Sørensen',
  urgency: '85',
  deadline: '15/03/2026, 10:00',
  score: '82',
  url: 'https://docs.example.com/møde',
  tags: 'kunde, prioritet',
}

const valueClass = 'text-sm text-slate-200'
const displayFieldClass =
  'w-full bg-transparent border-0 outline-none text-sm text-slate-200 placeholder:text-app-muted focus:ring-0 py-1 min-w-0'
const displayFieldStackedClass =
  'w-full app-input-gradient border border-white/5 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder:text-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent/40 focus:border-app-accent/30'
const labelClass = 'text-xs font-medium text-app-muted uppercase tracking-wider shrink-0 min-w-[6rem]'

function formatDeadline(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${day}/${month}/${year}, ${h}:${m}`
}

const iconClass = 'w-4 h-4 text-app-muted shrink-0'

function IconUser() {
  return (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )
}

function IconCompany() {
  return (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  )
}

function IconImportance() {
  return (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )
}

function IconZap() {
  return (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  )
}

function IconClock() {
  return (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
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

function IconLock() {
  return (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  )
}

function IconLockOpen() {
  return (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
    </svg>
  )
}

function IconLink() {
  return (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  )
}

function IconTag() {
  return (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  )
}

function IconFolder() {
  return (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  )
}

function IconFileText() {
  return (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
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

function useAllTasks(enabled: boolean) {
  return useQuery({
    queryKey: ['tasks', 'all'],
    queryFn: () => fetch('/api/tasks').then((r) => r.json()),
    enabled,
    staleTime: 30_000,
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

function useSyncTaskUrgency() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dueAt }: { id: string; dueAt?: string | null }) =>
      fetch(`/api/tasks/${id}/sync-urgency`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dueAt: dueAt === undefined ? null : dueAt }),
      }).then((r) => r.json()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['task', data.id] })
    },
  })
}

function useReParseTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/tasks/${id}/parse`, { method: 'POST' }).then((r) => {
        if (!r.ok) throw new Error('Parse fejlede')
        return r.json()
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['task', data.id] })
    },
  })
}

interface TaskFormState {
  title: string
  notes: string
  customerId: string
  type: string
  importance: string
  urgency: string
  durationBucket: string
  dueAt: string
  delegatedToId: string
  url: string
}

function emptyForm(): TaskFormState {
  return {
    title: '',
    notes: '',
    customerId: '',
    type: '',
    importance: '',
    urgency: '',
    durationBucket: '',
    dueAt: '',
    delegatedToId: '',
    url: '',
  }
}

function toISO16(d: Date | string | null | undefined): string {
  if (!d) return ''
  const date = typeof d === 'string' ? new Date(d) : d
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day}T${h}:${min}`
}

function formFromTask(task: {
  title?: string | null
  notes?: string | null
  customerId?: string | null
  type?: string | null
  importance?: number | null
  urgency?: number | null
  durationBucket?: string | null
  dueAt?: string | Date | null
  delegatedToId?: string | null
  url?: string | null
}): TaskFormState {
  return {
    title: task.title ?? '',
    notes: task.notes ?? '',
    customerId: task.customerId ?? '',
    type: task.type ?? '',
    importance: task.importance != null ? String(task.importance) : '',
    urgency: task.urgency != null ? String(task.urgency) : '',
    durationBucket: task.durationBucket ?? '',
    dueAt: toISO16(task.dueAt),
    delegatedToId: task.delegatedToId ?? '',
    url: task.url ?? '',
  }
}

function PropertyRow({
  icon,
  label,
  required,
  children,
}: {
  icon: React.ReactNode
  label: React.ReactNode
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-1 py-2">
      <div className="flex items-center justify-center w-8 h-8 shrink-0 text-app-muted">
        {icon}
      </div>
      <div className="flex-1 min-w-0 flex items-center gap-0.5">
        <span className={labelClass}>{label}{required && <span className="text-app-danger"> *</span>}</span>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  )
}

function PropertyRowStacked({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="py-2">
      <div className="flex items-center gap-1 mb-1">
        <div className="flex items-center justify-center w-8 h-8 shrink-0 text-app-muted">
          {icon}
        </div>
        <span className={labelClass}>{label}</span>
      </div>
      <div>{children}</div>
    </div>
  )
}

function IconExpandNotes() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
    </svg>
  )
}

const notesTextareaClass =
  displayFieldStackedClass +
  ' resize-y min-h-[8rem] max-h-[min(20rem,35vh)] leading-relaxed'

function TaskDescriptionField({
  value,
  onChange,
  isLoading,
  loadingText,
}: {
  value: string
  onChange: (value: string) => void
  isLoading?: boolean
  loadingText?: string
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const expandedRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!isExpanded) return
    const t = setTimeout(() => expandedRef.current?.focus(), 0)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsExpanded(false)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      document.removeEventListener('keydown', onKey)
    }
  }, [isExpanded])

  if (isLoading) {
    return (
      <div
        className={
          notesTextareaClass +
          ' blur-[2px] select-none pointer-events-none resize-none'
        }
        aria-hidden
      >
        {loadingText}
      </div>
    )
  }

  return (
    <>
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Beskrivelse af opgaven"
          rows={6}
          className={notesTextareaClass + ' pr-10'}
        />
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="absolute top-2 right-2 p-1.5 rounded-md border border-white/10 bg-slate-900/80 text-app-muted hover:text-slate-200 hover:bg-white/10 transition-colors duration-200"
          title="Udvid beskrivelse"
          aria-label="Udvid beskrivelse"
        >
          <IconExpandNotes />
        </button>
      </div>
      <p className="mt-1 text-[11px] text-app-muted">
        Træk i nederste højre hjørne for at ændre højde, eller brug udvid-knappen.
      </p>

      {isExpanded && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-8 bg-black/75 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label="Beskrivelse — udvidet"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setIsExpanded(false)
          }}
        >
          <div
            className="app-card-gradient rounded-xl2 border border-white/10 shadow-hover w-full max-w-3xl max-h-[85vh] flex flex-col animate-[modalContentIn_180ms_ease-out_forwards]"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
              <h3 className="text-sm font-medium text-slate-200">Beskrivelse</h3>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="p-2 rounded-lg border border-white/10 bg-white/5 text-app-muted hover:text-slate-200 hover:bg-white/10 transition-colors"
                aria-label="Luk udvidet beskrivelse"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 flex-1 min-h-0 overflow-auto">
              <textarea
                ref={expandedRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Beskrivelse af opgaven"
                className={
                  displayFieldStackedClass +
                  ' w-full min-h-[50vh] max-h-[70vh] resize-y leading-relaxed'
                }
              />
            </div>
            <div className="px-4 py-3 border-t border-white/10 flex justify-end">
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="bg-app-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition"
              >
                Luk
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export interface TaskOverlayProps {
  taskId: string | null
  onClose: () => void
}

export function TaskOverlay({ taskId, onClose }: TaskOverlayProps) {
  const router = useRouter()
  const showToast = useToast()
  const { data: task, isLoading: taskLoading } = useTask(taskId)
  const { data: allTasks = [] } = useAllTasks(!!taskId)
  const { data: customers = [] } = useCustomers(!!taskId)
  const { data: teamMembers = [] } = useTeamMembers(!!taskId)
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const syncTaskUrgency = useSyncTaskUrgency()
  const reParseTask = useReParseTask()
  const [form, setForm] = useState<TaskFormState>(emptyForm)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [recurrenceSubmenuOpen, setRecurrenceSubmenuOpen] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const actionsRef = useRef<HTMLDivElement>(null)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const recurrenceLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const openRecurrenceSubmenu = () => {
    if (recurrenceLeaveTimerRef.current) {
      clearTimeout(recurrenceLeaveTimerRef.current)
      recurrenceLeaveTimerRef.current = null
    }
    setRecurrenceSubmenuOpen(true)
  }

  const scheduleCloseRecurrenceSubmenu = () => {
    recurrenceLeaveTimerRef.current = setTimeout(() => {
      setRecurrenceSubmenuOpen(false)
      recurrenceLeaveTimerRef.current = null
    }, 150)
  }

  const MODAL_CLOSE_MS = 180

  const closeWithAnimation = useCallback(() => {
    if (isClosing) return
    setIsClosing(true)
    closeTimeoutRef.current = setTimeout(() => {
      onClose()
      setIsClosing(false)
      closeTimeoutRef.current = null
    }, MODAL_CLOSE_MS)
  }, [onClose, isClosing])

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current)
      if (recurrenceLeaveTimerRef.current) {
        clearTimeout(recurrenceLeaveTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setActionsOpen(false)
        setRecurrenceSubmenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  const [tagInput, setTagInput] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [tagIds, setTagIds] = useState<string[]>([])
  const [displayTags, setDisplayTags] = useState<Array<{ id: string; name: string; color: string }>>([])
  const [doneConfirmOpen, setDoneConfirmOpen] = useState(false)
  const [timeTrackingLoading, setTimeTrackingLoading] = useState(false)
  const [timeTrackingConfirmed, setTimeTrackingConfirmed] = useState(false)
  const backdropClickedRef = useRef(false)
  const { data: timeTrackingRaw } = useTimeTrackingSettings()
  const timeTrackingSettings = normalizeTimeTrackingSettings(timeTrackingRaw)
  const timeTrackingReady = isTimeTrackingConfigured(timeTrackingSettings)

  const taskForm = task ? formFromTask(task) : null
  const taskTagIds =
    (task as { taskTags?: Array<{ tagId: string }> })?.taskTags?.map(
      (tt) => tt.tagId
    ) ?? []
  const hasUnsavedChanges = Boolean(
    task &&
      taskForm &&
      (JSON.stringify(form) !== JSON.stringify(taskForm) ||
        JSON.stringify([...tagIds].sort()) !==
          JSON.stringify([...taskTagIds].sort()))
  )

  useEffect(() => {
    if (!timeTrackingConfirmed) return
    const t = setTimeout(() => setTimeTrackingConfirmed(false), 2500)
    return () => clearTimeout(t)
  }, [timeTrackingConfirmed])

  const typeLabel =
    TASK_TYPES.find((t) => t.value === form.type)?.label ?? ''
  const canStartTimeTracking =
    timeTrackingReady &&
    Boolean(form.type.trim()) &&
    Boolean(form.title.trim())
  const timeTrackingDisabledReason = !timeTrackingReady
    ? 'Konfigurer tidsregistrering under Indstillinger'
    : !form.type.trim()
      ? 'Vælg type først'
      : !form.title.trim()
        ? 'Angiv en titel'
        : ''

  const handleStartTimeTracking = async () => {
    if (!canStartTimeTracking || timeTrackingLoading) return
    const timeTrackingText = buildTimeTrackingText(
      typeLabel,
      form.title
    )
    setTimeTrackingLoading(true)
    try {
      await startTimeTracking(timeTrackingText)
      setTimeTrackingConfirmed(true)
      showToast('Tidsregistrering startet')
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : 'Kunne ikke starte tidsregistrering'
      )
    } finally {
      setTimeTrackingLoading(false)
    }
  }

  const urls = (form.url || '').split('\n').map((s) => s.trim()).filter(Boolean)
  const addUrl = useCallback(() => {
    const v = urlInput.trim()
    if (!v) return
    setForm((f) => ({
      ...f,
      url: [...(f.url || '').split('\n').map((s) => s.trim()).filter(Boolean), v].join('\n'),
    }))
    setUrlInput('')
  }, [urlInput])
  const removeUrl = useCallback((index: number) => {
    setForm((f) => {
      const list = (f.url || '').split('\n').map((s) => s.trim()).filter(Boolean)
      return { ...f, url: list.filter((_, i) => i !== index).join('\n') }
    })
  }, [])

  useEffect(() => {
    if (task) setForm(formFromTask(task))
    else if (!taskId) setForm(emptyForm())
  }, [task, taskId])

  useEffect(() => {
    if (!task) {
      setTagIds([])
      setDisplayTags([])
      return
    }
    const tt = (task as { taskTags?: Array<{ tagId: string; tag: { id: string; name: string; color: string } }> }).taskTags
    if (tt && tt.length > 0) {
      setTagIds(tt.map((t) => t.tagId))
      setDisplayTags(tt.map((t) => ({ id: t.tag.id, name: t.tag.name, color: t.tag.color })))
      return
    }
    const legacyTag = (task as { tag?: string | null }).tag
    if (legacyTag) {
      const names = legacyTag.split(',').map((s) => s.trim()).filter(Boolean)
      if (names.length === 0) {
        setTagIds([])
        setDisplayTags([])
        return
      }
      Promise.all(
        names.map((name) =>
          fetch('/api/settings/tags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
          }).then((r) => r.json())
        )
      ).then((tags) => {
        const valid = tags.filter((t: { id?: string }) => t?.id)
        setTagIds(valid.map((t: { id: string }) => t.id))
        setDisplayTags(valid.map((t: { id: string; name: string; color: string }) => ({ id: t.id, name: t.name, color: t.color })))
      })
    } else {
      setTagIds([])
      setDisplayTags([])
    }
  }, [task])

  useEffect(() => {
    setIsCompleting(false)
    setIsClosing(false)
  }, [taskId])

  useEffect(() => {
    if (!taskId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeWithAnimation()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [taskId, closeWithAnimation])

  const update = (patch: Partial<TaskFormState>) =>
    setForm((prev) => ({ ...prev, ...patch }))

  const addTag = async () => {
    const t = tagInput.trim()
    if (!t) return
    if (displayTags.some((d) => d.name.toLowerCase() === t.toLowerCase())) {
      setTagInput('')
      return
    }
    try {
      const r = await fetch('/api/settings/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: t }),
      })
      const tag = await r.json()
      if (!r.ok) throw new Error(tag?.error ?? 'Fejl')
      if (tag?.id) {
        setTagIds((prev) => [...prev, tag.id])
        setDisplayTags((prev) => [...prev, { id: tag.id, name: tag.name, color: tag.color }])
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Kunne ikke tilføje tag')
    }
    setTagInput('')
  }

  const removeTag = (index: number) => {
    setTagIds((prev) => prev.filter((_, i) => i !== index))
    setDisplayTags((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSaveAndQualify = () => {
    if (!task || !form.type.trim() || !form.durationBucket.trim()) return
    const payload = {
      id: task.id,
      title: form.title.trim() || undefined,
      notes: form.notes.trim() || undefined,
      customerId: form.customerId || null,
      type: form.type || null,
      importance: form.importance === '' ? undefined : Number(form.importance),
      urgency: form.urgency === '' ? undefined : Number(form.urgency),
      durationBucket: form.durationBucket,
      dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
      delegatedToId: form.delegatedToId || null,
      url: form.url.trim() || null,
      tagIds,
      status: 'qualified',
    }
    updateTask.mutate(payload, {
      onSuccess: () => {
        showToast('Gemt!')
        closeWithAnimation()
      },
    })
  }

  const handleDelete = () => {
    if (!task) return
    if (!confirm('Er du sikker på at du vil slette denne opgave?')) return
    deleteTask.mutate(task.id, {
      onSuccess: () => closeWithAnimation(),
    })
  }

  const performMarkDone = () => {
    if (!task) return
    setIsCompleting(true)
    setDoneConfirmOpen(false)
    updateTask.mutate(
      { id: task.id, status: 'done' },
      {
        onSuccess: (data: { spawnedTask?: { id: string; dueAt: string } }) => {
          const spawned = data.spawnedTask
          if (spawned?.dueAt) {
            const d = new Date(spawned.dueAt)
            const day = String(d.getDate()).padStart(2, '0')
            const month = String(d.getMonth() + 1).padStart(2, '0')
            const h = String(d.getHours()).padStart(2, '0')
            const m = String(d.getMinutes()).padStart(2, '0')
            showToast(`Opgave udført! Næste opgave oprettet til ${day}/${month} ${h}.${m}`)
          } else {
            showToast('Opgave udført!')
          }
          setTimeout(() => onClose(), 550)
        },
        onError: () => setIsCompleting(false),
      }
    )
  }

  const handleMarkDone = () => {
    if (!task) return
    if (hasUnsavedChanges) {
      setDoneConfirmOpen(true)
      return
    }
    performMarkDone()
  }

  const handleSaveAndMarkDone = () => {
    if (!task || !form.type.trim() || !form.durationBucket.trim()) return
    const payload = {
      id: task.id,
      title: form.title.trim() || undefined,
      notes: form.notes.trim() || undefined,
      customerId: form.customerId || null,
      type: form.type || null,
      importance: form.importance === '' ? undefined : Number(form.importance),
      urgency: form.urgency === '' ? undefined : Number(form.urgency),
      durationBucket: form.durationBucket,
      dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
      delegatedToId: form.delegatedToId || null,
      url: form.url.trim() || null,
      tagIds,
      status: 'done',
    }
    setIsCompleting(true)
    setDoneConfirmOpen(false)
    updateTask.mutate(payload, {
      onSuccess: (data: { spawnedTask?: { id: string; dueAt: string } }) => {
        const spawned = data.spawnedTask
        if (spawned?.dueAt) {
          const d = new Date(spawned.dueAt)
          const day = String(d.getDate()).padStart(2, '0')
          const month = String(d.getMonth() + 1).padStart(2, '0')
          const h = String(d.getHours()).padStart(2, '0')
          const m = String(d.getMinutes()).padStart(2, '0')
          showToast(`Gemt og udført! Næste opgave oprettet til ${day}/${month} ${h}.${m}`)
        } else {
          showToast('Gemt og udført!')
        }
        setTimeout(() => onClose(), 550)
      },
      onError: () => setIsCompleting(false),
    })
  }

  const handleRestore = () => {
    if (!task) return
    setActionsOpen(false)
    updateTask.mutate({ id: task.id, status: 'qualified' })
  }

  const handleSyncUrgency = () => {
    if (!task) return
    setActionsOpen(false)
    const dueAt = form.dueAt === '' ? null : form.dueAt || null
    syncTaskUrgency.mutate(
      { id: task.id, dueAt },
      { onSuccess: (data) => setForm(formFromTask(data)) }
    )
  }

  const handleLinkCalendarEvent = (event: CalendarEventItem) => {
    if (!task) return
    updateTask.mutate(
      {
        id: task.id,
        linkedEventId: event.id,
        linkedEventTitle: event.summary,
        linkedEventUrl: event.htmlLink ?? null,
        linkedEventType: null,
        eventStartAt: event.start
          ? new Date(event.start).toISOString()
          : null,
        eventEndAt: event.end ? new Date(event.end).toISOString() : null,
      },
      {
        onSuccess: () => showToast('Koblet til kalenderbegivenhed'),
      }
    )
  }

  const handleUnlinkCalendarEvent = () => {
    if (!task) return
    updateTask.mutate(
      {
        id: task.id,
        linkedEventId: null,
        linkedEventTitle: null,
        linkedEventUrl: null,
        linkedEventType: null,
        eventStartAt: null,
        eventEndAt: null,
      },
      {
        onSuccess: () => showToast('Kobling til begivenhed fjernet'),
      }
    )
  }

  const handleToggleUdviklingsliste = () => {
    if (!task || task.status === 'done') return
    const isOnUdvikling = task.status === 'udvikling'
    setActionsOpen(false)
    updateTask.mutate(
      { id: task.id, status: isOnUdvikling ? 'qualified' : 'udvikling' },
      {
        onSuccess: () => {
          showToast(
            isOnUdvikling
              ? 'Opgave tilbage på opgavelisten'
              : 'Opgave på udviklingslisten'
          )
        },
      }
    )
  }

  if (!taskId) return null

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-[2px] ${
        isClosing
          ? 'animate-[modalOverlayOut_180ms_ease-out_forwards]'
          : 'animate-[modalOverlayIn_150ms_ease-out_forwards]'
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-overlay-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) backdropClickedRef.current = true
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && backdropClickedRef.current) closeWithAnimation()
        backdropClickedRef.current = false
      }}
    >
      <div
        className={`relative app-card-gradient rounded-lg shadow-hover border border-white/10 w-full max-w-[calc(100vw-2rem)] sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col ${
          isClosing
            ? 'animate-[modalContentOut_180ms_ease-out_forwards]'
            : 'animate-[modalContentIn_180ms_ease-out_forwards]'
        }`}
        onMouseDown={() => { backdropClickedRef.current = false }}
        onClick={(e) => e.stopPropagation()}
      >
        {isCompleting && (
          <div
            className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-emerald-600/90"
            style={{ animation: 'completionOverlay 0.5s ease-out forwards' }}
            aria-hidden
          >
            <svg
              className="w-16 h-16 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              style={{ animation: 'checkmarkPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both' }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
        {doneConfirmOpen && (
          <div
            className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-black/80 backdrop-blur-sm p-4"
            aria-modal="true"
            role="alertdialog"
            aria-labelledby="done-confirm-title"
          >
            <div className="bg-app-card border border-white/10 rounded-xl2 p-5 shadow-card max-w-sm w-full">
              <h3 id="done-confirm-title" className="text-base font-medium text-slate-100 mb-2">
                Du har ændringer der ikke er gemt
              </h3>
              <p className="text-sm text-slate-300 mb-4">
                Vil du markere opgaven som udført uden at gemme, eller gemme først?
              </p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleSaveAndMarkDone}
                  disabled={updateTask.isPending || !form.type.trim() || !form.durationBucket.trim()}
                  className="w-full bg-emerald-700/80 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  Gem og markér udført
                </button>
                <button
                  type="button"
                  onClick={performMarkDone}
                  disabled={updateTask.isPending}
                  className="w-full bg-white/10 hover:bg-white/15 text-slate-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-white/10 disabled:opacity-50"
                >
                  Markér udført uden at gemme
                </button>
                <button
                  type="button"
                  onClick={() => setDoneConfirmOpen(false)}
                  className="w-full text-app-muted hover:text-slate-200 px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  Annuller
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Header */}
        <div className="flex items-center justify-between gap-2 sm:gap-3 shrink-0 px-3 sm:px-4 py-3 border-b border-white/10 bg-slate-900/40">
          <button
            type="button"
            onClick={closeWithAnimation}
            className="shrink-0 p-2 rounded-lg border border-white/10 bg-white/5 text-app-muted hover:text-slate-200 hover:bg-white/10 transition-colors duration-200 ease-out"
            aria-label="Luk"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h2
            id="task-overlay-title"
            className={`text-lg font-semibold leading-tight flex-1 min-w-0 truncate ${
              taskLoading ? 'blur-[2px] select-none text-slate-200' : 'text-slate-100'
            }`}
          >
            {taskLoading ? LOADING.title : (task?.title ?? 'Opgave')}
          </h2>
          <div className="flex items-center gap-2">
            {task && (
              <>
                <div ref={actionsRef} className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setActionsOpen((o) => !o)}
                    className="shrink-0 p-2 rounded-lg border border-white/10 bg-white/5 text-app-muted hover:text-slate-200 hover:bg-white/10 transition-colors duration-200 ease-out"
                    aria-label="Flere handlinger"
                    aria-haspopup="menu"
                    aria-expanded={actionsOpen}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>
                  {actionsOpen && (
                    <ul
                      role="menu"
                      className="absolute right-0 top-full mt-1 min-w-[12rem] rounded-lg border border-white/10 app-dropdown-gradient shadow-lg py-1 z-[60] animate-[dropdownIn_150ms_ease-out_forwards]"
                    >
                      {task.status === 'done' && (
                        <li role="none">
                          <button
                            type="button"
                            role="menuitem"
                            onClick={handleRestore}
                            disabled={updateTask.isPending}
                            className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/5 transition-colors duration-200 ease-out disabled:opacity-50"
                          >
                            Genskab opgave
                          </button>
                        </li>
                      )}
                      <li role="none">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setActionsOpen(false)
                            if (task) {
                              reParseTask.mutate(task.id, {
                                onSuccess: (data) => {
                                  setForm(formFromTask(data))
                                  showToast('AI har genparset opgaven')
                                },
                              })
                            }
                          }}
                          disabled={reParseTask.isPending}
                          className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/5 transition-colors duration-200 ease-out disabled:opacity-50"
                        >
                          Parse igen (udtræk URL, tags m.m.)
                        </button>
                      </li>
                      <li role="none">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={handleSyncUrgency}
                          disabled={syncTaskUrgency.isPending}
                          className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/5 transition-colors duration-200 ease-out disabled:opacity-50"
                        >
                          Genberegn hastegrad og vigtighed
                        </button>
                      </li>
                      {task.status !== 'done' && (
                        <li role="none">
                          <button
                            type="button"
                            role="menuitem"
                            onClick={handleToggleUdviklingsliste}
                            disabled={updateTask.isPending}
                            className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/5 transition-colors duration-200 ease-out disabled:opacity-50 flex items-center gap-2"
                          >
                            {task.status === 'udvikling' ? (
                              <svg className="w-4 h-4 text-app-accent shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <span className="w-4 shrink-0" aria-hidden />
                            )}
                            På udviklingslisten
                          </button>
                        </li>
                      )}
                      {task.status !== 'done' && (
                        <>
                          <li role="separator" className="my-1 border-t border-white/5" />
                          <li role="none" className="relative">
                          <div
                            className="relative flex items-stretch"
                            onMouseEnter={openRecurrenceSubmenu}
                            onMouseLeave={scheduleCloseRecurrenceSubmenu}
                          >
                            <button
                              type="button"
                              role="menuitem"
                              onClick={(e) => {
                                e.stopPropagation()
                                setRecurrenceSubmenuOpen((o) => !o)
                              }}
                              className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/5 transition-colors duration-200 ease-out flex items-center justify-between"
                            >
                              <span>Gentagelse</span>
                              <span className="text-app-muted text-xs">
                                {(task as { recurrenceRule?: string | null }).recurrenceRule === 'DAILY'
                                  ? 'Daglig'
                                  : (task as { recurrenceRule?: string | null }).recurrenceRule === 'WEEKLY'
                                    ? 'Ugentlig'
                                    : (task as { recurrenceRule?: string | null }).recurrenceRule === 'MONTHLY'
                                      ? 'Månedlig'
                                      : 'Ingen'}
                              </span>
                              <svg className="w-3.5 h-3.5 text-app-muted shrink-0 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                            {recurrenceSubmenuOpen && (
                              <ul
                                role="menu"
                                onMouseEnter={openRecurrenceSubmenu}
                                onMouseLeave={scheduleCloseRecurrenceSubmenu}
                                className="absolute right-full top-0 min-w-[10rem] rounded-lg border border-white/10 app-dropdown-gradient shadow-lg py-1 z-[70] animate-[dropdownIn_150ms_ease-out_forwards] pl-1 -translate-x-1"
                              >
                                {(['DAILY', 'WEEKLY', 'MONTHLY'] as const).map((rule) => {
                                  const label = rule === 'DAILY' ? 'Daglig' : rule === 'WEEKLY' ? 'Ugentlig' : 'Månedlig'
                                  const isActive = (task as { recurrenceRule?: string | null }).recurrenceRule === rule
                                  return (
                                    <li key={rule} role="none">
                                      <button
                                        type="button"
                                        role="menuitem"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setActionsOpen(false)
                                          setRecurrenceSubmenuOpen(false)
                                          updateTask.mutate({ id: task.id, recurrenceRule: rule })
                                        }}
                                        disabled={updateTask.isPending}
                                        className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/5 transition-colors duration-200 ease-out disabled:opacity-50 flex items-center gap-2"
                                      >
                                        {isActive ? (
                                          <svg className="w-4 h-4 text-app-accent shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                          </svg>
                                        ) : (
                                          <span className="w-4 shrink-0" aria-hidden />
                                        )}
                                        {label}
                                      </button>
                                    </li>
                                  )
                                })}
                                <li role="none">
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setActionsOpen(false)
                                      setRecurrenceSubmenuOpen(false)
                                      updateTask.mutate({ id: task.id, recurrenceRule: null })
                                    }}
                                    disabled={updateTask.isPending}
                                    className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/5 transition-colors duration-200 ease-out disabled:opacity-50 flex items-center gap-2"
                                  >
                                    {(task as { recurrenceRule?: string | null }).recurrenceRule == null ? (
                                      <svg className="w-4 h-4 text-app-accent shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    ) : (
                                      <span className="w-4 shrink-0" aria-hidden />
                                    )}
                                    Ingen
                                  </button>
                                </li>
                              </ul>
                            )}
                          </div>
                        </li>
                        </>
                      )}
                    </ul>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleteTask.isPending}
                  className="shrink-0 p-2 rounded-lg border border-white/10 bg-white/5 text-app-danger hover:bg-red-500/10 hover:border-red-500/20 transition-colors duration-200 ease-out disabled:opacity-50"
                  aria-label="Slet opgave"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V7a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndQualify}
                  disabled={taskLoading || !form.type.trim() || !form.durationBucket.trim() || updateTask.isPending || syncTaskUrgency.isPending}
                  className={cn(
                    'shrink-0 p-2 rounded-lg border transition-colors duration-200 ease-out disabled:opacity-50',
                    hasUnsavedChanges
                      ? 'border-blue-500/40 bg-blue-600/90 text-white hover:bg-blue-500'
                      : 'border-white/10 bg-white/5 text-blue-500 hover:text-blue-400 hover:bg-white/10'
                  )}
                  aria-label="Gem"
                  title="Gem"
                >
                  {(updateTask.isPending || syncTaskUrgency.isPending) ? (
                    <svg className={cn('w-4 h-4 animate-spin', hasUnsavedChanges ? 'text-white' : 'text-blue-500')} fill="none" viewBox="0 0 24 24" aria-hidden>
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg className={cn('w-4 h-4', hasUnsavedChanges ? 'text-white' : 'text-blue-500')} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                      <path d="M13.9,4.6l-2.5-2.5C11.3,2.1,11.1,2,11,2H3C2.4,2,2,2.4,2,3v10c0,0.6,0.4,1,1,1h10c0.6,0,1-0.4,1-1V5C14,4.9,13.9,4.7,13.9,4.6z M6,3h4v2H6V3z M10,13H6V9h4V13z M11,13V9c0-0.6-0.4-1-1-1H6C5.4,8,5,8.4,5,9v4H3V3h2v2c0,0.6,0.4,1,1,1h4c0.6,0,1-0.4,1-1V3.2l2,2V13H11z" />
                    </svg>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => void handleStartTimeTracking()}
                  disabled={
                    taskLoading ||
                    !canStartTimeTracking ||
                    timeTrackingLoading
                  }
                  className={cn(
                    'shrink-0 p-2 rounded-lg border transition-colors duration-200 ease-out disabled:opacity-50',
                    timeTrackingConfirmed
                      ? 'border-emerald-500/40 bg-emerald-600/90 text-white'
                      : 'border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10'
                  )}
                  aria-label="Start tidsregistrering"
                  title={
                    timeTrackingConfirmed
                      ? 'Tidsregistrering startet'
                      : timeTrackingDisabledReason ||
                        'Start tidsregistrering'
                  }
                >
                  {timeTrackingLoading ? (
                    <svg
                      className="w-4 h-4 animate-spin text-slate-300"
                      fill="none"
                      viewBox="0 0 24 24"
                      aria-hidden
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  ) : timeTrackingConfirmed ? (
                    <svg
                      className="w-4 h-4 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  )}
                </button>
                {task.status !== 'done' && (
                  <>
                    <div className="w-px h-6 bg-white/15 shrink-0 mx-2" aria-hidden />
                    <button
                      type="button"
                      onClick={handleMarkDone}
                      disabled={updateTask.isPending}
                      className={cn(
                        'shrink-0 p-2 rounded-lg border transition-colors duration-200 ease-out disabled:opacity-50',
                        hasUnsavedChanges
                          ? 'border-white/10 bg-white/5 text-app-muted hover:text-slate-400 hover:bg-white/10'
                          : 'border-white/10 bg-emerald-700/80 text-white hover:bg-emerald-600'
                      )}
                      aria-label="Marker opgave som udført"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <div className="overflow-y-auto flex-1 min-w-0">
          <div className="px-4 sm:px-6 pt-4 pb-6 space-y-4">
            {!taskLoading && !task && (
              <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
                Opgave ikke fundet.
              </div>
            )}
            {/* Titel & Beskrivelse */}
            <section className="space-y-1 [&>*:first-child]:pt-0">
              <PropertyRowStacked icon={<IconFileText />} label="Titel">
                {taskLoading ? (
                  <div
                    className={displayFieldStackedClass + ' blur-[2px] select-none pointer-events-none'}
                    aria-hidden
                  >
                    {LOADING.title}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => update({ title: e.target.value })}
                    placeholder="Kort titel"
                    className={displayFieldStackedClass}
                  />
                )}
              </PropertyRowStacked>
              <PropertyRowStacked icon={<IconFileText />} label="Beskrivelse">
                <TaskDescriptionField
                  value={form.notes}
                  onChange={(notes) => update({ notes })}
                  isLoading={taskLoading}
                  loadingText={LOADING.description}
                />
              </PropertyRowStacked>
            </section>

            {/* Egenskaber */}
            <section className="space-y-3 border-t border-white/15 pt-4 mt-4">
              <h3 className="text-sm font-medium text-slate-200 mb-2">Egenskaber</h3>
              <div className="grid sm:grid-cols-[1fr_1px_1fr] gap-x-4 gap-y-0 items-stretch">
                <div className="space-y-0">
                  <PropertyRow
                    icon={
                      <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    }
                    label="Score"
                  >
                    {taskLoading ? (
                      <span className="text-sm text-slate-200 blur-[2px] select-none">{LOADING.score}</span>
                    ) : (
                      <span className="text-sm text-slate-400">
                        {Math.round(getScore(
                          form.importance === '' ? 0 : Number(form.importance) || 0,
                          form.urgency === '' ? 0 : Number(form.urgency) || 0
                        ))}
                      </span>
                    )}
                  </PropertyRow>
                  <PropertyRow
                    icon={<IconImportance />}
                    label={
                      <span className="flex items-center gap-1.5">
                        Vigtighed
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            if (!taskId) return
                            const isLocked = !!task?.importanceManuallyOverriddenAt
                            updateTask.mutate(
                              {
                                id: taskId,
                                ...(isLocked
                                  ? { importanceManuallyOverriddenAt: null }
                                  : { lockImportance: true }),
                              },
                              {
                                onSuccess: () =>
                                  showToast(
                                    isLocked
                                      ? 'Låst op – AI kan nu ændre vigtighed'
                                      : 'Låst – AI vil ikke ændre vigtighed'
                                  ),
                              }
                            )
                          }}
                          className={cn(
                            'p-0.5 rounded transition-colors',
                            task?.importanceManuallyOverriddenAt
                              ? 'text-amber-400 hover:text-amber-300'
                              : 'text-app-muted hover:text-slate-400'
                          )}
                          title={
                            task?.importanceManuallyOverriddenAt
                              ? 'Klik for at låse op'
                              : 'Klik for at låse – AI vil ikke ændre værdien'
                          }
                          aria-label={
                            task?.importanceManuallyOverriddenAt
                              ? 'Lås vigtighed op'
                              : 'Lås vigtighed'
                          }
                        >
                          {task?.importanceManuallyOverriddenAt ? (
                            <IconLock />
                          ) : (
                            <IconLockOpen />
                          )}
                        </button>
                      </span>
                    }
                  >
                    {taskLoading ? (
                      <div className={displayFieldClass + ' blur-[2px] select-none py-1'} aria-hidden>
                        {LOADING.importance}
                      </div>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={form.importance}
                        onChange={(e) => update({ importance: e.target.value })}
                        placeholder="–"
                        className={displayFieldClass + ' [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'}
                      />
                    )}
                  </PropertyRow>
                  <PropertyRow
                    icon={<IconZap />}
                    label={
                      <span className="flex items-center gap-1.5">
                        Hastegrad
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            if (!taskId) return
                            const isLocked = !!task?.urgencyManuallyOverriddenAt
                            updateTask.mutate(
                              {
                                id: taskId,
                                ...(isLocked
                                  ? { urgencyManuallyOverriddenAt: null }
                                  : { lockUrgency: true }),
                              },
                              {
                                onSuccess: () =>
                                  showToast(
                                    isLocked
                                      ? 'Låst op – AI kan nu ændre hastegrad'
                                      : 'Låst – AI vil ikke ændre hastegrad'
                                  ),
                              }
                            )
                          }}
                          className={cn(
                            'p-0.5 rounded transition-colors',
                            task?.urgencyManuallyOverriddenAt
                              ? 'text-amber-400 hover:text-amber-300'
                              : 'text-app-muted hover:text-slate-400'
                          )}
                          title={
                            task?.urgencyManuallyOverriddenAt
                              ? 'Klik for at låse op'
                              : 'Klik for at låse – AI vil ikke ændre værdien'
                          }
                          aria-label={
                            task?.urgencyManuallyOverriddenAt
                              ? 'Lås hastegrad op'
                              : 'Lås hastegrad'
                          }
                        >
                          {task?.urgencyManuallyOverriddenAt ? (
                            <IconLock />
                          ) : (
                            <IconLockOpen />
                          )}
                        </button>
                      </span>
                    }
                  >
                    {taskLoading ? (
                      <div className={displayFieldClass + ' blur-[2px] select-none py-1'} aria-hidden>
                        {LOADING.urgency}
                      </div>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={form.urgency}
                        onChange={(e) => update({ urgency: e.target.value })}
                        placeholder="–"
                        className={displayFieldClass + ' [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'}
                      />
                    )}
                  </PropertyRow>
                  <PropertyRow icon={<IconCalendar />} label="Deadline">
                    {taskLoading ? (
                      <div className={displayFieldClass + ' blur-[2px] select-none py-1'} aria-hidden>
                        {LOADING.deadline}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <AppDatePicker
                          value={form.dueAt}
                          onChange={(v) => update({ dueAt: v })}
                          formatDisplay={formatDeadline}
                          placeholder="Vælg dato"
                          className="w-full min-w-0"
                        />
                        {Boolean((task as { deadlineConflict?: boolean }).deadlineConflict) && (
                          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
                            Deadline ligger før seneste dependency-deadline.
                          </div>
                        )}
                      </div>
                    )}
                  </PropertyRow>
                </div>
                <div className="hidden sm:block border-l border-white/10 self-stretch" />
                <div className="space-y-0">
                  <PropertyRow icon={<IconFolder />} label="Type" required>
                    {taskLoading ? (
                      <div className={displayFieldClass + ' blur-[2px] select-none py-1'} aria-hidden>
                        {LOADING.type}
                      </div>
                    ) : (
                      <AppSelect
                        value={form.type}
                        onChange={(v) => update({ type: v })}
                        options={TASK_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                        placeholder="Vælg..."
                        className="w-full min-w-0"
                      />
                    )}
                  </PropertyRow>
                  <PropertyRow icon={<IconCompany />} label="Kunde">
                    {taskLoading ? (
                      <div className={displayFieldClass + ' blur-[2px] select-none py-1'} aria-hidden>
                        {LOADING.customer}
                      </div>
                    ) : (
                      <AppSelect
                        value={form.customerId}
                        onChange={(v) => update({ customerId: v })}
                        options={(customers as { id: string; name: string }[]).map((c) => ({
                          value: c.id,
                          label: c.name,
                        }))}
                        placeholder="Ingen"
                        className="w-full min-w-0"
                      />
                    )}
                  </PropertyRow>
                  <PropertyRow icon={<IconUser />} label="Delegér til">
                    {taskLoading ? (
                      <div className={displayFieldClass + ' blur-[2px] select-none py-1'} aria-hidden>
                        {LOADING.delegatedTo}
                      </div>
                    ) : (
                      <AppSelect
                        value={form.delegatedToId}
                        onChange={(v) => update({ delegatedToId: v })}
                        options={(teamMembers as { id: string; name: string }[]).map((tm) => ({ value: tm.id, label: tm.name }))}
                        placeholder="Ingen"
                        className="w-full min-w-0"
                      />
                    )}
                  </PropertyRow>
                  <PropertyRow icon={<IconClock />} label="Varighed" required>
                    {taskLoading ? (
                      <div className={displayFieldClass + ' blur-[2px] select-none py-1'} aria-hidden>
                        {LOADING.duration}
                      </div>
                    ) : (
                      <AppSelect
                        value={form.durationBucket}
                        onChange={(v) => update({ durationBucket: v })}
                        options={DURATION_BUCKETS.map((b) => ({ value: b.value, label: b.label }))}
                        placeholder="Vælg..."
                        className="w-full min-w-0"
                      />
                    )}
                  </PropertyRow>
                </div>
              </div>
            </section>

            {/* URL & Tags */}
            <section className="border-t border-white/15 pt-4 mt-4">
              <div className="grid sm:grid-cols-[1fr_1px_1fr] gap-x-4 gap-y-0 items-stretch">
                <div>
                  <PropertyRowStacked icon={<IconLink />} label="URL">
                    {taskLoading ? (
                      <div className={displayFieldStackedClass + ' blur-[2px] select-none pointer-events-none'} aria-hidden>
                        {LOADING.url}
                      </div>
                    ) : (
                      <>
                        <input
                          type="text"
                          value={urlInput}
                          onChange={(e) => setUrlInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              addUrl()
                            }
                          }}
                          placeholder="Indtast URL og tryk Enter for at tilføje"
                          className={displayFieldStackedClass}
                        />
                        {urls.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {urls.map((url, i) => (
                              <a
                                key={`${url}-${i}`}
                                href={ensureUrlProtocol(url)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-blue-700/40 text-blue-400 hover:text-blue-300 hover:border-blue-600 transition-colors duration-200"
                              >
                                <LinkFavicon url={url} />
                                <span
                                  className="truncate max-w-[200px]"
                                  title={url}
                                >
                                  {getLinkHostname(url) ?? url}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    removeUrl(i)
                                  }}
                                  className="hover:opacity-80 transition-opacity shrink-0"
                                  aria-label="Fjern URL"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </a>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </PropertyRowStacked>
                </div>
                <div className="hidden sm:block border-l border-white/10 self-stretch" />
                <div>
                  <PropertyRowStacked icon={<IconTag />} label="Tags">
                    {taskLoading ? (
                      <div className={displayFieldStackedClass + ' blur-[2px] select-none pointer-events-none'} aria-hidden>
                        {LOADING.tags}
                      </div>
                    ) : (
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
                        className={displayFieldStackedClass}
                      />
                    )}
                    {!taskLoading && displayTags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {displayTags.map((tag, i) => (
                          <span
                            key={tag.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border"
                            style={{
                              backgroundColor: `${tag.color}20`,
                              color: tag.color,
                              borderColor: `${tag.color}40`,
                            }}
                          >
                            {tag.name}
                            <button
                              type="button"
                              onClick={() => removeTag(i)}
                              className="hover:opacity-80 transition-opacity duration-200 ease-out"
                              aria-label={`Fjern ${tag.name}`}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </PropertyRowStacked>
                </div>
              </div>
            </section>

            {/* Dependencies */}
            {task && (
              <section className="space-y-2 border-t border-white/15 pt-4 mt-4 [&>*:first-child]:pt-0">
                <PropertyRowStacked icon={<IconLink />} label="Dependencies">
                  {(() => {
                    const deps =
                      (task as unknown as {
                        dependencies?: Array<{
                          dependsOnTask: { id: string; title: string | null; status: string | null }
                        }>
                      }).dependencies ?? []
                    const dependents =
                      (task as unknown as {
                        dependents?: Array<{
                          task: { id: string; title: string | null; status: string | null }
                        }>
                      }).dependents ?? []
                    const dependencyIds = deps.map((d) => d.dependsOnTask.id)
                    const isLocked = Boolean((task as { isLocked?: boolean }).isLocked)
                    const lockOverride = Boolean((task as { lockOverride?: boolean }).lockOverride)

                    const options = (Array.isArray(allTasks) ? allTasks : [])
                      .filter((t: { id?: string; status?: string | null }) => {
                        if (!t?.id) return false
                        if (t.id === task.id) return false
                        if (t.status === 'done') return false
                        return true
                      })
                      .map((t: { id: string; title?: string | null }) => ({
                        value: t.id,
                        label: t.title?.trim() || '(Uden titel)',
                      }))

                    return (
                      <div className="space-y-3">
                        {isLocked && !lockOverride && (
                          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
                            Denne opgave er blokeret af uafsluttede dependencies.
                          </div>
                        )}

                        <div>
                          <label className="text-xs text-app-muted block mb-1.5">
                            Denne opgave afhænger af
                          </label>
                          <SearchableMultiSelect
                            value={dependencyIds}
                            onChange={(next) =>
                              updateTask.mutate({
                                id: task.id,
                                dependencyIds: next,
                              })
                            }
                            options={options}
                            placeholder="Ingen"
                            searchPlaceholder="Søg opgaver..."
                          />
                          {deps.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3">
                              {deps.map((d) => (
                                <button
                                  key={d.dependsOnTask.id}
                                  type="button"
                                  onClick={() => router.push(`/tasks/${d.dependsOnTask.id}`)}
                                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm text-slate-200 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                                  title="Åbn opgave"
                                >
                                  <span className="truncate max-w-[18rem]">
                                    {d.dependsOnTask.title ?? '(Uden titel)'}
                                  </span>
                                  {d.dependsOnTask.status === 'done' ? (
                                    <span className="text-emerald-300 text-xs">Done</span>
                                  ) : (
                                    <span className="text-amber-300 text-xs">Åben</span>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={lockOverride}
                            onChange={(e) =>
                              updateTask.mutate({
                                id: task.id,
                                lockOverride: e.target.checked,
                              })
                            }
                            className="rounded border-white/20 bg-slate-900/60 text-app-accent focus:ring-app-accent/40"
                          />
                          <span className="text-sm text-slate-200">
                            Override lås (skjul advarsel)
                          </span>
                        </label>

                        <div>
                          <label className="text-xs text-app-muted block mb-1.5">
                            Afhængige opgaver
                          </label>
                          {dependents.length === 0 ? (
                            <p className="text-sm text-app-muted">Ingen.</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {dependents.map((d) => (
                                <button
                                  key={d.task.id}
                                  type="button"
                                  onClick={() => router.push(`/tasks/${d.task.id}`)}
                                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm text-slate-200 bg-slate-900/40 border border-white/10 hover:bg-white/10 transition-colors"
                                  title="Åbn opgave"
                                >
                                  <span className="truncate max-w-[18rem]">
                                    {d.task.title ?? '(Uden titel)'}
                                  </span>
                                  {d.task.status === 'done' ? (
                                    <span className="text-emerald-300 text-xs">Done</span>
                                  ) : (
                                    <span className="text-slate-400 text-xs">
                                      {d.task.status ?? '–'}
                                    </span>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })()}
                </PropertyRowStacked>
              </section>
            )}

            {/* Tilknyttet begivenhed */}
            {task && (
              <section className="space-y-1 border-t border-white/15 pt-4 mt-4 [&>*:first-child]:pt-0">
                <PropertyRowStacked icon={<IconCalendar />} label="Tilknyttet begivenhed">
                  <LinkCalendarEventSection
                    linked={
                      task.linkedEventId
                        ? {
                            linkedEventId: task.linkedEventId,
                            linkedEventTitle: task.linkedEventTitle ?? null,
                            linkedEventUrl: task.linkedEventUrl ?? null,
                          }
                        : null
                    }
                    isPending={updateTask.isPending}
                    onLink={handleLinkCalendarEvent}
                    onUnlink={handleUnlinkCalendarEvent}
                  />
                </PropertyRowStacked>
              </section>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
