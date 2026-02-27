'use client'

import { useMemo } from 'react'
import { getScore, getEffectiveUrgency } from '@/lib/eisenhower'

export type SortOption =
  | 'newest'
  | 'oldest'
  | 'deadline'
  | 'priority'
  | 'title'

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Nyeste først' },
  { value: 'oldest', label: 'Ældste først' },
  { value: 'deadline', label: 'Deadline snarest' },
  { value: 'priority', label: 'Prioritet højst' },
  { value: 'title', label: 'Titel A-Å' },
]

export type SearchPrefix = 'kunde' | 'tag' | 'titel' | 'noter' | 'type'

export const SEARCH_PREFIXES: { key: SearchPrefix; label: string }[] = [
  { key: 'kunde', label: 'Kunde (navn eller kode)' },
  { key: 'tag', label: 'Tag' },
  { key: 'titel', label: 'Titel' },
  { key: 'noter', label: 'Noter' },
  { key: 'type', label: 'Type (kunde, internt, salg, ledelse)' },
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

function taskMatchesSearch<T extends TaskForFilter>(task: T, parsed: ParsedSearch): boolean {
  const { prefixFilters, generalTerms } = parsed
  for (const { key, value } of prefixFilters) {
    switch (key) {
      case 'kunde': {
        const name = (task.customer?.name ?? '').toLowerCase()
        const code = (task.customer as { code?: string } | null)?.code?.toLowerCase() ?? ''
        if (!name.includes(value) && !code.includes(value)) return false
        break
      }
      case 'tag': {
        const tagNames = (task.taskTags ?? [])
          .map((tt) => (tt.tag?.name ?? '').toLowerCase())
          .join(' ')
        if (!tagNames.includes(value)) return false
        break
      }
      case 'titel': {
        const title = (task.title ?? '').toLowerCase()
        if (!title.includes(value)) return false
        break
      }
      case 'noter': {
        const notes = (task.notes ?? '').toLowerCase()
        if (!notes.includes(value)) return false
        break
      }
      case 'type': {
        const type = (task.type ?? '').toLowerCase()
        if (!type.includes(value)) return false
        break
      }
    }
  }
  for (const term of generalTerms) {
    const title = (task.title ?? '').toLowerCase()
    const notes = (task.notes ?? '').toLowerCase()
    const customerName = (task.customer?.name ?? '').toLowerCase()
    const customerCode = (task.customer as { code?: string } | null)?.code?.toLowerCase() ?? ''
    const tagNames = (task.taskTags ?? [])
      .map((tt) => (tt.tag?.name ?? '').toLowerCase())
      .join(' ')
    const type = (task.type ?? '').toLowerCase()
    const matches =
      title.includes(term) ||
      notes.includes(term) ||
      customerName.includes(term) ||
      customerCode.includes(term) ||
      tagNames.includes(term) ||
      type.includes(term)
    if (!matches) return false
  }
  return true
}

export interface TaskForFilter {
  id: string
  title?: string | null
  notes?: string | null
  createdAt?: string | null
  dueAt?: string | null
  importance?: number | null
  urgency?: number | null
  type?: string | null
  customer?: { name?: string; code?: string } | null
  taskTags?: Array<{ tag?: { name?: string } | null }> | null
  [k: string]: unknown
}

export function useFilteredAndSortedTasks<T extends TaskForFilter>(
  tasks: T[],
  sortBy: SortOption,
  searchQuery: string
): T[] {
  return useMemo(() => {
    const list = Array.isArray(tasks) ? tasks : []
    const parsed = parseSearchQuery(searchQuery)
    const hasFilters = parsed.prefixFilters.length > 0 || parsed.generalTerms.length > 0
    const filtered = hasFilters
      ? list.filter((t) => taskMatchesSearch(t, parsed))
      : list

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
        default:
          return 0
      }
    })
  }, [tasks, sortBy, searchQuery])
}

export interface TaskListFiltersBarProps {
  sortBy: SortOption
  onSortChange: (s: SortOption) => void
  searchQuery: string
  onSearchChange: (q: string) => void
  resultCount?: number
  totalCount?: number
}

export function TaskListFiltersBar({
  sortBy,
  onSortChange,
  searchQuery,
  onSearchChange,
  resultCount,
  totalCount,
}: TaskListFiltersBarProps) {
  const showCount =
    resultCount !== undefined &&
    totalCount !== undefined &&
    searchQuery.trim() !== '' &&
    resultCount !== totalCount

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <select
        value={sortBy}
        onChange={(e) => onSortChange(e.target.value as SortOption)}
        className="bg-slate-900/60 border border-white/5 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-app-accent/40"
        aria-label="Sortering"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <input
        type="search"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Tilgængelige termer: kunde, tag, titel, noter, type - efterfulgt af :"
        title="Præfikser: kunde, tag, titel, noter, type. Fx kunde:XYZ tag:urgent"
        aria-label="Søg"
        className="flex-1 min-w-[180px] bg-slate-900/60 border border-white/5 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent/40"
      />
      {showCount && (
        <span className="text-xs text-app-muted">
          {resultCount} af {totalCount}
        </span>
      )}
    </div>
  )
}
