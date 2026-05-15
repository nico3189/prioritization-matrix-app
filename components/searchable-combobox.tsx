'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface SearchableComboboxProps {
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
  className?: string
  id?: string
}

const baseInputClass =
  'w-full bg-slate-900/60 border border-white/5 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent/40'

export function SearchableCombobox({
  value,
  onChange,
  options,
  placeholder = 'Søg...',
  className = '',
  id,
}: SearchableComboboxProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [localValue, setLocalValue] = useState(value)
  const containerRef = useRef<HTMLDivElement>(null)

  const uniqueOptions = Array.from(new Set(options)).filter(Boolean).slice(0, 50)
  const filtered = uniqueOptions.filter((o) =>
    o.toLowerCase().includes(localValue.trim().toLowerCase())
  )

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        if (localValue !== value) onChange(localValue)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [localValue, value, onChange])

  function handleSelect(opt: string) {
    onChange(opt)
    setLocalValue(opt)
    setIsOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setIsOpen(false)
      setLocalValue(value)
    }
    if (e.key === 'Enter' && filtered.length === 1) {
      handleSelect(filtered[0])
    }
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <input
        id={id}
        type="text"
        value={localValue}
        onChange={(e) => {
          setLocalValue(e.target.value)
          onChange(e.target.value)
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={baseInputClass}
        aria-label={placeholder}
      />
      {isOpen && uniqueOptions.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-[60] mt-1 w-full rounded-lg border border-white/10 bg-slate-900 shadow-card py-1 max-h-48 overflow-auto"
        >
          {filtered.map((opt) => (
            <li
              key={opt}
              role="option"
              aria-selected={value === opt}
              onClick={() => handleSelect(opt)}
              className={cn(
                'px-3 py-2 text-sm cursor-pointer hover:bg-white/5 transition-colors truncate',
                value === opt && 'bg-white/5 text-slate-100'
              )}
            >
              {opt}
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-app-muted">Ingen resultater</li>
          )}
        </ul>
      )}
    </div>
  )
}
