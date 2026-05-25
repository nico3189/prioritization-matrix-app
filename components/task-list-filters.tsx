'use client'

import {
  useMemo,
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
  useCallback,
} from 'react'
import { format, parseISO } from 'date-fns'
import { da } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { getScore, getEffectiveUrgency } from '@/lib/eisenhower'
import { SearchableMultiSelect } from '@/components/searchable-multi-select'
import { AppDatePicker } from '@/components/app-date-picker'

const DURATION_BUCKETS = [
  { value: 'LT15', label: 'Under 15 min' },
  { value: 'M15_30', label: '15–30 min' },
  { value: 'M30_60', label: '30–60 min' },
  { value: 'GT60', label: 'Over 60 min' },
]

function formatDeadlineDisplay(iso: string): string {
  if (!iso) return ''
  try {
    const d = parseISO(iso)
    return format(d, "dd/MM/yyyy HH:mm", { locale: da })
  } catch {
    return iso
  }
}

export type TaskListViewMode = 'grid' | 'table'

const TASK_LIST_VIEW_KEY = 'task-list-view-mode'

interface UseTaskListViewModeOptions {
	defaultMode?: TaskListViewMode
	storageKey?: string
}

export function useTaskListViewMode(
	options: UseTaskListViewModeOptions = {}
): [TaskListViewMode, (mode: TaskListViewMode) => void] {
	const defaultMode = options.defaultMode ?? 'grid'
	const storageKey = options.storageKey ?? TASK_LIST_VIEW_KEY
	const [mode, setMode] = useState<TaskListViewMode>(defaultMode)
	useEffect(() => {
		if (typeof window === 'undefined') return
		const stored = localStorage.getItem(storageKey) as TaskListViewMode | null
		if (stored === 'grid' || stored === 'table') setMode(stored)
	}, [storageKey])
	const setAndPersist = (m: TaskListViewMode) => {
		setMode(m)
		if (typeof window !== 'undefined') {
			localStorage.setItem(storageKey, m)
		}
	}
	return [mode, setAndPersist]
}

export type SortOption =
  | 'newest'
  | 'oldest'
  | 'deadline'
  | 'priority'
  | 'title'
  | 'completedDesc'
  | 'completedAsc'

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Nyeste først' },
  { value: 'oldest', label: 'Ældste først' },
  { value: 'completedDesc', label: 'Afsluttet nyeste først' },
  { value: 'completedAsc', label: 'Afsluttet ældste først' },
  { value: 'deadline', label: 'Deadline snarest' },
  { value: 'priority', label: 'Prioritet højst' },
  { value: 'title', label: 'Titel A-Å' },
]

const TASK_TYPES = [
  { value: 'kunde', label: 'Kunde' },
  { value: 'internt', label: 'Internt' },
  { value: 'salg', label: 'Salg' },
  { value: 'ledelse', label: 'Ledelse' },
]

function isCuid(s: string): boolean {
  return /^c[a-z0-9]{24}$/i.test(s) || s.length >= 20
}

