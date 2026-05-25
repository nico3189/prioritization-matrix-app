'use client'

import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

export interface SearchableMultiSelectOption {
  value: string
  label: string
}

interface SearchableMultiSelectProps {
  value: string[]
  onChange: (value: string[]) => void
  options: SearchableMultiSelectOption[]
  placeholder?: string
  searchPlaceholder?: string
  className?: string
  id?: string
}

const baseInputClass =
  'bg-slate-900/60 border border-white/5 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent/40'

const DROPDOWN_GAP = 4
const DROPDOWN_MAX_HEIGHT = 224
const DROPDOWN_MIN_HEIGHT = 80
const VIEWPORT_GUTTER = 8
const DROPDOWN_MIN_WIDTH = 192

interface DropdownPlacement {
  top?: number
  bottom?: number
  left: number
  width: number
  maxHeight: number
}

function computeDropdownPlacement(anchor: DOMRect): DropdownPlacement {
  const width = Math.max(anchor.width, DROPDOWN_MIN_WIDTH)
  let left = anchor.left
  if (left + width > window.innerWidth - VIEWPORT_GUTTER) {
    left = window.innerWidth - width - VIEWPORT_GUTTER
  }
  left = Math.max(VIEWPORT_GUTTER, left)

  const spaceBelow =
    window.innerHeight - anchor.bottom - DROPDOWN_GAP - VIEWPORT_GUTTER
  const spaceAbove = anchor.top - DROPDOWN_GAP - VIEWPORT_GUTTER
  const openAbove =
    spaceBelow < DROPDOWN_MIN_HEIGHT && spaceAbove > spaceBelow

  if (openAbove) {
    return {
      bottom: window.innerHeight - anchor.top + DROPDOWN_GAP,
      left,
      width,
      maxHeight: Math.min(
        DROPDOWN_MAX_HEIGHT,
        Math.max(DROPDOWN_MIN_HEIGHT, spaceAbove)
      ),
    }
  }

  return {
    top: anchor.bottom + DROPDOWN_GAP,
    left,
    width,
    maxHeight: Math.min(
      DROPDOWN_MAX_HEIGHT,
      Math.max(DROPDOWN_MIN_HEIGHT, spaceBelow)
    ),
  }
}

export function SearchableMultiSelect({
  value,
  onChange,
  options,
  placeholder = 'Vælg...',
  searchPlaceholder = 'Søg...',
  className = '',
  id,
}: SearchableMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [placement, setPlacement] = useState<DropdownPlacement | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedSet = new Set(value)
  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.trim().toLowerCase())
  )

  const updatePlacement = useCallback(() => {
    if (!containerRef.current) return
    setPlacement(
      computeDropdownPlacement(
        containerRef.current.getBoundingClientRect()
      )
    )
  }, [])

  useLayoutEffect(() => {
    if (!isOpen) {
      setPlacement(null)
      return
    }
    updatePlacement()
    window.addEventListener('resize', updatePlacement)
    window.addEventListener('scroll', updatePlacement, true)
    return () => {
      window.removeEventListener('resize', updatePlacement)
      window.removeEventListener('scroll', updatePlacement, true)
    }
  }, [isOpen, updatePlacement])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (
        containerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return
      }
      setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (isOpen) {
      setSearch('')
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [isOpen])

  function toggle(opt: SearchableMultiSelectOption) {
    const next = selectedSet.has(opt.value)
      ? value.filter((v) => v !== opt.value)
      : [...value, opt.value]
    onChange(next)
  }

  function handleClear() {
    onChange([])
  }

  const listMaxHeight = placement
    ? Math.max(40, placement.maxHeight - 52)
    : 160

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        id={id}
        onClick={() => setIsOpen((o) => !o)}
        className={cn(
          'w-full flex items-center justify-between gap-2 min-h-[38px]',
          baseInputClass,
          'text-left cursor-pointer'
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="flex flex-wrap gap-1.5 min-w-0">
          {value.length > 0 ? (
            value.map((id) => {
              const label = options.find((o) => o.value === id)?.label ?? id
              return (
                <span
                  key={id}
                  className="inline-flex items-center px-2 py-0.5 rounded bg-app-accent/20 text-slate-200 text-xs truncate max-w-[8rem]"
                >
                  {label}
                </span>
              )
            })
          ) : (
            <span className="text-app-muted">{placeholder}</span>
          )}
        </span>
        <svg
          className={cn(
            'w-4 h-4 text-app-muted shrink-0 transition-transform',
            isOpen && 'rotate-180'
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen &&
        placement &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={dropdownRef}
            data-app-select-list
            className="fixed z-[110] rounded-lg border border-white/10 bg-slate-900 shadow-card py-1 overflow-hidden flex flex-col animate-[dropdownIn_150ms_ease-out_forwards]"
            style={{
              top: placement.top,
              bottom: placement.bottom,
              left: placement.left,
              width: placement.width,
              maxHeight: placement.maxHeight,
            }}
            role="listbox"
          >
            <div className="px-2 pb-2 border-b border-white/5 shrink-0">
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className={cn(baseInputClass, 'w-full py-1.5 text-sm')}
                aria-label="Søg i listen"
              />
            </div>
            <ul
              className="overflow-auto py-1"
              style={{ maxHeight: listMaxHeight }}
            >
              <li
                role="option"
                aria-selected={value.length === 0}
                onClick={handleClear}
                className="px-3 py-2 text-sm text-app-muted cursor-pointer hover:bg-white/5 transition-colors"
              >
                {placeholder}
              </li>
              {filtered.map((opt) => (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={selectedSet.has(opt.value)}
                  onClick={() => toggle(opt)}
                  className={cn(
                    'px-3 py-2 text-sm cursor-pointer hover:bg-white/5 transition-colors flex items-center gap-2',
                    selectedSet.has(opt.value) &&
                      'bg-white/5 text-slate-100'
                  )}
                >
                  <span
                    className={cn(
                      'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                      selectedSet.has(opt.value)
                        ? 'bg-app-accent border-app-accent'
                        : 'border-white/30'
                    )}
                  >
                    {selectedSet.has(opt.value) && (
                      <svg
                        className="w-2.5 h-2.5 text-white"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </span>
                  {opt.label}
                </li>
              ))}
              {filtered.length === 0 && search.trim() && (
                <li className="px-3 py-2 text-sm text-app-muted">
                  Ingen resultater
                </li>
              )}
            </ul>
          </div>,
          document.body
        )}
    </div>
  )
}
