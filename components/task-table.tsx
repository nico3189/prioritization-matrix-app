'use client'

import { cn } from '@/lib/utils'
import { getScore, getEffectiveUrgency } from '@/lib/eisenhower'
import type { TaskCardTask } from '@/components/task-card'
import { CopyTaskLinkButton } from '@/components/copy-task-link-button'

const DURATION_LABEL: Record<string, string> = {
  LT15: '<15 min',
  M15_30: '15–30',
  M30_60: '30–60',
  GT60: '>60 min',
}

const TYPE_LABEL: Record<string, string> = {
  kunde: 'Kunde',
  internt: 'Internt',
  salg: 'Salg',
  ledelse: 'Ledelse',
}

const MONTH_SHORT = ['jan.', 'feb.', 'mar.', 'apr.', 'maj', 'jun.', 'jul.', 'aug.', 'sep.', 'okt.', 'nov.', 'dec.']

function formatDeadline(iso: string | Date | null | undefined): string {
  if (!iso) return '–'
  const d = typeof iso === 'string' ? new Date(iso) : iso
  const day = d.getDate()
  const month = MONTH_SHORT[d.getMonth()]
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${day}. ${month} ${h}.${m}`
}

function formatTimestamp(iso: string | Date | null | undefined): string {
  if (!iso) return '–'
  const d = typeof iso === 'string' ? new Date(iso) : iso
  const day = d.getDate()
  const month = MONTH_SHORT[d.getMonth()]
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${day}. ${month} ${d.getFullYear()} ${h}.${m}`
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
      return 'text-app-muted'
  }
}

const iconClass = 'w-3 h-3 shrink-0 text-app-muted'