function taskMatchesFilters<T extends TaskForFilter>(task: T, filters: TaskListFilters): boolean {
  const v = (s: string) => s.trim().toLowerCase()

  if (filters.kunde.length > 0) {
    const custId =
      (task as { customerId?: string | null }).customerId ??
      (task.customer as { id?: string } | null)?.id
    const name = (task.customer?.name ?? '').toLowerCase()
    const code = (task.customer as { code?: string } | null)?.code?.toLowerCase() ?? ''
    const matches = filters.kunde.some((f) => {
      if (isCuid(f)) return custId === f
      return name.includes(v(f)) || code.includes(v(f))
    })
    if (!matches) return false
  }

  if (filters.tag.length > 0) {
    const tagIds = (task.taskTags ?? [])
      .map((tt) => (tt.tag as { id?: string } | null)?.id)
      .filter(Boolean) as string[]
    const tagNames = (task.taskTags ?? [])
      .map((tt) => (tt.tag?.name ?? '').toLowerCase())
      .join(' ')
    const matches = filters.tag.some((f) => {
      if (isCuid(f)) return tagIds.includes(f)
      return tagNames.includes(v(f))
    })
    if (!matches) return false
  }

  if (filters.titel.length > 0) {
    const title = (task.title ?? '').toLowerCase()
    const matches = filters.titel.some((f) => title.includes(v(f)))
    if (!matches) return false
  }

  if (filters.noter.length > 0) {
    const notes = (task.notes ?? '').toLowerCase()
    const matches = filters.noter.some((f) => notes.includes(v(f)))
    if (!matches) return false
  }

  if (filters.type.length > 0) {
    const type = (task.type ?? '').toLowerCase()
    const matches = filters.type.some((f) => type.includes(v(f)))
    if (!matches) return false
  }

  if (filters.varighed.length > 0) {
    const bucket = (task as { durationBucket?: string | null }).durationBucket ?? ''
    if (!filters.varighed.includes(bucket)) return false
  }

  if (filters.delegereTil.length > 0) {
    const delId =
      (task as { delegatedToId?: string | null }).delegatedToId ??
      (task.delegatedTo as { id?: string } | null)?.id
    if (!delId || !filters.delegereTil.includes(delId)) return false
  }

  if (filters.deadlineFra) {
    const dueAt = task.dueAt
    if (!dueAt) return false
    const dueMs = new Date(dueAt).getTime()
    const fraMs = new Date(filters.deadlineFra).getTime()
    if (dueMs < fraMs) return false
  }

  if (filters.deadlineTil) {
    const dueAt = task.dueAt
    if (!dueAt) return false
    const dueMs = new Date(dueAt).getTime()
    const tilMs = new Date(filters.deadlineTil).getTime()
    if (dueMs > tilMs) return false
    if (!filters.deadlineFra) {
      const nowMs = Date.now()
      if (dueMs < nowMs) return false
    }
  }

  return true
}

export type SearchPrefix =
  | 'kunde'
  | 'tag'
  | 'titel'
  | 'noter'
  | 'type'
  | 'delegeret'
  | 'url'

export const SEARCH_PREFIXES: { key: SearchPrefix; label: string }[] = [
  { key: 'kunde', label: 'Kunde (navn eller kode)' },
  { key: 'tag', label: 'Tag' },
  { key: 'titel', label: 'Titel' },
  { key: 'noter', label: 'Noter' },
  { key: 'type', label: 'Type (kunde, internt, salg, ledelse)' },
  { key: 'delegeret', label: 'Delegeret til' },
  { key: 'url', label: 'URL' },
]

export interface ParsedSearch {
  prefixFilters: Array<{ key: SearchPrefix; value: string }>
  generalTerms: string[]
}

export function parseSearchQuery(query: string): ParsedSearch {
  const trimmed = query.trim()
  if (!trimmed) return { prefixFilters: [], generalTerms: [] }
  const prefixKeys = SEARCH_PREFIXES.map((p) => p.key)
  const prefixFilters: Array<{ key: SearchPrefix; value: string }> = []
  const generalTerms: string[] = []
  const tokens = trimmed.split(/\s+/)
  for (const token of tokens) {
    const colonIdx = token.indexOf(':')
    if (colonIdx > 0) {
      const key = token.slice(0, colonIdx).toLowerCase()
      const value = token.slice(colonIdx + 1).trim().toLowerCase()
      if (value && prefixKeys.includes(key as SearchPrefix)) {
        prefixFilters.push({ key: key as SearchPrefix, value })
      } else if (value) {
        generalTerms.push(token.toLowerCase())
      }
    } else if (token) {
      generalTerms.push(token.toLowerCase())
    }
  }
  return { prefixFilters, generalTerms }
}

function buildTaskSearchHaystack<T extends TaskForFilter>(task: T): string {
  const bucket = task.durationBucket ?? ''
  const bucketLabel =
    DURATION_BUCKETS.find((b) => b.value === bucket)?.label ?? ''
  const parts = [
    task.id,
    task.title,
    task.notes,
    task.type,
    task.customer?.name,
    (task.customer as { code?: string } | null)?.code,
    task.delegatedTo?.name,
    (task as { url?: string | null }).url,
    (task as { nextAction?: string | null }).nextAction,
    (task as { linkedEventTitle?: string | null }).linkedEventTitle,
    (task as { tag?: string | null }).tag,
    bucket,
    bucketLabel,
    ...(task.taskTags ?? []).map((tt) => tt.tag?.name),
  ]
  return parts
    .filter((p): p is string => typeof p === 'string' && p.length > 0)
    .join(' ')
    .toLowerCase()
}

