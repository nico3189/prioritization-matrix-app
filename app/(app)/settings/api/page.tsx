'use client'

import { useState, useEffect } from 'react'
import {
  useApiKeys,
  useCreateApiKey,
  useDeleteApiKey,
} from '../_lib/settings-hooks'

export default function ApiPage() {
  const { data: apiKeys = [], isLoading: apiKeysLoading } = useApiKeys()
  const createApiKey = useCreateApiKey()
  const deleteApiKey = useDeleteApiKey()
  const [apiKeyName, setApiKeyName] = useState('')
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null)
  const [origin, setOrigin] = useState<string>('https://din-app.example.com')
  useEffect(() => {
    setOrigin(
      typeof window !== 'undefined'
        ? window.location.origin
        : 'https://din-app.example.com'
    )
  }, [])

  return (
    <div className="min-w-0 max-w-full">
      <h1 className="text-3xl font-semibold text-slate-100 mb-2">
        API-nøgle
      </h1>
      <p className="text-xs text-app-muted mb-6">
        Opret en API-nøgle for at indsende opgaver eksternt (fx iOS Shortcuts,
        Zapier, scripts). Brug{' '}
        <code className="text-slate-400">Authorization: Bearer pm_xxx</code> i
        HTTP-headeren.
      </p>
      <div className="flex flex-col sm:flex-row flex-wrap gap-2 mb-4 items-stretch sm:items-center">
        <input
          type="text"
          value={apiKeyName}
          onChange={(e) => setApiKeyName(e.target.value)}
          placeholder='Navn (fx "iOS Shortcuts")'
          className="w-full min-w-0 sm:max-w-[16rem] bg-slate-900/60 border border-white/5 rounded-lg px-4 py-2 text-sm text-slate-200 placeholder:text-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent/40"
        />
        <button
          type="button"
          onClick={() => {
            if (apiKeyName.trim()) {
              createApiKey.mutate(apiKeyName.trim(), {
                onSuccess: (data) => {
                  setNewlyCreatedKey(data.key)
                  setApiKeyName('')
                },
              })
            }
          }}
          disabled={createApiKey.isPending || !apiKeyName.trim()}
          className="bg-app-accent text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md hover:opacity-90 active:scale-95 transition-colors duration-200 ease-out disabled:opacity-50"
        >
          {createApiKey.isPending ? 'Opretter...' : 'Opret API-nøgle'}
        </button>
      </div>
      {newlyCreatedKey && (
        <div className="mb-4 p-4 rounded-xl2 border border-emerald-500/30 bg-emerald-500/10">
          <p className="text-xs font-medium text-emerald-400 mb-2">
            Kopier nøglen nu – den vises kun én gang:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 rounded-lg bg-slate-900/80 text-slate-200 text-sm font-mono break-all">
              {newlyCreatedKey}
            </code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(newlyCreatedKey)
              }}
              className="shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              Kopier
            </button>
            <button
              type="button"
              onClick={() => setNewlyCreatedKey(null)}
              className="shrink-0 text-app-muted hover:text-slate-200"
              aria-label="Luk"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}
      <p className="text-xs text-app-muted mb-3">
        Eksempel (iOS Shortcuts, curl):
      </p>
      <pre className="mb-4 p-4 rounded-xl2 bg-slate-900/60 border border-white/5 text-xs text-slate-300 overflow-x-auto">
        {`curl -X POST ${origin}/api/tasks \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer pm_DIN_NØGLE" \\
  -d '{"rawText": "Køb mælk"}'`}
      </pre>
      {apiKeysLoading ? (
        <p className="text-sm text-app-muted">Henter...</p>
      ) : apiKeys.length > 0 ? (
        <div className="overflow-x-auto rounded-xl2 border border-white/5 app-card-gradient max-w-2xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-app-muted uppercase tracking-wider">
                  Navn
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-app-muted uppercase tracking-wider">
                  Oprettet
                </th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {(
                apiKeys as { id: string; name: string; createdAt: string }[]
              ).map((k) => (
                <tr
                  key={k.id}
                  className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-2.5 text-slate-200">{k.name}</td>
                  <td
                    className="px-4 py-2.5 text-app-muted text-xs"
                    suppressHydrationWarning
                  >
                    {new Date(k.createdAt).toLocaleDateString('da-DK')}
                  </td>
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          confirm(
                            'Slet denne API-nøgle? Den kan ikke gendannes.'
                          )
                        ) {
                          deleteApiKey.mutate(k.id)
                        }
                      }}
                      className="text-app-danger hover:text-red-400 text-sm"
                    >
                      Slet
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-app-muted">Ingen API-nøgler endnu.</p>
      )}
    </div>
  )
}
