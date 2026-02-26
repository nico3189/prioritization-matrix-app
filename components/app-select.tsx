'use client'

import { useState, useRef, useEffect } from 'react'

export interface AppSelectOption {
  value: string
  label: string
}

interface AppSelectProps {
  value: string
  onChange: (value: string) => void
  options: AppSelectOption[]
  placeholder?: string
  className?: string
  id?: string
}

const triggerClass =
  'w-full flex items-center justify-between gap-2 bg-transparent border-0 outline-none py-1 min-w-0 text-sm text-slate-200 focus:ring-0 cursor-pointer transition-colors duration-200 ease-out text-left'

export function AppSelect({
  value,
  onChange,
  options,
  placeholder = 'Vælg...',
  className = '',
  id,
}: AppSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selected = options.find((o) => o.value === value)
  const displayValue = selected?.label ?? placeholder

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        id={id}
        onClick={() => setIsOpen((o) => !o)}
        className={triggerClass}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby={id ? `${id}-label` : undefined}
      >
        <span className={!selected ? 'text-app-muted' : ''}>{displayValue}</span>
        <svg
          className={`w-4 h-4 text-app-muted shrink-0 transition-transform duration-200 ease-out ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <ul
          role="listbox"
          data-app-select-list
          className="absolute z-[60] mt-1 w-full min-w-[8rem] rounded-lg border border-white/10 app-dropdown-gradient shadow-lg py-1 max-h-48 overflow-auto animate-[dropdownIn_150ms_ease-out_forwards]"
        >
          <li
            role="option"
            aria-selected={value === ''}
            onClick={() => {
              onChange('')
              setIsOpen(false)
            }}
            className="px-3 py-2 text-sm text-slate-200 cursor-pointer hover:bg-white/5 transition-colors duration-200 ease-out"
          >
            {placeholder}
          </li>
          {options.map((opt) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={value === opt.value}
              onClick={() => {
                onChange(opt.value)
                setIsOpen(false)
              }}
              className={`px-3 py-2 text-sm cursor-pointer hover:bg-white/5 transition-colors duration-200 ease-out ${
                value === opt.value ? 'text-slate-100 bg-white/5' : 'text-slate-200'
              }`}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
