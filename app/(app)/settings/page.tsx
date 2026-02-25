'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { cn } from '@/lib/utils'

function useCustomers() {
  const q = useQuery({ queryKey: ['customers'], queryFn: () => fetch('/api/settings/customers').then((r) => r.json()) })
  return q
}

function useCreateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) =>
      fetch('/api/settings/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }).then((r) => r.json()),
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
    mutationFn: (name: string) =>
      fetch('/api/settings/team-members', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }).then((r) => r.json()),
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

export default function SettingsPage() {
  const [customerName, setCustomerName] = useState('')
  const [teamMemberName, setTeamMemberName] = useState('')
  const { data: customers = [], isLoading: customersLoading } = useCustomers()
  const createCustomer = useCreateCustomer()
  const deleteCustomer = useDeleteCustomer()
  const { data: teamMembers = [], isLoading: teamMembersLoading } = useTeamMembers()
  const createTeamMember = useCreateTeamMember()
  const deleteTeamMember = useDeleteTeamMember()

  return (
    <div>
      <h1 className="text-3xl font-semibold text-slate-100 mb-2">Settings</h1>
      <p className="text-xs text-app-muted mb-6">Customers og Team Members</p>

      <section className="mb-8">
        <h2 className="text-lg font-medium text-slate-200 mb-4">Customers</h2>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (createCustomer.mutate(customerName), setCustomerName(''))}
            placeholder="Navn"
            className="w-full max-w-xs bg-slate-900/60 border border-white/5 rounded-lg px-4 py-2 text-sm text-slate-200 placeholder:text-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent/40"
          />
          <button
            type="button"
            onClick={() => { if (customerName.trim()) { createCustomer.mutate(customerName.trim()); setCustomerName('') } }}
            className="bg-app-accent text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md hover:opacity-90 active:scale-95 transition"
          >
            Tilføj
          </button>
        </div>
        {customersLoading ? (
          <p className="text-sm text-app-muted">Henter...</p>
        ) : (
          <ul className="space-y-2">
            {customers.map((c: { id: string; name: string }) => (
              <li key={c.id} className="flex items-center justify-between bg-app-card rounded-xl2 p-4 shadow-card border border-white/5">
                <span className="text-base font-medium text-slate-100">{c.name}</span>
                <button
                  type="button"
                  onClick={() => deleteCustomer.mutate(c.id)}
                  className="text-slate-300 hover:text-app-danger transition text-sm"
                >
                  Slet
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-medium text-slate-200 mb-4">Team Members</h2>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={teamMemberName}
            onChange={(e) => setTeamMemberName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (createTeamMember.mutate(teamMemberName), setTeamMemberName(''))}
            placeholder="Navn"
            className="w-full max-w-xs bg-slate-900/60 border border-white/5 rounded-lg px-4 py-2 text-sm text-slate-200 placeholder:text-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent/40"
          />
          <button
            type="button"
            onClick={() => { if (teamMemberName.trim()) { createTeamMember.mutate(teamMemberName.trim()); setTeamMemberName('') } }}
            className="bg-app-accent text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md hover:opacity-90 active:scale-95 transition"
          >
            Tilføj
          </button>
        </div>
        {teamMembersLoading ? (
          <p className="text-sm text-app-muted">Henter...</p>
        ) : (
          <ul className="space-y-2">
            {teamMembers.map((t: { id: string; name: string }) => (
              <li key={t.id} className="flex items-center justify-between bg-app-card rounded-xl2 p-4 shadow-card border border-white/5">
                <span className="text-base font-medium text-slate-100">{t.name}</span>
                <button
                  type="button"
                  onClick={() => deleteTeamMember.mutate(t.id)}
                  className="text-slate-300 hover:text-app-danger transition text-sm"
                >
                  Slet
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
