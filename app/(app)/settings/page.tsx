'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

function useCustomers() {
  const q = useQuery({ queryKey: ['customers'], queryFn: () => fetch('/api/settings/customers').then((r) => r.json()) })
  return q
}

function useCreateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, code, priority }: { name: string; code?: string; priority?: number }) => {
      const r = await fetch('/api/settings/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, code: code?.trim() || undefined, priority }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error((data as { error?: string })?.error ?? `Fejl ${r.status}`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  })
}

function useUpdateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name, code, priority }: { id: string; name: string; code?: string; priority?: number }) =>
      fetch(`/api/settings/customers?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, code: code?.trim() || undefined, priority }),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  })
}

function useDeleteCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => fetch(`/api/settings/customers?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  })
}

function useTeamMembers() {
  return useQuery({ queryKey: ['teamMembers'], queryFn: () => fetch('/api/settings/team-members').then((r) => r.json()) })
}

function useCreateTeamMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, code }: { name: string; code?: string }) =>
      fetch('/api/settings/team-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, code: code?.trim() || undefined }),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teamMembers'] }),
  })
}

function useUpdateTeamMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name, code }: { id: string; name: string; code?: string }) =>
      fetch(`/api/settings/team-members?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, code: code?.trim() || undefined }),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teamMembers'] }),
  })
}

function useDeleteTeamMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => fetch(`/api/settings/team-members?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teamMembers'] }),
  })
}

function useSyncUrgency() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      fetch('/api/tasks/sync-urgency', { method: 'POST' }).then((r) => r.json()) as Promise<{ ok: boolean; updated: number; total: number }>,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

