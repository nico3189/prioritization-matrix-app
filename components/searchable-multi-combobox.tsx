'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface SearchableMultiComboboxProps {
  value: string[]
  onChange: (value: string[]) => void
  options: string[]
  placeholder?: string
  className?: string
  id?: string
}

const baseInputClass =
  'bg-slate-900/60 border border-white/5 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent/40'

export function SearchableMultiCombobox({
  value,
  onChange,
  options,
  placeholder = 'Tilføj...',
  className = '',
  id,
}: SearchableMultiComboboxProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const uniqueOptions = Array.from(new Set(options)).filter(Boolean).slice(0, 50)
  const filtered = uniqueOptions.filter(
    (o) =>
      !value.includes(o) &&
      o.toLowerCase().includes(inputValue.trim().toLowerCase())
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

  function addItem(item: string) {
    const trimmed = item.trim()
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed])
    }
    setInputValue('')
  }

  function removeItem(item: string) {
    onChange(value.filter((v) => v !== item))
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered.length === 1) {
        addItem(filtered[0])
      } else if (inputValue.trim()) {
        addItem(inputValue.trim())
      }
    }
    if (e.key === 'Escape') setIsOpen(false)
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="flex flex-wrap gap-1.5 p-2 min-h-[38px] rounded-lg border border-white/5 bg-slate-900/60 focus-within:ring-2 focus-within:ring-app-accent/40">
        {value.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-app-accent/20 text-slate-200 text-xs truncate max-w-[10rem]"
          >
            {item}
            <button
              type="button"
              onClick={() => removeItem(item)}
              className="hover:text-white transition-colors"
              aria-label={`Fjern ${item}`}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
        <input
          id={id}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : 'Tilføj mere...'}
          className="flex-1 min-w-[6rem] bg-transparent border-0 outline-none text-sm text-slate-200 placeholder:text-app-muted py-0.5"
          aria-label={placeholder}
        />
      </div>
      {isOpen && (filtered.length > 0 || inputValue.trim()) && (
        <ul
          role="listbox"
          className="absolute z-[60] mt-1 w-full rounded-lg border border-white/10 bg-slate-900 shadow-card py-1 max-h-48 overflow-auto"
        >
          {filtered.map((opt) => (
            <li
              key={opt}
              role="option"
              aria-selected={false}
              onClick={() => addItem(opt)}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-white/5 transition-colors truncate"
            >
              {opt}
            </li>
          ))}
          {inputValue.trim() && !filtered.includes(inputValue.trim()) && !value.includes(inputValue.trim()) && (
            <li
              role="option"
              aria-selected={false}
              onClick={() => addItem(inputValue.trim())}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-white/5 transition-colors text-app-muted"
            >
              Tilføj &quot;{inputValue.trim()}&quot;
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
