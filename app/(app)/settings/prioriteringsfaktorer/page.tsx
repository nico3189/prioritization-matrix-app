'use client'

import { useState } from 'react'
import {
  TYPE_LABELS,
  usePriorityFactors,
  useUpdatePriorityFactors,
  useSyncUrgency,
  type KeywordWeight,
} from '../_lib/settings-hooks'

export default function PrioriteringsfaktorerPage() {
  const { data: priorityFactors, isLoading: priorityFactorsLoading } =
    usePriorityFactors()
  const updatePriorityFactors = useUpdatePriorityFactors()
  const syncUrgency = useSyncUrgency()
  const [priorityFactorsEdit, setPriorityFactorsEdit] = useState<{
    typeImportance?: Record<string, number>
    typeUrgency?: Record<string, number>
    customerMultiplier?: number
    keywordWeights?: KeywordWeight[]
  } | null>(null)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  return (
    <div className="min-w-0 max-w-full">
      <h1 className="text-3xl font-semibold text-slate-100 mb-2">
        Prioriteringsfaktorer
      </h1>
      <p className="text-xs text-app-muted mb-6">
        Type og kunde påvirker importance og urgency ved AI-parsing. Værdier
        lægges til AI&apos;s vurdering. Kunde-multiplikator bruges i (priority
        − 5) × multiplikator – priority 0–10, 5 er neutral. Nøgleord-vægtning:
        ord eller synonymer (komma/semikolon-adskilt) øger importance/urgency
        når de findes i opgavetekst.
      </p>
      {priorityFactorsLoading ? (
        <p className="text-sm text-app-muted">Henter...</p>
      ) : (
        <div className="overflow-x-auto rounded-xl2 border border-white/5 app-card-gradient max-w-2xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-app-muted uppercase tracking-wider">
                  Type
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-app-muted uppercase tracking-wider w-28">
                  Importance (+)
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-app-muted uppercase tracking-wider w-28">
                  Urgency (+)
                </th>
              </tr>
            </thead>
            <tbody>
              {(['kunde', 'salg', 'ledelse', 'internt'] as const).map((key) => {
                const imp =
                  priorityFactorsEdit?.typeImportance?.[key] ??
                  (priorityFactors as { typeImportance?: Record<string, number> })
                    ?.typeImportance?.[key] ??
                  0
                const urg =
                  priorityFactorsEdit?.typeUrgency?.[key] ??
                  (priorityFactors as { typeUrgency?: Record<string, number> })
                    ?.typeUrgency?.[key] ??
                  0
                return (
                  <tr
                    key={key}
                    className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-2.5 text-slate-200">
                      {TYPE_LABELS[key]}
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min={-50}
                        max={50}
                        value={imp}
                        onChange={(e) => {
                          const v = Number(e.target.value)
                          setPriorityFactorsEdit((prev) => ({
                            ...prev,
                            typeImportance: {
                              ...(priorityFactors as {
                                typeImportance?: Record<string, number>
                              })?.typeImportance,
                              ...prev?.typeImportance,
                              [key]: Number.isNaN(v) ? 0 : v,
                            },
                          }))
                        }}
                        className="w-20 bg-slate-900/60 border border-white/5 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-app-accent/40"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min={-50}
                        max={50}
                        value={urg}
                        onChange={(e) => {
                          const v = Number(e.target.value)
                          setPriorityFactorsEdit((prev) => ({
                            ...prev,
                            typeUrgency: {
                              ...(priorityFactors as {
                                typeUrgency?: Record<string, number>
                              })?.typeUrgency,
                              ...prev?.typeUrgency,
                              [key]: Number.isNaN(v) ? 0 : v,
                            },
                          }))
                        }}
                        className="w-20 bg-slate-900/60 border border-white/5 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-app-accent/40"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="p-4 border-t border-white/5">
            <h3 className="text-sm font-medium text-slate-200 mb-3">
              Nøgleord-vægtning
            </h3>
            <p className="text-xs text-app-muted mb-3">
              Ord eller synonymer (komma/semikolon-adskilt) – når de findes i
              opgavetekst, lægges importance/urgency-værdier til.
            </p>
            <div className="space-y-2 mb-4">
              {(
                priorityFactorsEdit?.keywordWeights ??
                (priorityFactors as { keywordWeights?: KeywordWeight[] })
                  ?.keywordWeights ??
                []
              ).map((kw, idx) => (
                <div key={idx} className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    placeholder="ord, synonymer (komma/semikolon)"
                    value={Array.isArray(kw.terms) ? kw.terms.join(', ') : ''}
                    onChange={(e) => {
                      const raw = e.target.value
                      const terms = raw
                        .split(/[,;]/)
                        .map((t) => t.trim())
                        .filter(Boolean)
                      setPriorityFactorsEdit((prev) => {
                        const list =
                          prev?.keywordWeights ??
                          (priorityFactors as {
                            keywordWeights?: KeywordWeight[]
                          })?.keywordWeights ??
                          []
                        const next = [...list]
                        next[idx] = { ...list[idx], terms }
                        return { ...prev, keywordWeights: next }
                      })
                    }}
                    className="flex-1 min-w-[12rem] bg-slate-900/60 border border-white/5 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder:text-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent/40"
                  />
                  <input
                    type="number"
                    min={-50}
                    max={50}
                    placeholder="Imp"
                    value={kw.importance}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      setPriorityFactorsEdit((prev) => {
                        const list =
                          prev?.keywordWeights ??
                          (priorityFactors as {
                            keywordWeights?: KeywordWeight[]
                          })?.keywordWeights ??
                          []
                        const next = [...list]
                        next[idx] = { ...list[idx], importance: Number.isNaN(v) ? 0 : v }
                        return { ...prev, keywordWeights: next }
                      })
                    }}
                    className="w-16 bg-slate-900/60 border border-white/5 rounded-lg px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-app-accent/40"
                    title="Importance (+)"
                  />
                  <input
                    type="number"
                    min={-50}
                    max={50}
                    placeholder="Urg"
                    value={kw.urgency}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      setPriorityFactorsEdit((prev) => {
                        const list =
                          prev?.keywordWeights ??
                          (priorityFactors as {
                            keywordWeights?: KeywordWeight[]
                          })?.keywordWeights ??
                          []
                        const next = [...list]
                        next[idx] = { ...list[idx], urgency: Number.isNaN(v) ? 0 : v }
                        return { ...prev, keywordWeights: next }
                      })
                    }}
                    className="w-16 bg-slate-900/60 border border-white/5 rounded-lg px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-app-accent/40"
                    title="Urgency (+)"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setPriorityFactorsEdit((prev) => {
                        const list =
                          prev?.keywordWeights ??
                          (priorityFactors as {
                            keywordWeights?: KeywordWeight[]
                          })?.keywordWeights ??
                          []
                        const next = list.filter((_, i) => i !== idx)
                        return { ...prev, keywordWeights: next }
                      })
                    }}
                    className="shrink-0 p-2 rounded-lg border border-white/10 bg-white/5 text-app-danger hover:bg-red-500/10 hover:border-red-500/20 transition-colors duration-200"
                    aria-label="Fjern"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V7a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setPriorityFactorsEdit((prev) => {
                  const list =
                    prev?.keywordWeights ??
                    (priorityFactors as { keywordWeights?: KeywordWeight[] })
                      ?.keywordWeights ??
                    []
                  return {
                    ...prev,
                    keywordWeights: [
                      ...list,
                      { terms: [], importance: 0, urgency: 0 },
                    ],
                  }
                })
              }}
              className="text-sm text-app-accent hover:text-blue-400 transition-colors mb-4"
            >
              + Tilføj nøgleord-gruppe
            </button>
          </div>
          <div className="p-4 border-t border-white/5 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2">
              <span className="text-sm text-slate-300">
                Kunde-multiplikator:
              </span>
              <input
                type="number"
                min={0}
                max={10}
                step={0.5}
                value={
                  priorityFactorsEdit?.customerMultiplier ??
                  (priorityFactors as { customerMultiplier?: number })
                    ?.customerMultiplier ??
                  2
                }
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setPriorityFactorsEdit((prev) => ({
                    ...prev,
                    customerMultiplier: Number.isNaN(v) ? 2 : v,
                  }))
                }}
                className="w-16 bg-slate-900/60 border border-white/5 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-app-accent/40"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                const base = priorityFactors as {
                  typeImportance?: Record<string, number>
                  typeUrgency?: Record<string, number>
                  customerMultiplier?: number
                  keywordWeights?: KeywordWeight[]
                }
                const merged = {
                  typeImportance: {
                    ...base?.typeImportance,
                    ...priorityFactorsEdit?.typeImportance,
                  },
                  typeUrgency: {
                    ...base?.typeUrgency,
                    ...priorityFactorsEdit?.typeUrgency,
                  },
                  customerMultiplier:
                    priorityFactorsEdit?.customerMultiplier ??
                    base?.customerMultiplier,
                  keywordWeights:
                    priorityFactorsEdit?.keywordWeights !== undefined
                      ? priorityFactorsEdit.keywordWeights.filter(
                          (kw) => Array.isArray(kw.terms) && kw.terms.length > 0
                        )
                      : base?.keywordWeights,
                }
                updatePriorityFactors.mutate(merged, {
                  onSuccess: () => setPriorityFactorsEdit(null),
                })
              }}
              disabled={
                updatePriorityFactors.isPending || priorityFactorsEdit == null
              }
              className="bg-app-accent text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md hover:opacity-90 active:scale-95 transition-colors duration-200 ease-out disabled:opacity-50"
            >
              {updatePriorityFactors.isPending
                ? 'Gemmer...'
                : 'Gem prioriteringsfaktorer'}
            </button>
          </div>
        </div>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-medium text-slate-200 mb-4">Prioritering</h2>
        <p className="text-sm text-slate-300 mb-4">
          Genberegn hastegrad og vigtighed for alle opgaver (fx efter ændringer i
          deadliner).
        </p>
        <button
          type="button"
          onClick={() => {
            setSyncMessage(null)
            syncUrgency.mutate(undefined, {
              onSuccess: (data) => {
                if (data.updated > 0) {
                  setSyncMessage(
                    `Hastegrad opdateret for ${data.updated} opgave${data.updated !== 1 ? 'r' : ''}.`
                  )
                } else {
                  setSyncMessage('Prioritering er ajour.')
                }
              },
            })
          }}
          disabled={syncUrgency.isPending}
          className="bg-app-accent text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md hover:opacity-90 active:scale-95 transition-colors duration-200 ease-out disabled:opacity-50"
        >
          {syncUrgency.isPending
            ? 'Genberegner...'
            : 'Genberegn hastegrad og vigtighed'}
        </button>
        {syncMessage && (
          <p className="text-sm text-amber-400 mt-2">{syncMessage}</p>
        )}
      </section>
    </div>
  )
}