function taskMatchesSearch<T extends TaskForFilter>(
  task: T,
  parsed: ParsedSearch
): boolean {
  const { prefixFilters, generalTerms } = parsed
  const v = (s: string) => s.trim().toLowerCase()

  for (const { key, value } of prefixFilters) {
    switch (key) {
      case 'kunde': {
        const name = (task.customer?.name ?? '').toLowerCase()
        const code =
          (task.customer as { code?: string } | null)?.code?.toLowerCase() ?? ''
        if (!name.includes(value) && !code.includes(value)) return false
        break
      }
      case 'tag': {
        const tagNames = (task.taskTags ?? [])
          .map((tt) => (tt.tag?.name ?? '').toLowerCase())
          .join(' ')
        const legacy = ((task as { tag?: string | null }).tag ?? '').toLowerCase()
        if (!tagNames.includes(value) && !legacy.includes(value)) return false
        break
      }
      case 'titel': {
        if (!(task.title ?? '').toLowerCase().includes(value)) return false
        break
      }
      case 'noter': {
        if (!(task.notes ?? '').toLowerCase().includes(value)) return false
        break
      }
      case 'type': {
        if (!(task.type ?? '').toLowerCase().includes(value)) return false
        break
      }
      case 'delegeret': {
        const name = (task.delegatedTo?.name ?? '').toLowerCase()
        if (!name.includes(value)) return false
        break
      }
      case 'url': {
        const url = ((task as { url?: string | null }).url ?? '').toLowerCase()
        if (!url.includes(value)) return false
        break
      }
    }
  }

  if (generalTerms.length === 0) return true

  const haystack = buildTaskSearchHaystack(task)
  return generalTerms.every((term) => haystack.includes(v(term)))
}

export interface TaskListFilters {
  kunde: string[]
  tag: string[]
  titel: string[]
  noter: string[]
  type: string[]
  varighed: string[]
  delegereTil: string[]
  deadlineFra: string
  deadlineTil: string
}

export const DEFAULT_TASK_LIST_FILTERS: TaskListFilters = {
  kunde: [],
  tag: [],
  titel: [],
  noter: [],
  type: [],
  varighed: [],
  delegereTil: [],
  deadlineFra: '',
  deadlineTil: '',
}

export interface TaskForFilter {
  id: string
  title?: string | null
  notes?: string | null
  createdAt?: string | null
  completedAt?: string | null
  dueAt?: string | null
  importance?: number | null
  urgency?: number | null
  type?: string | null
  durationBucket?: string | null
  delegatedToId?: string | null
  delegatedTo?: { id?: string; name?: string } | null
  customer?: { id?: string; name?: string; code?: string } | null
  customerId?: string | null
  taskTags?: Array<{ tag?: { id?: string; name?: string } | null }> | null
  [k: string]: unknown
}

export function useFilteredAndSortedTasks<T extends TaskForFilter>(
  tasks: T[],
  sortBy: SortOption,
  filters: TaskListFilters,
  searchQuery = ''
): T[] {
  return useMemo(() => {
    const list = Array.isArray(tasks) ? tasks : []
    const hasFilters = Object.entries(filters).some(([, v]) =>
      Array.isArray(v) ? v.length > 0 : typeof v === 'string' && v.trim() !== ''
    )
    const afterFilters = hasFilters
      ? list.filter((t) => taskMatchesFilters(t, filters))
      : list

    const parsed = parseSearchQuery(searchQuery)
    const hasSearch =
      parsed.prefixFilters.length > 0 || parsed.generalTerms.length > 0
    const filtered = hasSearch
      ? afterFilters.filter((t) => taskMatchesSearch(t, parsed))
      : afterFilters

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'newest': {
          const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0
          const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0
          return bDate - aDate
        }
        case 'oldest': {
          const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0
          const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0
          return aDate - bDate
        }
        case 'deadline': {
          const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER
          const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER
          return aDue - bDue
        }
        case 'priority': {
          const impA = a.importance ?? 0
          const impB = b.importance ?? 0
          const urgA = getEffectiveUrgency(a.urgency ?? 0, a.dueAt ?? null)
          const urgB = getEffectiveUrgency(b.urgency ?? 0, b.dueAt ?? null)
          return getScore(impB, urgB) - getScore(impA, urgA)
        }
        case 'title': {
          const titleA = (a.title ?? '').toLowerCase()
          const titleB = (b.title ?? '').toLowerCase()
          return titleA.localeCompare(titleB)
        }
        case 'completedDesc': {
          const aDate = a.completedAt ? new Date(a.completedAt).getTime() : 0
          const bDate = b.completedAt ? new Date(b.completedAt).getTime() : 0
          return bDate - aDate
        }
        case 'completedAsc': {
          const aDate = a.completedAt ? new Date(a.completedAt).getTime() : Number.MAX_SAFE_INTEGER
          const bDate = b.completedAt ? new Date(b.completedAt).getTime() : Number.MAX_SAFE_INTEGER
          return aDate - bDate
        }
        default:
          return 0
      }
    })
  }, [tasks, sortBy, filters, searchQuery])
}

