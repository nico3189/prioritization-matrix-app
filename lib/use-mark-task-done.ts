'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'

const COMPLETION_ANIMATION_MS = 550

export function useMarkTaskDone(options?: {
  onSuccess?: (data: { id: string }) => void
}) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'done' }),
      }).then((r) => r.json()),
    onSuccess: (data: { id: string }) => {
      options?.onSuccess?.(data)
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['tasks'] })
        qc.invalidateQueries({ queryKey: ['task', data.id] })
      }, COMPLETION_ANIMATION_MS)
    },
  })
}
