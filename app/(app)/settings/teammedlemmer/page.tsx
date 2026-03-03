'use client'

import { useState } from 'react'
import {
  useTeamMembers,
  useCreateTeamMember,
  useUpdateTeamMember,
  useDeleteTeamMember,
} from '../_lib/settings-hooks'

export default function TeammedlemmerPage() {
  const [teamMemberName, setTeamMemberName] = useState('')
  const [teamMemberCode, setTeamMemberCode] = useState('')
  const [editingTeamMember, setEditingTeamMember] = useState<{
    id: string
    name: string
    code?: string | null
  } | null>(null)
  const { data: teamMembers = [], isLoading: teamMembersLoading } =
    useTeamMembers()
  const createTeamMember = useCreateTeamMember()
  const updateTeamMember = useUpdateTeamMember()
  const deleteTeamMember = useDeleteTeamMember()

  return (
    <div className="min-w-0 max-w-full">
      <h1 className="text-3xl font-semibold text-slate-100 mb-2">
        Teammedlemmer
      </h1>
      <p className="text-xs text-app-muted mb-6">
        Teammedlemmer kan tildeles opgaver til delegering.
      </p>
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
          onChange={(e) =>
            setTeamMemberCode(e.target.value.toUpperCase().slice(0, 3))
          }
          placeholder="Kode (3 bogstaver)"
          maxLength={3}
          className="w-40 bg-slate-900/60 border border-white/5 rounded-lg px-4 py-2 text-sm text-slate-200 placeholder:text-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent/40"
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
              {teamMembers.map(
                (t: { id: string; name: string; code?: string | null }) => (
                  <tr
                    key={t.id}
                    className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]"
                  >
                    <td
                      className="px-4 py-2.5 text-slate-200 truncate"
                      title={t.name}
                    >
                      {t.name}
                    </td>
                    <td className="px-4 py-2.5 text-app-muted">
                      {t.code ?? '–'}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingTeamMember(t)}
                          disabled={updateTeamMember.isPending}
                          className="shrink-0 p-2 rounded-lg border border-white/10 bg-white/5 text-app-muted hover:text-slate-200 hover:bg-white/10 transition-colors duration-200 ease-out disabled:opacity-50"
                          aria-label="Rediger"
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
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm('Slet dette team-medlem?'))
                              deleteTeamMember.mutate(t.id)
                          }}
                          disabled={deleteTeamMember.isPending}
                          className="shrink-0 p-2 rounded-lg border border-white/10 bg-white/5 text-app-danger hover:bg-red-500/10 hover:border-red-500/20 transition-colors duration-200 ease-out disabled:opacity-50"
                          aria-label="Slet"
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
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}

      {editingTeamMember && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[modalOverlayIn_200ms_ease-out_forwards]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-team-member-title"
          onClick={(e) =>
            e.target === e.currentTarget && setEditingTeamMember(null)
          }
        >
          <div
            className="app-card-gradient rounded-lg shadow-hover border border-white/10 w-full max-w-md p-5 animate-[modalContentIn_250ms_ease-out_forwards]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2
                id="edit-team-member-title"
                className="text-lg font-semibold text-slate-100"
              >
                Rediger team-medlem
              </h2>
              <button
                type="button"
                onClick={() => setEditingTeamMember(null)}
                className="shrink-0 p-2 rounded-lg border border-white/10 bg-white/5 text-app-muted hover:text-slate-200 hover:bg-white/10 transition-colors duration-200 ease-out"
                aria-label="Luk"
              >
                <svg
                  className="w-4 h-4"
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
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const form = e.currentTarget
                const name = (
                  form.elements.namedItem(
                    'edit-team-member-name'
                  ) as HTMLInputElement
                ).value.trim()
                const code = (
                  form.elements.namedItem(
                    'edit-team-member-code'
                  ) as HTMLInputElement
                ).value.trim()
                if (name) {
                  updateTeamMember.mutate(
                    {
                      id: editingTeamMember.id,
                      name,
                      code: code || undefined,
                    },
                    { onSuccess: () => setEditingTeamMember(null) }
                  )
                }
              }}
              className="space-y-4"
            >
              <div>
                <label
                  htmlFor="edit-team-member-name"
                  className="block text-xs font-medium text-app-muted mb-1"
                >
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
                <label
                  htmlFor="edit-team-member-code"
                  className="block text-xs font-medium text-app-muted mb-1"
                >
                  Kode (3 bogstaver)
                </label>
                <input
                  id="edit-team-member-code"
                  name="edit-team-member-code"
                  type="text"
                  defaultValue={editingTeamMember.code ?? ''}
                  maxLength={3}
                  onChange={(e) =>
                    (e.target.value = e.target.value.toUpperCase().slice(0, 3))
                  }
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
