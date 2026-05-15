'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

export interface SearchableSelectOption {
  value: string
  label: string
}

interface SearchableSelectProps {
  value: string
  onChange: (value: string) => void
  options: SearchableSelectOption[]
  placeholder?: string
  searchPlaceholder?: string
  className?: string
  id?: string
  allowCustomValue?: boolean
}

const baseInputClass =
  'bg-slate-900/60 border border-white/5 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent/40'

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Vælg...',
  searchPlaceholder = 'Søg...',
  className = '',
  id,
  allowCustomValue = false,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value)
  const displayValue = selected?.label ?? (allowCustomValue && value ? value : '')

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.trim().toLowerCase())
  )

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
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

  function handleSelect(opt: SearchableSelectOption) {
    onChange(opt.value)
    setIsOpen(false)
  }

  function handleClear() {
    onChange('')
    setIsOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') setIsOpen(false)
    if (e.key === 'Enter' && filtered.length === 1) {
      handleSelect(filtered[0])
    }
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        id={id}
        onClick={() => setIsOpen((o) => !o)}
        className={cn(
          'w-full flex items-center justify-between gap-2',
          baseInputClass,
          'text-left cursor-pointer min-h-[38px]'
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={cn(!selected && !(allowCustomValue && value) && 'text-app-muted truncate')}>
          {displayValue || placeholder}
        </span>
        <svg
          className={cn('w-4 h-4 text-app-muted shrink-0 transition-transform', isOpen && 'rotate-180')}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="absolute z-[60] mt-1 w-full min-w-[12rem] rounded-lg border border-white/10 bg-slate-900 shadow-card py-1 max-h-56 overflow-hidden flex flex-col animate-[dropdownIn_150ms_ease-out_forwards]"
          role="listbox"
        >
          <div className="px-2 pb-2 border-b border-white/5 shrink-0">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={searchPlaceholder}
              className={cn(baseInputClass, 'w-full py-1.5 text-sm')}
              aria-label="Søg i listen"
            />
          </div>
          <ul className="overflow-auto py-1 max-h-40">
            <li
              role="option"
              aria-selected={value === ''}
              onClick={handleClear}
              className="px-3 py-2 text-sm text-app-muted cursor-pointer hover:bg-white/5 transition-colors"
            >
              {placeholder}
            </li>
            {filtered.map((opt) => (
              <li
                key={opt.value}
                role="option"
                aria-selected={value === opt.value}
                onClick={() => handleSelect(opt)}
                className={cn(
                  'px-3 py-2 text-sm cursor-pointer hover:bg-white/5 transition-colors',
                  value === opt.value && 'bg-white/5 text-slate-100'
                )}
              >
                {opt.label}
              </li>
            ))}
            {filtered.length === 0 && search.trim() && (
              <li className="px-3 py-2 text-sm text-app-muted">
                Ingen resultater
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