export interface TaskListFiltersBarProps {
  sortBy: SortOption
  onSortChange: (s: SortOption) => void
  filters: TaskListFilters
  onFiltersChange: (f: TaskListFilters) => void
  searchQuery: string
  onSearchChange: (q: string) => void
  tasks: TaskForFilter[]
  resultCount?: number
  totalCount?: number
  viewMode?: TaskListViewMode
  onViewModeChange?: (mode: TaskListViewMode) => void
}

function deriveOptionsFromTasks(tasks: TaskForFilter[]) {
  const list = Array.isArray(tasks) ? tasks : []
  const customerMap = new Map<string, { name: string; code?: string }>()
  const tagMap = new Map<string, string>()
  const typeSet = new Set<string>()
  const durationSet = new Set<string>()
  const delegatedMap = new Map<string, string>()

  for (const t of list) {
    const cust = t.customer as { id?: string; name?: string; code?: string } | null
    if (cust?.id) {
      customerMap.set(cust.id, { name: cust.name ?? '', code: cust.code })
    }
    for (const tt of t.taskTags ?? []) {
      const tag = tt.tag as { id?: string; name?: string } | null
      if (tag?.id && !tagMap.has(tag.id)) {
        tagMap.set(tag.id, tag.name ?? '')
      }
    }
    if (t.type) typeSet.add(t.type)
    const bucket = (t as { durationBucket?: string | null }).durationBucket
    if (bucket) durationSet.add(bucket)
    const del = t.delegatedTo as { id?: string; name?: string } | null
    if (del?.id) {
      delegatedMap.set(del.id, del.name ?? '')
    }
  }

  const customerOptions = Array.from(customerMap.entries())
    .sort((a, b) => a[1].name.localeCompare(b[1].name))
    .map(([id, { name, code }]) => ({
      value: id,
      label: code ? `${name} (${code})` : name,
    }))
  const tagOptions = Array.from(tagMap.entries())
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([id, name]) => ({ value: id, label: name }))
  const typeOptions = TASK_TYPES.filter((opt) => typeSet.has(opt.value))
  const varighedOptions = DURATION_BUCKETS.filter((opt) => durationSet.has(opt.value))
  const delegereTilOptions = Array.from(delegatedMap.entries())
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([id, name]) => ({ value: id, label: name }))

  return {
    customerOptions,
    tagOptions,
    typeOptions,
    varighedOptions,
    delegereTilOptions,
  }
}

const FILTER_MENU_WIDTH = 380
const FILTER_MENU_VIEWPORT_GUTTER = 12

interface FilterMenuPanelPosition {
  top: number
  left: number
  width: number
  maxHeight: number
}

function computeFilterMenuPanelPosition(
  anchor: DOMRect
): FilterMenuPanelPosition {
  const width = Math.min(
    FILTER_MENU_WIDTH,
    window.innerWidth - FILTER_MENU_VIEWPORT_GUTTER * 2
  )
  let left = anchor.left
  if (left + width > window.innerWidth - FILTER_MENU_VIEWPORT_GUTTER) {
    left = window.innerWidth - width - FILTER_MENU_VIEWPORT_GUTTER
  }
  left = Math.max(FILTER_MENU_VIEWPORT_GUTTER, left)
  const top = anchor.bottom + 8
  const maxHeight = Math.min(
    window.innerHeight * 0.85,
    window.innerHeight - top - FILTER_MENU_VIEWPORT_GUTTER
  )
  return {
    top,
    left,
    width,
    maxHeight: Math.max(160, maxHeight),
  }
}

