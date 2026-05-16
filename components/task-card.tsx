'use client'

import { cn } from '@/lib/utils'
import { getScore, getEffectiveUrgency } from '@/lib/eisenhower'
import { CopyTaskLinkButton } from '@/components/copy-task-link-button'

const DESCRIPTION_MAX_LEN = 140

const DURATION_LABEL: Record<string, string> = {
  LT15: 'Under 15 min',
  M15_30: '15–30 min',
  M30_60: '30–60 min',
  GT60: 'Over 60 min',
}

const TYPE_LABEL: Record<string, string> = {
  kunde: 'Kunde',
  internt: 'Internt',
  salg: 'Salg',
  ledelse: 'Ledelse',
}

const TAG_COLORS = [
  'bg-violet-500/20 text-violet-300 border-violet-500/30',
  'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  'bg-amber-500/20 text-amber-300 border-amber-500/30',
  'bg-sky-500/20 text-sky-300 border-sky-500/30',
  'bg-rose-500/20 text-rose-300 border-rose-500/30',
]

function truncate(str: string, max: number): string {
  if (!str?.trim()) return ''
  const s = str.trim()
  return s.length <= max ? s : s.slice(0, max) + '…'
}

const MONTH_SHORT = ['jan.', 'feb.', 'mar.', 'apr.', 'maj', 'jun.', 'jul.', 'aug.', 'sep.', 'okt.', 'nov.', 'dec.']

function formatTimestamp(iso: string | Date | null | undefined): string {
  if (!iso) return '–'
  const d = typeof iso === 'string' ? new Date(iso) : iso
  const day = d.getDate()
  const month = MONTH_SHORT[d.getMonth()]
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${day}. ${month} ${d.getFullYear()} ${h}.${m}`
}

function formatDeadline(iso: string | Date | null | undefined): string {
  if (!iso) return ''
  const d = typeof iso === 'string' ? new Date(iso) : iso
  const day = d.getDate()
  const month = MONTH_SHORT[d.getMonth()]
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${day}. ${month} ${h}.${m}`
}

type DeadlineUrgency = 'normal' | '72h' | '48h' | '24h' | '4h' | 'overdue'

function getDeadlineUrgency(dueAt: string | Date | null | undefined): DeadlineUrgency {
  if (!dueAt) return 'normal'
  const due = typeof dueAt === 'string' ? new Date(dueAt) : dueAt
  const now = Date.now()
  const hoursUntil = (due.getTime() - now) / (1000 * 60 * 60)
  if (hoursUntil < 0) return 'overdue'
  if (hoursUntil <= 4) return '4h'
  if (hoursUntil <= 24) return '24h'
  if (hoursUntil <= 48) return '48h'
  if (hoursUntil <= 72) return '72h'
  return 'normal'
}

function getDeadlineStyles(urgency: DeadlineUrgency): string {
  switch (urgency) {
    case 'overdue':
      return 'text-red-400 font-bold'
    case '4h':
      return 'text-red-400 font-bold'
    case '24h':
      return 'text-red-400'
    case '48h':
      return 'text-amber-400'
    case '72h':
      return 'text-slate-100'
    default:
      return ''
  }
}

const iconClass = 'w-3.5 h-3.5 shrink-0 text-app-muted'

function IconFolder() {
  return (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  )
}

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

