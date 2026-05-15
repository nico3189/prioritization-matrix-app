'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  setHours,
  setMinutes,
  isValid,
} from 'date-fns'
import { da } from 'date-fns/locale'

interface AppDatePickerProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  formatDisplay: (iso: string) => string
  className?: string
  id?: string
}

const triggerClass =
  'w-full block text-left bg-transparent border-0 outline-none py-1 min-w-0 text-sm text-slate-200 focus:ring-0 cursor-pointer transition-colors duration-200 ease-out'

const DAYS = ['M', 'T', 'O', 'T', 'F', 'L', 'S']

function toISO(value: string): Date | null {
  if (!value) return null
  try {
    const d = parseISO(value)
    return isValid(d) ? d : null
  } catch {
    return null
  }
}

function toISOString(d: Date): string {
  return format(d, "yyyy-MM-dd'T'HH:mm")
}

export function AppDatePicker({
  value,
  onChange,
  placeholder = 'Vælg dato',
  formatDisplay,
  className = '',
  id,
}: AppDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const ref = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const initial = toISO(value) ?? new Date()
  const [viewDate, setViewDate] = useState(initial)
  const [selectedDay, setSelectedDay] = useState<Date | null>(toISO(value))
  const [hour, setHour] = useState(initial.getHours())
  const [minute, setMinute] = useState(initial.getMinutes())
  const [hourDisplay, setHourDisplay] = useState(
    String(initial.getHours()).padStart(2, '0')
  )
  const [minuteDisplay, setMinuteDisplay] = useState(
    String(initial.getMinutes()).padStart(2, '0')
  )

  useEffect(() => {
    const d = toISO(value)
    if (d) {
      setViewDate(d)
      setSelectedDay(d)
      const h = d.getHours()
      const m = d.getMinutes()
      setHour(h)
      setMinute(m)
      setHourDisplay(String(h).padStart(2, '0'))
      setMinuteDisplay(String(m).padStart(2, '0'))
    } else {
      const now = new Date()
      setSelectedDay(null)
      const h = now.getHours()
      const m = now.getMinutes()
      setHour(h)
      setMinute(m)
      setHourDisplay(String(h).padStart(2, '0'))
      setMinuteDisplay(String(m).padStart(2, '0'))
    }
  }, [value, isOpen])

  useEffect(() => {
    if (isOpen && ref.current) {
      const rect = ref.current.getBoundingClientRect()
      setPosition({ top: rect.top - 4, left: rect.left })
    }
  }, [isOpen])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (
        !ref.current?.contains(target) &&
        !dropdownRef.current?.contains(target)
      ) {
        setIsOpen(false)
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('click', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('click', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const displayValue = value ? formatDisplay(value) : placeholder

  const monthStart = startOfMonth(viewDate)
  const monthEnd = endOfMonth(monthStart)
  const start = startOfWeek(monthStart, { weekStartsOn: 1 })
  const end = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days: Date[] = []
  let d = start
  while (d <= end) {
    days.push(d)
    d = addDays(d, 1)
  }

  const handleSelect = (d: Date) => {
    setSelectedDay(d)
  }

  const handleConfirm = () => {
    const base = selectedDay ?? (value ? toISO(value) : null)
    if (!base) {
      setIsOpen(false)
      return
    }
    const next = setMinutes(setHours(base, hour), minute)
    onChange(toISOString(next))
    setIsOpen(false)
  }

  const handleRyd = () => {
    onChange('')
    setIsOpen(false)
  }

  const handleIdag = () => {
    const now = new Date()
    onChange(toISOString(now))
    setViewDate(now)
    setHour(now.getHours())
    setMinute(now.getMinutes())
    setIsOpen(false)
  }

  const selected = selectedDay ?? toISO(value)

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        id={id}
        onClick={() => setIsOpen((o) => !o)}
        className={triggerClass}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <span className={!value ? 'text-app-muted' : ''}>{displayValue}</span>
      </button>

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={dropdownRef}
            data-app-select-list
            data-app-date-picker
            className="fixed z-[100] rounded-lg border border-white/10 app-dropdown-gradient shadow-lg p-3 min-w-[18rem] animate-[dropdownIn_150ms_ease-out_forwards]"
            style={{ bottom: `calc(100vh - ${position.top}px)`, left: position.left }}
          >
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => setViewDate(subMonths(viewDate, 1))}
              className="p-1 rounded text-app-muted hover:text-slate-200 hover:bg-white/5 transition-colors duration-200 ease-out"
              aria-label="Forrige måned"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm font-medium text-slate-200 capitalize">
              {format(viewDate, 'MMMM yyyy', { locale: da })}
            </span>
            <button
              type="button"
              onClick={() => setViewDate(addMonths(viewDate, 1))}
              className="p-1 rounded text-app-muted hover:text-slate-200 hover:bg-white/5 transition-colors duration-200 ease-out"
              aria-label="Næste måned"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 mb-3">
            {DAYS.map((day) => (
              <div key={day} className="text-center text-xs text-app-muted py-1">
                {day}
              </div>
            ))}
            {days.map((day) => (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => handleSelect(day)}
                className={`p-1.5 rounded text-sm transition-colors duration-200 ease-out ${
                  !isSameMonth(day, viewDate)
                    ? 'text-app-muted/60 hover:bg-white/5'
                    : selected && isSameDay(day, selected)
                      ? 'bg-app-accent text-white'
                      : isToday(day)
                        ? 'text-app-accent font-medium hover:bg-white/5'
                        : 'text-slate-200 hover:bg-white/5'
                }`}
              >
                {format(day, 'd')}
              </button>
            ))}
          </div>

          <div className="flex gap-2 mb-3">
            <div className="flex-1">
              <label className="block text-xs text-app-muted mb-1">Time</label>
              <div className="flex gap-1">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  value={hourDisplay}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '')
                    setHourDisplay(v)
                    if (v === '') setHour(0)
                    else setHour(Math.min(23, parseInt(v, 10)))
                  }}
                  onBlur={() => {
                    const clamped = Math.min(23, Math.max(0, hour))
                    setHour(clamped)
                    setHourDisplay(String(clamped).padStart(2, '0'))
                  }}
                  className="w-full bg-slate-700/60 border border-white/10 rounded px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-app-accent/40 text-center tabular-nums"
                />
                <span className="flex items-center text-slate-400">:</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  value={minuteDisplay}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '')
                    setMinuteDisplay(v)
                    if (v === '') setMinute(0)
                    else setMinute(Math.min(59, parseInt(v, 10)))
                  }}
                  onBlur={() => {
                    const clamped = Math.min(59, Math.max(0, minute))
                    setMinute(clamped)
                    setMinuteDisplay(String(clamped).padStart(2, '0'))
                  }}
                  className="w-full bg-slate-700/60 border border-white/10 rounded px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-app-accent/40 text-center tabular-nums"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/5">
            <button
              type="button"
              onClick={handleRyd}
              className="text-sm text-app-muted hover:text-slate-200 transition-colors duration-200 ease-out"
            >
              Ryd
            </button>
            <button
              type="button"
              onClick={handleIdag}
              className="text-sm text-app-muted hover:text-slate-200 transition-colors duration-200 ease-out"
            >
              I dag
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="text-sm text-app-accent hover:text-app-accent/80 font-medium transition-colors duration-200 ease-out"
            >
              Vælg
            </button>
          </div>
        </div>,
          document.body
        )}
    </div>
  )
}
