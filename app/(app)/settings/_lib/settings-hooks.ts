'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export function useCustomers() {
  const q = useQuery({
    queryKey: ['customers'],
    queryFn: () => fetch('/api/settings/customers').then((r) => r.json()),
  })
  return q
}

export function useCreateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      name,
      code,
      priority,
    }: {
      name: string
      code?: string
      priority?: number
    }) => {
      const r = await fetch('/api/settings/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          code: code?.trim() || undefined,
          priority,
        }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok)
        throw new Error((data as { error?: string })?.error ?? `Fejl ${r.status}`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  })
}

export function useUpdateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      name,
      code,
      priority,
    }: {
      id: string
      name: string
      code?: string
      priority?: number
    }) =>
      fetch(`/api/settings/customers?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          code: code?.trim() || undefined,
          priority,
        }),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  })
}

export function useDeleteCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/settings/customers?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  })
}

export function useTeamMembers() {
  return useQuery({
    queryKey: ['teamMembers'],
    queryFn: () =>
      fetch('/api/settings/team-members').then((r) => r.json()),
  })
}

export function useCreateTeamMember() {
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

export function useUpdateTeamMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      name,
      code,
    }: {
      id: string
      name: string
      code?: string
    }) =>
      fetch(`/api/settings/team-members?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, code: code?.trim() || undefined }),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teamMembers'] }),
  })
}

export function useDeleteTeamMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/settings/team-members?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teamMembers'] }),
  })
}

export function useTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: () => fetch('/api/settings/tags').then((r) => r.json()),
  })
}

export function useCreateTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      const r = await fetch('/api/settings/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok)
        throw new Error((data as { error?: string })?.error ?? `Fejl ${r.status}`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  })
}

export function useUpdateTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      name,
      color,
      isBlacklisted,
    }: {
      id: string
      name?: string
      color?: string
      isBlacklisted?: boolean
    }) =>
      fetch(`/api/settings/tags?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color, isBlacklisted }),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  })
}

export function useDeleteTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/settings/tags?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  })
}

export function useApiKeys() {
  return useQuery({
    queryKey: ['apiKeys'],
    queryFn: () => fetch('/api/settings/api-keys').then((r) => r.json()),
  })
}

export function useCreateApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const r = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok)
        throw new Error((data as { error?: string })?.error ?? `Fejl ${r.status}`)
      return data as { key: string; message: string }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['apiKeys'] }),
  })
}

export function useDeleteApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/settings/api-keys?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['apiKeys'] }),
  })
}

export const DAY_LABELS: Record<string, string> = {
  mon: 'Mandag',
  tue: 'Tirsdag',
  wed: 'Onsdag',
  thu: 'Torsdag',
  fri: 'Fredag',
  sat: 'Lørdag',
  sun: 'Søndag',
}

export function useWorkHours() {
  return useQuery({
    queryKey: ['workHours'],
    queryFn: () =>
      fetch('/api/settings/work-hours').then((r) => r.json()),
  })
}

export function useUpdateWorkHours() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (
      workHours: Record<string, { start: string; end: string } | null>
    ) =>
      fetch('/api/settings/work-hours', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workHours),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workHours'] }),
  })
}

export const TYPE_LABELS: Record<string, string> = {
  kunde: 'Kunde',
  salg: 'Salg',
  ledelse: 'Ledelse',
  internt: 'Internt',
}

export function usePriorityFactors() {
  return useQuery({
    queryKey: ['priorityFactors'],
    queryFn: () =>
      fetch('/api/settings/priority-factors').then((r) => r.json()),
  })
}

export interface KeywordWeight {
  terms: string[]
  importance: number
  urgency: number
}

export function useUpdatePriorityFactors() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (factors: {
      typeImportance?: Record<string, number>
      typeUrgency?: Record<string, number>
      customerMultiplier?: number
      keywordWeights?: KeywordWeight[]
    }) =>
      fetch('/api/settings/priority-factors', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(factors),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['priorityFactors'] }),
  })
}

export function useSyncUrgency() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      fetch('/api/tasks/sync-urgency', { method: 'POST' }).then((r) =>
        r.json()
      ) as Promise<{ ok: boolean; updated: number; total: number }>,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

export function useTaskVisualCue() {
  return useQuery({
    queryKey: ['taskVisualCue'],
    queryFn: () =>
      fetch('/api/settings/visual-cue').then((r) => r.json()),
  })
}

export function useUpdateTaskVisualCue() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: {
      enabled?: boolean
      colors?: Partial<Record<string, string>>
    }) =>
      fetch('/api/settings/visual-cue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['taskVisualCue'] }),
  })
}

export function useTaskTableColumns() {
  return useQuery({
    queryKey: ['taskTableColumns'],
    queryFn: () => fetch('/api/settings/table-columns').then((r) => r.json()),
  })
}

export function useUpdateTaskTableColumns() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { order?: string[]; enabled?: Record<string, boolean> }) =>
      fetch('/api/settings/table-columns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['taskTableColumns'] }),
  })
}