function IconFileText() {
  return (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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

function IconFolder() {
  return (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
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

function IconTag() {
  return (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
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

export interface TaskTableProps {
  tasks: TaskCardTask[]
  onTaskClick?: (task: TaskCardTask) => void
  onMarkDone?: (task: TaskCardTask) => void
  completingId?: string | null
  /** Ekstra badge per opgave (fx status) */
  getBadge?: (task: TaskCardTask) => React.ReactNode
  /** 'historik' = kun titel, beskrivelse, kunde, type, oprettet, afsluttet */
  variant?: 'default' | 'historik'
  showCopyLink?: boolean
  onCopyLink?: (url: string) => void
}

export function TaskTable({
  tasks,
  onTaskClick,
  onMarkDone,
  completingId,
  getBadge,
  variant = 'default',
  showCopyLink = true,
  onCopyLink,
}: TaskTableProps) {
  const showActions = showCopyLink || !!onMarkDone
  const rowClass =
    'border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors duration-150 cursor-pointer'
  const cellClass = 'px-2 py-2 text-xs'
  const thClass = 'px-2 py-2 text-[11px] font-medium text-app-muted uppercase tracking-wider'

  if (variant === 'historik') {
    return (
      <div className="overflow-x-auto rounded-xl2 border border-white/5 app-card-gradient">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/10">
              <th className={cn(thClass, 'w-[35%] min-w-[8rem]')}>
                <span className="inline-flex items-center gap-1">
                  <IconFileText />
                  Titel
                </span>
              </th>
              <th className={cn(thClass, 'w-[15%] min-w-[5rem] hidden sm:table-cell')}>
                <span className="inline-flex items-center gap-1">
                  <IconCompany />
                  Kunde
                </span>
              </th>
              <th className={cn(thClass, 'w-[12%] min-w-[4rem] hidden md:table-cell')}>
                <span className="inline-flex items-center gap-1">
                  <IconFolder />
                  Type
                </span>
              </th>
              <th className={cn(thClass, 'w-[18%] min-w-[6rem] whitespace-nowrap')}>
                <span className="inline-flex items-center gap-1">
                  <IconCalendar />
                  Oprettet
                </span>
              </th>
              <th className={cn(thClass, 'w-[18%] min-w-[6rem] whitespace-nowrap')}>
                <span className="inline-flex items-center gap-1">
                  <IconClock />
                  Afsluttet
                </span>
              </th>
              {showActions && (
                <th className={cn(thClass, 'w-16')} aria-label="Handlinger" />
              )}
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr
                key={task.id}
                className={rowClass}
                onClick={() => onTaskClick?.(task)}
              >
                <td className={cellClass}>
                  <span className="font-medium text-slate-100 truncate block">
                    {task.title ?? '(Uden titel)'}
                  </span>
                </td>
                <td className={cn(cellClass, 'hidden sm:table-cell text-slate-300 truncate')}>
                  {task.customer?.name ?? '–'}
                </td>
                <td className={cn(cellClass, 'hidden md:table-cell text-app-muted')}>
                  {task.type ? (TYPE_LABEL[task.type] ?? task.type) : '–'}
                </td>
                <td className={cn(cellClass, 'whitespace-nowrap text-app-muted')}>
                  {formatTimestamp(task.createdAt)}
                </td>
                <td className={cn(cellClass, 'whitespace-nowrap', task.completedAt ? 'text-emerald-400/90' : 'text-app-muted')}>
                  {task.completedAt ? formatTimestamp(task.completedAt) : '–'}
                </td>
                {showActions && (
                  <td
                    className={cn(cellClass, 'w-16')}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-0.5">
                      {showCopyLink && (
                        <CopyTaskLinkButton
                          taskId={task.id}
                          onCopied={onCopyLink}
                          className="p-1.5"
                          iconClassName="w-3.5 h-3.5"
                        />
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl2 border border-white/5 app-card-gradient">
      <table className="w-full text-left table-fixed">
        <thead>
          <tr className="border-b border-white/10">
            <th className={cn(thClass, 'w-[40%] min-w-[8rem]')}>
              <span className="inline-flex items-center gap-1">
                <IconFileText />
                Titel
              </span>
            </th>
            <th className={cn(thClass, 'w-[12%] min-w-[5rem] hidden sm:table-cell')}>
              <span className="inline-flex items-center gap-1">
                <IconCompany />
                Kunde
              </span>
            </th>
            <th className={cn(thClass, 'w-[8%] min-w-[4rem] hidden md:table-cell')}>
              <span className="inline-flex items-center gap-1">
                <IconFolder />
                Type
              </span>
            </th>
            <th className={cn(thClass, 'w-12 text-right')}>
              <span className="inline-flex items-center justify-end gap-1 w-full">
                <IconScore />
                Score
              </span>
            </th>
            <th className={cn(thClass, 'w-[14%] min-w-[6rem] hidden md:table-cell whitespace-nowrap')}>
              <span className="inline-flex items-center gap-1">
                <IconCalendar />
                Deadline
              </span>
            </th>
            <th className={cn(thClass, 'w-[10%] min-w-[4rem] hidden lg:table-cell')}>
              <span className="inline-flex items-center gap-1">
                <IconClock />
                Varighed
              </span>
            </th>
            <th className={cn(thClass, 'w-[12%] min-w-[5rem] hidden lg:table-cell')}>
              <span className="inline-flex items-center gap-1">
                <IconTag />
                Tags
              </span>
            </th>
            {showActions && (
              <th className={cn(thClass, 'w-16')} aria-label="Handlinger" />
            )}
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const imp = task.importance ?? 0
            const urg = getEffectiveUrgency(task.urgency ?? 0, task.dueAt ?? null)
            const score = Math.round(getScore(imp, urg))
            const tags =
              task.taskTags && task.taskTags.length > 0
                ? task.taskTags
                    .map((tt) => tt.tag?.name ?? '')
                    .filter(Boolean)
                : (task.tag?.split(',').map((t) => t.trim()).filter(Boolean) ?? [])
            const badge = getBadge?.(task)

            return (
              <tr
                key={task.id}
                className={rowClass}
                onClick={() => onTaskClick?.(task)}
              >
                <td className={cellClass}>
                  <div className="flex flex-col gap-0.5 min-w-0 overflow-hidden">
                    <span className="font-medium text-slate-100 truncate text-xs inline-flex items-center gap-1">
                      {task.title ?? '(Uden titel)'}
                      {task.recurrenceRule && (
                        <span className="text-app-muted shrink-0" title="Gentages">
                          <IconRepeat />
                        </span>
                      )}
                    </span>
                    {badge && <span className="flex items-center gap-1">{badge}</span>}
                  </div>
                </td>
                <td className={cn(cellClass, 'hidden sm:table-cell text-slate-300 truncate')}>
                  {task.customer?.name ?? '–'}
                </td>
                <td className={cn(cellClass, 'hidden md:table-cell text-app-muted')}>
                  {task.type ? (TYPE_LABEL[task.type] ?? task.type) : '–'}
                </td>
                <td className={cn(cellClass, 'text-right tabular-nums text-slate-300')}>
                  {score}
                </td>
                <td className={cn(cellClass, 'hidden md:table-cell whitespace-nowrap')}>
                  {task.dueAt ? (
                    <span
                      className={cn(
                        getDeadlineStyles(getDeadlineUrgency(task.dueAt))
                      )}
                    >
                      {formatDeadline(task.dueAt)}
                      {getDeadlineUrgency(task.dueAt) === 'overdue' && (
                        <span className="ml-1">⚠️</span>
                      )}
                    </span>
                  ) : (
                    '–'
                  )}
                </td>
                <td className={cn(cellClass, 'hidden lg:table-cell text-app-muted')}>
                  {task.durationBucket
                    ? (DURATION_LABEL[task.durationBucket] ?? task.durationBucket)
                    : '–'}
                </td>
                <td className={cn(cellClass, 'hidden lg:table-cell')}>
                  {tags.length > 0 ? (
                    <span className="text-app-muted truncate block">
                      {tags.slice(0, 3).join(', ')}
                      {tags.length > 3 && ' …'}
                    </span>
                  ) : (
                    '–'
                  )}
                </td>
                {showActions && (
                  <td
                    className={cn(cellClass, 'w-16')}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-0.5">
                      {showCopyLink && (
                        <CopyTaskLinkButton
                          taskId={task.id}
                          onCopied={onCopyLink}
                          className="p-1.5"
                          iconClassName="w-3.5 h-3.5"
                        />
                      )}
                      {onMarkDone && task.status !== 'done' && (
                        <button
                          type="button"
                          onClick={() => onMarkDone(task)}
                          className="p-1.5 rounded-md bg-emerald-700/80 text-white hover:bg-emerald-600 transition-colors duration-200 active:scale-95"
                          aria-label="Marker opgave som udført"
                        >
                          {completingId === task.id ? (
                            <span className="inline-block w-3.5 h-3.5 border-2 border-white/60 border-t-white rounded-full animate-spin" />
                          ) : (
                            <IconCheck />
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