export function TaskListFiltersBar({
  sortBy,
  onSortChange,
  filters,
  onFiltersChange,
  searchQuery,
  onSearchChange,
  tasks,
  resultCount,
  totalCount,
  viewMode,
  onViewModeChange,
}: TaskListFiltersBarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPanelPos, setMenuPanelPos] =
    useState<FilterMenuPanelPosition | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const updateMenuPanelPosition = useCallback(() => {
    if (!menuRef.current) return
    setMenuPanelPos(
      computeFilterMenuPanelPosition(
        menuRef.current.getBoundingClientRect()
      )
    )
  }, [])

  useLayoutEffect(() => {
    if (!menuOpen) {
      setMenuPanelPos(null)
      return
    }
    updateMenuPanelPosition()
    window.addEventListener('resize', updateMenuPanelPosition)
    window.addEventListener('scroll', updateMenuPanelPosition, true)
    return () => {
      window.removeEventListener('resize', updateMenuPanelPosition)
      window.removeEventListener(
        'scroll',
        updateMenuPanelPosition,
        true
      )
    }
  }, [menuOpen, updateMenuPanelPosition])

  const { customerOptions, tagOptions, typeOptions, varighedOptions, delegereTilOptions } =
    useMemo(() => deriveOptionsFromTasks(tasks), [tasks])

  const hasFilters = Object.entries(filters).some(([, v]) =>
    Array.isArray(v) ? v.length > 0 : typeof v === 'string' && v.trim() !== ''
  )
  const hasSearch = searchQuery.trim().length > 0
  const showCount =
    resultCount !== undefined &&
    totalCount !== undefined &&
    (hasFilters || hasSearch) &&
    resultCount !== totalCount

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (!menuRef.current?.contains(target)) {
        const el = (e.target as Element).closest?.(
          '[data-app-date-picker], [data-app-select-list]'
        )
        if (el) return
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const activeFilterCount =
    filters.kunde.length +
    filters.tag.length +
    filters.titel.length +
    filters.noter.length +
    filters.type.length +
    filters.varighed.length +
    filters.delegereTil.length +
    (filters.deadlineFra ? 1 : 0) +
    (filters.deadlineTil ? 1 : 0)

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <input
        type="search"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Søg opgaver..."
        title="Søger i titel, noter, kunde, tags, type, delegeret, URL, næste handling m.m. Præfikser: kunde:, tag:, titel:, noter:, type:, delegeret:, url:"
        aria-label="Søg i opgaver"
        className="flex-1 min-w-[200px] bg-slate-900/60 border border-white/5 rounded-lg px-4 py-2 text-sm text-slate-200 placeholder:text-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent/40"
      />
      <select
        value={sortBy}
        onChange={(e) => onSortChange(e.target.value as SortOption)}
        className="shrink-0 w-full sm:w-auto bg-slate-900/60 border border-white/5 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-app-accent/40"
        aria-label="Sortering"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <div ref={menuRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
            'bg-app-card border border-white/5 shadow-card',
            'hover:shadow-hover hover:border-white/10',
            menuOpen && 'ring-2 ring-app-accent/40'
          )}
          aria-expanded={menuOpen}
          aria-haspopup="dialog"
        >
          <svg className="w-4 h-4 text-app-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filtre
          {activeFilterCount > 0 && (
            <span className="ml-1 min-w-[1.25rem] h-5 px-1.5 rounded-full bg-app-accent/20 text-xs text-slate-200 flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>

        {menuOpen && menuPanelPos && (
          <div
            className="fixed z-50 overflow-y-auto rounded-xl2 border border-white/10 bg-app-card shadow-card animate-[dropdownIn_150ms_ease-out_forwards]"
            style={{
              top: menuPanelPos.top,
              left: menuPanelPos.left,
              width: menuPanelPos.width,
              maxHeight: menuPanelPos.maxHeight,
            }}
            role="dialog"
            aria-label="Filtermenu"
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/5">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Filtre
              </span>
              {hasFilters && (
                <button
                  type="button"
                  onClick={() => onFiltersChange(DEFAULT_TASK_LIST_FILTERS)}
                  className="text-xs text-app-muted hover:text-slate-300 transition-colors shrink-0"
                >
                  Ryd filtre
                </button>
              )}
            </div>

            <div>
              <div className="px-4 py-2.5 bg-slate-900/30">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Kategorisering
                </span>
              </div>
              <div className="p-4 pt-2 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-app-muted block mb-1.5">Kunde</label>
                  <SearchableMultiSelect
                    value={filters.kunde}
                    onChange={(v) => onFiltersChange({ ...filters, kunde: v })}
                    options={customerOptions}
                    placeholder="Alle"
                    searchPlaceholder="Søg..."
                  />
                </div>
                <div>
                  <label className="text-xs text-app-muted block mb-1.5">Tag</label>
                  <SearchableMultiSelect
                    value={filters.tag}
                    onChange={(v) => onFiltersChange({ ...filters, tag: v })}
                    options={tagOptions}
                    placeholder="Alle"
                    searchPlaceholder="Søg..."
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-app-muted block mb-1.5">Type</label>
                  <SearchableMultiSelect
                    value={filters.type}
                    onChange={(v) => onFiltersChange({ ...filters, type: v })}
                    options={typeOptions}
                    placeholder="Alle typer"
                    searchPlaceholder="Søg..."
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-white/5">
              <div className="px-4 py-2.5 bg-slate-900/30">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Søg i indhold
                </span>
              </div>
              <div className="p-4 pt-2 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-app-muted block mb-1.5">Titel</label>
                  <input
                    type="text"
                    value={filters.titel.join(' ')}
                    onChange={(e) =>
                      onFiltersChange({
                        ...filters,
                        titel: e.target.value.trim().split(/\s+/).filter(Boolean),
                      })
                    }
                    placeholder="Søg..."
                    className="w-full bg-slate-900/60 border border-white/5 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent/40"
                    aria-label="Søg i titel"
                  />
                </div>
                <div>
                  <label className="text-xs text-app-muted block mb-1.5">Noter</label>
                  <input
                    type="text"
                    value={filters.noter.join(' ')}
                    onChange={(e) =>
                      onFiltersChange({
                        ...filters,
                        noter: e.target.value.trim().split(/\s+/).filter(Boolean),
                      })
                    }
                    placeholder="Søg..."
                    className="w-full bg-slate-900/60 border border-white/5 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent/40"
                    aria-label="Søg i noter"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-white/5">
              <div className="px-4 py-2.5 bg-slate-900/30">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Planlægning
                </span>
              </div>
              <div className="p-4 pt-2 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-app-muted block mb-1.5">Varighed</label>
                    <SearchableMultiSelect
                      value={filters.varighed}
                      onChange={(v) => onFiltersChange({ ...filters, varighed: v })}
                      options={varighedOptions}
                      placeholder="Alle"
                      searchPlaceholder="Søg..."
                    />
                  </div>
                  <div>
                    <label className="text-xs text-app-muted block mb-1.5">Deleger til</label>
                    <SearchableMultiSelect
                      value={filters.delegereTil}
                      onChange={(v) => onFiltersChange({ ...filters, delegereTil: v })}
                      options={delegereTilOptions}
                      placeholder="Alle"
                      searchPlaceholder="Søg..."
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-app-muted block mb-1.5">Deadline</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-white/5 bg-slate-900/60 px-3 py-2">
                      <AppDatePicker
                        value={filters.deadlineFra}
                        onChange={(v) => onFiltersChange({ ...filters, deadlineFra: v })}
                        formatDisplay={formatDeadlineDisplay}
                        placeholder="Fra"
                        className="w-full min-w-0"
                      />
                    </div>
                    <div className="rounded-lg border border-white/5 bg-slate-900/60 px-3 py-2">
                      <AppDatePicker
                        value={filters.deadlineTil}
                        onChange={(v) => onFiltersChange({ ...filters, deadlineTil: v })}
                        formatDisplay={formatDeadlineDisplay}
                        placeholder="Til"
                        className="w-full min-w-0"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {viewMode != null && onViewModeChange && (
        <div
          className="flex rounded-lg border border-white/5 overflow-hidden bg-slate-900/60 shrink-0"
          role="group"
          aria-label="Visning"
        >
          <button
            type="button"
            onClick={() => onViewModeChange('grid')}
            className={cn(
              'px-3 py-2 text-sm transition-colors duration-200',
              viewMode === 'grid'
                ? 'bg-app-accent/20 text-slate-100'
                : 'text-app-muted hover:text-slate-200'
            )}
            title="Grid-visning"
            aria-pressed={viewMode === 'grid'}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('table')}
            className={cn(
              'px-3 py-2 text-sm transition-colors duration-200',
              viewMode === 'table'
                ? 'bg-app-accent/20 text-slate-100'
                : 'text-app-muted hover:text-slate-200'
            )}
            title="Tabel-visning"
            aria-pressed={viewMode === 'table'}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
      )}
      {showCount && (
        <span className="text-xs text-app-muted">
          {resultCount} af {totalCount}
        </span>
      )}
    </div>
  )
}