export default function SettingsPage() {
  const [customerName, setCustomerName] = useState('')
  const [customerCode, setCustomerCode] = useState('')
  const [customerPriority, setCustomerPriority] = useState<number>(5)
  const [teamMemberName, setTeamMemberName] = useState('')
  const [teamMemberCode, setTeamMemberCode] = useState('')
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [editingCustomer, setEditingCustomer] = useState<{
    id: string
    name: string
    code?: string | null
    priority?: number | null
  } | null>(null)
  const [editingTeamMember, setEditingTeamMember] = useState<{ id: string; name: string; code?: string | null } | null>(null)
  const { data: customers = [], isLoading: customersLoading } = useCustomers()
  const createCustomer = useCreateCustomer()
  const updateCustomer = useUpdateCustomer()
  const deleteCustomer = useDeleteCustomer()
  const { data: teamMembers = [], isLoading: teamMembersLoading } = useTeamMembers()
  const createTeamMember = useCreateTeamMember()
  const updateTeamMember = useUpdateTeamMember()
  const deleteTeamMember = useDeleteTeamMember()
  const syncUrgency = useSyncUrgency()

  return (
    <div>
      <h1 className="text-3xl font-semibold text-slate-100 mb-2">Indstillinger</h1>
      <p className="text-xs text-app-muted mb-6">Customers og Team Members</p>

      <section className="mb-8">
        <h2 className="text-lg font-medium text-slate-200 mb-4">Customers</h2>
        <div className="flex flex-wrap gap-2 mb-4 items-center">
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && customerName.trim()) {
                createCustomer.mutate(
                  {
                    name: customerName.trim(),
                    code: customerCode.trim() || undefined,
                    priority: customerPriority,
                  },
                  {
                    onSuccess: () => {
                      setCustomerName('')
                      setCustomerCode('')
                    },
                  }
                )
              }
            }}
            placeholder="Navn"
            className="w-full max-w-[12rem] bg-slate-900/60 border border-white/5 rounded-lg px-4 py-2 text-sm text-slate-200 placeholder:text-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent/40"
          />
          <input
            type="text"
            value={customerCode}
            onChange={(e) => setCustomerCode(e.target.value.toUpperCase().slice(0, 3))}
            placeholder="Kode (3 bogstaver)"
            maxLength={3}
            className="w-24 bg-slate-900/60 border border-white/5 rounded-lg px-4 py-2 text-sm text-slate-200 placeholder:text-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent/40"
          />
          <input
            type="number"
            min={0}
            max={10}
            value={customerPriority}
            onChange={(e) => setCustomerPriority(Math.max(0, Math.min(10, Number(e.target.value) || 0)))}
            placeholder="Prioritet"
            className="w-20 bg-slate-900/60 border border-white/5 rounded-lg px-4 py-2 text-sm text-slate-200 placeholder:text-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent/40"
          />
          <button
            type="button"
            onClick={() => {
              if (customerName.trim()) {
                createCustomer.mutate(
                  {
                    name: customerName.trim(),
                    code: customerCode.trim() || undefined,
                    priority: customerPriority,
                  },
                  {
                    onSuccess: () => {
                      setCustomerName('')
                      setCustomerCode('')
                    },
                  }
                )
              }
            }}
            disabled={createCustomer.isPending}
            className="bg-app-accent text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md hover:opacity-90 active:scale-95 transition-colors duration-200 ease-out disabled:opacity-50"
          >
            {createCustomer.isPending ? 'Tilføjer...' : 'Tilføj'}
          </button>
        </div>
        {createCustomer.isError && (
          <p className="text-sm text-app-danger mb-2">{createCustomer.error?.message}</p>
        )}
        {customersLoading ? (
          <p className="text-sm text-app-muted">Henter...</p>
        ) : (
          <div className="overflow-x-auto rounded-xl2 border border-white/5 app-card-gradient">
            <table className="w-full min-w-[20rem] table-fixed text-sm">
              <colgroup>
                <col style={{ width: '50%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '6rem' }} />
              </colgroup>
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-app-muted uppercase tracking-wider">
                    Navn
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-app-muted uppercase tracking-wider">
                    Kode
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-app-muted uppercase tracking-wider">
                    Prioritet
                  </th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {customers.map((c: { id: string; name: string; code?: string | null; priority?: number | null }) => (
                  <tr key={c.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5 text-slate-200 truncate" title={c.name}>{c.name}</td>
                    <td className="px-4 py-2.5 text-app-muted">{c.code ?? '–'}</td>
                    <td className="px-4 py-2.5 text-slate-200">{c.priority ?? 5}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingCustomer(c)}
                          disabled={updateCustomer.isPending}
                          className="shrink-0 p-2 rounded-lg border border-white/10 bg-white/5 text-app-muted hover:text-slate-200 hover:bg-white/10 transition-colors duration-200 ease-out disabled:opacity-50"
                          aria-label="Rediger"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm('Slet denne kunde?')) deleteCustomer.mutate(c.id)
                          }}
                          disabled={deleteCustomer.isPending}
                          className="shrink-0 p-2 rounded-lg border border-white/10 bg-white/5 text-app-danger hover:bg-red-500/10 hover:border-red-500/20 transition-colors duration-200 ease-out disabled:opacity-50"
                          aria-label="Slet"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V7a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-medium text-slate-200 mb-4">Team Members</h2>
        <div className="flex flex-wrap gap-2 mb-4 items-center">
          <input
            type="text"
            value={teamMemberName}
            onChange={(e) => setTeamMemberName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && teamMemberName.trim()) {
                createTeamMember.mutate({
                  name: teamMemberName.trim(),
                  code: teamMemberCode.trim() || undefined,
                })
                setTeamMemberName('')
                setTeamMemberCode('')
              }
            }}
            placeholder="Navn"
            className="w-full max-w-[12rem] bg-slate-900/60 border border-white/5 rounded-lg px-4 py-2 text-sm text-slate-200 placeholder:text-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent/40"
          />
          <input
            type="text"
            value={teamMemberCode}
            onChange={(e) => setTeamMemberCode(e.target.value.toUpperCase().slice(0, 3))}
            placeholder="Kode (3 bogstaver)"
            maxLength={3}
            className="w-24 bg-slate-900/60 border border-white/5 rounded-lg px-4 py-2 text-sm text-slate-200 placeholder:text-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent/40"
          />
          <button
            type="button"
            onClick={() => {
              if (teamMemberName.trim()) {
                createTeamMember.mutate({
                  name: teamMemberName.trim(),
                  code: teamMemberCode.trim() || undefined,
                })
                setTeamMemberName('')
                setTeamMemberCode('')
              }
            }}
            className="bg-app-accent text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md hover:opacity-90 active:scale-95 transition-colors duration-200 ease-out"
          >
            Tilføj
          </button>
        </div>
        {teamMembersLoading ? (
          <p className="text-sm text-app-muted">Henter...</p>
        ) : (
          <div className="overflow-x-auto rounded-xl2 border border-white/5 app-card-gradient">
            <table className="w-full min-w-[20rem] table-fixed text-sm">
              <colgroup>
                <col style={{ width: '60%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '6rem' }} />
              </colgroup>
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-app-muted uppercase tracking-wider">
                    Navn
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-app-muted uppercase tracking-wider">
                    Kode
                  </th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {teamMembers.map((t: { id: string; name: string; code?: string | null }) => (
                  <tr key={t.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5 text-slate-200 truncate" title={t.name}>{t.name}</td>
                    <td className="px-4 py-2.5 text-app-muted">{t.code ?? '–'}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingTeamMember(t)}
                          disabled={updateTeamMember.isPending}
                          className="shrink-0 p-2 rounded-lg border border-white/10 bg-white/5 text-app-muted hover:text-slate-200 hover:bg-white/10 transition-colors duration-200 ease-out disabled:opacity-50"
                          aria-label="Rediger"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm('Slet dette team-medlem?')) deleteTeamMember.mutate(t.id)
                          }}
                          disabled={deleteTeamMember.isPending}
                          className="shrink-0 p-2 rounded-lg border border-white/10 bg-white/5 text-app-danger hover:bg-red-500/10 hover:border-red-500/20 transition-colors duration-200 ease-out disabled:opacity-50"
                          aria-label="Slet"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V7a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-medium text-slate-200 mb-4">Prioritering</h2>
        <p className="text-sm text-slate-300 mb-4">
          Genberegn hastegrad og vigtighed for alle opgaver (fx efter ændringer i deadliner).
        </p>
        <button
          type="button"
          onClick={() => {
            setSyncMessage(null)
            syncUrgency.mutate(undefined, {
              onSuccess: (data) => {
                if (data.updated > 0) {
                  setSyncMessage(`Hastegrad opdateret for ${data.updated} opgave${data.updated !== 1 ? 'r' : ''}.`)
                } else {
                  setSyncMessage('Prioritering er ajour.')
                }
              },
            })
          }}
          disabled={syncUrgency.isPending}
          className="bg-app-accent text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md hover:opacity-90 active:scale-95 transition-colors duration-200 ease-out disabled:opacity-50"
        >
          {syncUrgency.isPending ? 'Genberegner...' : 'Genberegn hastegrad og vigtighed'}
        </button>
        {syncMessage && (
          <p className="text-sm text-amber-400 mt-2">{syncMessage}</p>
        )}
      </section>

      {/* Edit Customer Modal */}
      {editingCustomer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[modalOverlayIn_200ms_ease-out_forwards]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-customer-title"
          onClick={(e) => e.target === e.currentTarget && setEditingCustomer(null)}
        >
          <div
            className="app-card-gradient rounded-lg shadow-hover border border-white/10 w-full max-w-md p-5 animate-[modalContentIn_250ms_ease-out_forwards]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 id="edit-customer-title" className="text-lg font-semibold text-slate-100">
                Rediger kunde
              </h2>
              <button
                type="button"
                onClick={() => setEditingCustomer(null)}
                className="shrink-0 p-2 rounded-lg border border-white/10 bg-white/5 text-app-muted hover:text-slate-200 hover:bg-white/10 transition-colors duration-200 ease-out"
                aria-label="Luk"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const form = e.currentTarget
                const name = (form.elements.namedItem('edit-customer-name') as HTMLInputElement).value.trim()
                const code = (form.elements.namedItem('edit-customer-code') as HTMLInputElement).value.trim()
                const priority = Number((form.elements.namedItem('edit-customer-priority') as HTMLInputElement).value)
                if (name) {
                  updateCustomer.mutate(
                    {
                      id: editingCustomer.id,
                      name,
                      code: code || undefined,
                      priority: Number.isNaN(priority) ? undefined : Math.max(0, Math.min(10, priority)),
                    },
                    { onSuccess: () => setEditingCustomer(null) }
                  )
                }
              }}
              className="space-y-4"
            >
              <div>
                <label htmlFor="edit-customer-name" className="block text-xs font-medium text-app-muted mb-1">
                  Navn
                </label>
                <input
                  id="edit-customer-name"
                  name="edit-customer-name"
                  type="text"
                  defaultValue={editingCustomer.name}
                  required
                  className="w-full bg-slate-900/60 border border-white/5 rounded-lg px-4 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-app-accent/40"
                />
              </div>
              <div>
                <label htmlFor="edit-customer-code" className="block text-xs font-medium text-app-muted mb-1">
                  Kode (3 bogstaver)
                </label>
                <input
                  id="edit-customer-code"
                  name="edit-customer-code"
                  type="text"
                  defaultValue={editingCustomer.code ?? ''}
                  maxLength={3}
                  onChange={(e) => (e.target.value = e.target.value.toUpperCase().slice(0, 3))}
                  className="w-24 bg-slate-900/60 border border-white/5 rounded-lg px-4 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-app-accent/40"
                />
              </div>
              <div>
                <label htmlFor="edit-customer-priority" className="block text-xs font-medium text-app-muted mb-1">
                  Prioritet (0–10)
                </label>
                <input
                  id="edit-customer-priority"
                  name="edit-customer-priority"
                  type="number"
                  min={0}
                  max={10}
                  defaultValue={editingCustomer.priority ?? 5}
                  className="w-20 bg-slate-900/60 border border-white/5 rounded-lg px-4 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-app-accent/40"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingCustomer(null)}
                  className="shrink-0 p-2 rounded-lg border border-white/10 bg-white/5 text-app-muted hover:text-slate-200 hover:bg-white/10 transition-colors duration-200 ease-out"
                  aria-label="Annuller"
                >
                  Annuller
                </button>
                <button
                  type="submit"
                  disabled={updateCustomer.isPending}
                  className="bg-app-accent text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md hover:opacity-90 active:scale-95 transition-colors duration-200 ease-out disabled:opacity-50"
                >
                  {updateCustomer.isPending ? 'Gemmer...' : 'Gem'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Team Member Modal */}
      {editingTeamMember && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[modalOverlayIn_200ms_ease-out_forwards]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-team-member-title"
          onClick={(e) => e.target === e.currentTarget && setEditingTeamMember(null)}
        >
          <div
            className="app-card-gradient rounded-lg shadow-hover border border-white/10 w-full max-w-md p-5 animate-[modalContentIn_250ms_ease-out_forwards]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 id="edit-team-member-title" className="text-lg font-semibold text-slate-100">
                Rediger team-medlem
              </h2>
              <button
                type="button"
                onClick={() => setEditingTeamMember(null)}
                className="shrink-0 p-2 rounded-lg border border-white/10 bg-white/5 text-app-muted hover:text-slate-200 hover:bg-white/10 transition-colors duration-200 ease-out"
                aria-label="Luk"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const form = e.currentTarget
                const name = (form.elements.namedItem('edit-team-member-name') as HTMLInputElement).value.trim()
                const code = (form.elements.namedItem('edit-team-member-code') as HTMLInputElement).value.trim()
                if (name) {
                  updateTeamMember.mutate(
                    { id: editingTeamMember.id, name, code: code || undefined },
                    { onSuccess: () => setEditingTeamMember(null) }
                  )
                }
              }}
              className="space-y-4"
            >
              <div>
                <label htmlFor="edit-team-member-name" className="block text-xs font-medium text-app-muted mb-1">
                  Navn
                </label>
                <input
                  id="edit-team-member-name"
                  name="edit-team-member-name"
                  type="text"
                  defaultValue={editingTeamMember.name}
                  required
                  className="w-full bg-slate-900/60 border border-white/5 rounded-lg px-4 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-app-accent/40"
                />
              </div>
              <div>
                <label htmlFor="edit-team-member-code" className="block text-xs font-medium text-app-muted mb-1">
                  Kode (3 bogstaver)
                </label>
                <input
                  id="edit-team-member-code"
                  name="edit-team-member-code"
                  type="text"
                  defaultValue={editingTeamMember.code ?? ''}
                  maxLength={3}
                  onChange={(e) => (e.target.value = e.target.value.toUpperCase().slice(0, 3))}
                  className="w-24 bg-slate-900/60 border border-white/5 rounded-lg px-4 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-app-accent/40"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTeamMember(null)}
                  className="shrink-0 p-2 rounded-lg border border-white/10 bg-white/5 text-app-muted hover:text-slate-200 hover:bg-white/10 transition-colors duration-200 ease-out"
                  aria-label="Annuller"
                >
                  Annuller
                </button>
                <button
                  type="submit"
                  disabled={updateTeamMember.isPending}
                  className="bg-app-accent text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md hover:opacity-90 active:scale-95 transition-colors duration-200 ease-out disabled:opacity-50"
                >
                  {updateTeamMember.isPending ? 'Gemmer...' : 'Gem'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
