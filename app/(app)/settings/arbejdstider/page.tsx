'use client'

import { useState } from 'react'
import {
  DAY_LABELS,
  useWorkHours,
  useUpdateWorkHours,
} from '../_lib/settings-hooks'

export default function ArbejdstiderPage() {
  const { data: workHours = {}, isLoading: workHoursLoading } = useWorkHours()
  const updateWorkHours = useUpdateWorkHours()
  const [workHoursEdit, setWorkHoursEdit] = useState<
    Record<string, { start: string; end: string } | null>
  >({})

  const effectiveWorkHours = Object.keys(DAY_LABELS).reduce(
    (acc, d) => {
      acc[d] =
        workHoursEdit[d] !== undefined
          ? workHoursEdit[d]
          : workHours[d] !== undefined
            ? workHours[d]
            : { start: '08:00', end: '16:00' }
      return acc
    },
    {} as Record<string, { start: string; end: string } | null>
  )

  const handleWorkHoursChange = (
    day: string,
    field: 'start' | 'end',
    value: string
  ) => {
    setWorkHoursEdit((prev) => ({
      ...prev,
      [day]: {
        ...(prev[day] ?? workHours[day] ?? { start: '08:00', end: '16:00' }),
        [field]: value,
      },
    }))
  }

  const handleWorkHoursWorkingChange = (day: string, working: boolean) => {
    setWorkHoursEdit((prev) => ({
      ...prev,
      [day]: working
        ? prev[day] ?? workHours[day] ?? { start: '08:00', end: '16:00' }
        : null,
    }))
  }

  const handleSaveWorkHours = () => {
    const toSave = Object.keys(DAY_LABELS).reduce(
      (acc, d) => ({
        ...acc,
        [d]: effectiveWorkHours[d],
      }),
      {} as Record<string, { start: string; end: string } | null>
    )
    updateWorkHours.mutate(toSave, { onSuccess: () => setWorkHoursEdit({}) })
  }

  return (
    <div className="min-w-0 max-w-full">
      <h1 className="text-3xl font-semibold text-slate-100 mb-2">
        Arbejdstider
      </h1>
      <p className="text-xs text-app-muted mb-6">
        Bruges af AI til at sætte deadline ved fx &quot;gøres i dag&quot;,
        &quot;inden jeg går hjem&quot;, &quot;inden i morgen&quot; – uden
        eksplicit klokkeslæt sættes deadline til slut af arbejdsdagen.
      </p>
      {workHoursLoading ? (
        <p className="text-sm text-app-muted">Henter...</p>
      ) : (
        <div className="overflow-x-auto rounded-xl2 border border-white/5 app-card-gradient max-w-2xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-app-muted uppercase tracking-wider">
                  Dag
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-app-muted uppercase tracking-wider w-32">
                  Arbejder
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-app-muted uppercase tracking-wider">
                  Start
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-app-muted uppercase tracking-wider">
                  Slut
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(DAY_LABELS).map(([key, label]) => {
                const isWorking = effectiveWorkHours[key] != null
                return (
                  <tr
                    key={key}
                    className={`border-b border-white/5 last:border-0 hover:bg-white/[0.02] ${!isWorking ? 'opacity-60' : ''}`}
                  >
                    <td className="px-4 py-2.5 text-slate-200">{label}</td>
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={isWorking}
                        onChange={(e) =>
                          handleWorkHoursWorkingChange(key, e.target.checked)
                        }
                        className="rounded border-white/20 bg-slate-900/60 text-app-accent focus:ring-app-accent/40"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="time"
                        value={effectiveWorkHours[key]?.start ?? '08:00'}
                        onChange={(e) =>
                          handleWorkHoursChange(key, 'start', e.target.value)
                        }
                        disabled={!isWorking}
                        className="bg-slate-900/60 border border-white/5 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-app-accent/40 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="time"
                        value={effectiveWorkHours[key]?.end ?? '16:00'}
                        onChange={(e) =>
                          handleWorkHoursChange(key, 'end', e.target.value)
                        }
                        disabled={!isWorking}
                        className="bg-slate-900/60 border border-white/5 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-app-accent/40 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="p-4 border-t border-white/5">
            <button
              type="button"
              onClick={handleSaveWorkHours}
              disabled={updateWorkHours.isPending}
              className="bg-app-accent text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md hover:opacity-90 active:scale-95 transition-colors duration-200 ease-out disabled:opacity-50"
            >
              {updateWorkHours.isPending ? 'Gemmer...' : 'Gem arbejdstider'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