function IconCalendar() {
  return (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
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

function IconRepeat() {
  return (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  )
}

function IconScore() {
  return (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  )
}

export interface TaskCardTask {
  id: string
  title?: string | null
  notes?: string | null
  type?: string | null
  customer?: { name?: string; code?: string } | null
  delegatedTo?: { name?: string; code?: string } | null
  importance?: number | null
  urgency?: number | null
  importanceManuallyOverriddenAt?: string | Date | null
  urgencyManuallyOverriddenAt?: string | Date | null
  dueAt?: string | Date | null
  durationBucket?: string | null
  tag?: string | null
  taskTags?: Array<{ tag?: { id?: string; name?: string; color?: string } | null }> | null
  status?: string | null
  nextAction?: string | null
  createdAt?: string | Date | null
  completedAt?: string | Date | null
  recurrenceRule?: string | null
}

export interface TaskCardProps {
  task: TaskCardTask
  onClick?: () => void
  onMarkDone?: () => void
  /** Vis kopier-link-knap (til venstre for done) */
  showCopyLink?: boolean
  /** Kaldes efter link er kopieret til udklipsholder */
  onCopyLink?: (url: string) => void
  /** Viser success-overlay med checkmark (bruges når opgave lige er markeret udført) */
  isCompleting?: boolean
  /** Nedtoningsniveau: 'subtle' = lidt, 'strong' = meget (fx for Today's kø-opgaver) */
  greyedOutLevel?: 'subtle' | 'strong'
  className?: string
  /** Ekstra badge (fx status) – vises øverst til højre */
  badge?: React.ReactNode
  /** 'historik' = kun titel, beskrivelse, kunde, type, oprettet, afsluttet */
  variant?: 'default' | 'historik'
}

function IconCheck() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

export function TaskCard({
  task,
  onClick,
  onMarkDone,
  showCopyLink = true,
  onCopyLink,
  isCompleting,
  greyedOutLevel,
  className,
  badge,
  variant = 'default',
}: TaskCardProps) {
  const desc = truncate(task.notes ?? task.nextAction ?? '', DESCRIPTION_MAX_LEN)
  const imp = task.importance ?? 0
  const urg = getEffectiveUrgency(task.urgency ?? 0, task.dueAt ?? null)
  const score = Math.round(getScore(imp, urg))
  const tags =
    task.taskTags && task.taskTags.length > 0
      ? task.taskTags
          .map((tt) => ({ name: tt.tag?.name ?? '', color: tt.tag?.color ?? '#94A3B8' }))
          .filter((t) => t.name)
      : (task.tag?.split(',').map((t) => t.trim()).filter(Boolean) ?? []).map((name, i) => ({
          name,
          color: ['#8B5CF6', '#10B981', '#F59E0B', '#0EA5E9', '#EC4899'][i % 5],
        }))

  if (variant === 'historik') {
    const historikContent = (
      <>
        {isCompleting && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center rounded-xl2 bg-emerald-600/90"
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
        {showCopyLink && (
          <div className="absolute top-3 right-3 z-[1]">
            <CopyTaskLinkButton
              taskId={task.id}
              onCopied={onCopyLink}
              className="p-1.5"
            />
          </div>
        )}
        <div className="mt-3 pr-8">
          <p className="text-base font-medium text-slate-100 leading-tight">{task.title ?? '(Uden titel)'}</p>
          {desc && <p className="text-xs text-slate-400 mt-2 line-clamp-2">{desc}</p>}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-app-muted">
          {task.type && (
            <span className="flex items-center gap-1">
              <IconFolder />
              {TYPE_LABEL[task.type] ?? task.type}
            </span>
          )}
          {task.customer?.name && (
            <span className="flex items-center gap-1">
              <IconCompany />
              {task.customer.name}
            </span>
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-app-muted">
          <span className="flex items-center gap-1">
            <IconCalendar />
            Oprettet: {formatTimestamp(task.createdAt)}
          </span>
          {task.completedAt && (
            <span className="flex items-center gap-1 text-emerald-400/90">
              <IconClock />
              Afsluttet: {formatTimestamp(task.completedAt)}
            </span>
          )}
        </div>
      </>
    )
    const baseClass = cn(
      'relative block w-full min-w-0 text-left app-card-gradient rounded-xl2 p-4 shadow-card border border-white/5 transition-all duration-200 ease-out overflow-hidden',
      greyedOutLevel === 'strong'
        ? 'opacity-30 hover:opacity-45'
        : greyedOutLevel === 'subtle'
          ? 'opacity-75 hover:opacity-85'
          : 'hover:shadow-hover hover:-translate-y-0.5 hover:border-white/10'
    )
    if (onClick) {
      return (
        <div
          role="button"
          tabIndex={0}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('button')) return
            onClick()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              if ((e.target as HTMLElement).closest('button')) return
              onClick()
            }
          }}
          className={cn(baseClass, 'cursor-pointer', className)}
        >
          {historikContent}
        </div>
      )
    }
    return <div className={cn(baseClass, className)}>{historikContent}</div>
  }

  const content = (
    <>
      {isCompleting && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center rounded-xl2 bg-emerald-600/90"
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
      <div className="-mx-4 -mt-4 flex items-center gap-3 rounded-t-xl2 app-surface-gradient px-4 py-3 text-xs text-app-muted">
        <span className="flex items-center gap-1">
          <IconScore />
          {score}
        </span>
        {task.importance != null && (
          <span className="flex items-center gap-1">
            <IconImportance />
            {task.importance}
          </span>
        )}
        {task.urgency != null && (
          <span className="flex items-center gap-1">
            <IconZap />
            {task.urgency}
          </span>
        )}
        {task.dueAt && (
          <>
            <div className="h-4 w-px shrink-0 bg-white/10" aria-hidden />
            <span
              className={cn(
                'flex items-center gap-1 shrink-0 whitespace-nowrap',
                getDeadlineStyles(getDeadlineUrgency(task.dueAt)) || 'text-app-muted'
              )}
            >
              <IconCalendar />
              {formatDeadline(task.dueAt)}
              {getDeadlineUrgency(task.dueAt) === 'overdue' && <span className="ml-1">⚠️</span>}
            </span>
          </>
        )}
        {task.recurrenceRule && (
          <span className="flex items-center gap-1 text-app-muted" title="Gentages">
            <IconRepeat />
          </span>
        )}
        {badge}
        {(showCopyLink || (onMarkDone && task.status !== 'done')) && (
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {showCopyLink && (
              <CopyTaskLinkButton taskId={task.id} onCopied={onCopyLink} />
            )}
            {onMarkDone && task.status !== 'done' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  onMarkDone()
                }}
                className="p-2 rounded-lg bg-emerald-700/80 text-white hover:bg-emerald-600 transition-colors duration-200 ease-out active:scale-95"
                aria-label="Marker opgave som udført"
              >
                <IconCheck />
              </button>
            )}
          </div>
        )}
      </div>
      <div className="mt-3">
        <p className="text-base font-medium text-slate-100 leading-tight">{task.title ?? '(Uden titel)'}</p>
        {desc && (
          <p className="text-xs text-slate-400 mt-2 line-clamp-2">{desc}</p>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-app-muted">
        {task.type && (
          <span className="flex items-center gap-1">
            <IconFolder />
            {TYPE_LABEL[task.type] ?? task.type}
          </span>
        )}
        {task.customer?.name && (
          <span className="flex items-center gap-1">
            <IconCompany />
            {task.customer.name}
          </span>
        )}
        {task.delegatedTo?.name && (
          <span className="flex items-center gap-1">
            <IconUser />
            <span className="text-slate-300">{task.delegatedTo.name}</span>
          </span>
        )}
        {task.durationBucket && (
          <span className="flex items-center gap-1">
            <IconClock />
            {DURATION_LABEL[task.durationBucket] ?? task.durationBucket}
          </span>
        )}
      </div>

      {tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag.name}
              className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium border"
              style={{
                backgroundColor: `${tag.color}20`,
                color: tag.color,
                borderColor: `${tag.color}40`,
              }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}
    </>
  )

  const baseClass = cn(
    'relative block w-full min-w-0 text-left app-card-gradient rounded-xl2 p-4 shadow-card border border-white/5 transition-all duration-200 ease-out overflow-hidden',
    greyedOutLevel === 'strong'
      ? 'opacity-30 hover:opacity-45'
      : greyedOutLevel === 'subtle'
        ? 'opacity-75 hover:opacity-85'
        : 'hover:shadow-hover hover:-translate-y-0.5 hover:border-white/10'
  )

  if (onClick) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('button')) return
          onClick()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            if ((e.target as HTMLElement).closest('button')) return
            onClick()
          }
        }}
        className={cn(baseClass, 'cursor-pointer', className)}
      >
        {content}
      </div>
    )
  }

  return <div className={cn(baseClass, className)}>{content}</div>
}
