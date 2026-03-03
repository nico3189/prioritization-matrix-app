'use client'

import { useState } from 'react'
import {
  useTags,
  useCreateTag,
  useUpdateTag,
  useDeleteTag,
} from '../_lib/settings-hooks'

export default function TagsPage() {
  const [tagName, setTagName] = useState('')
  const [editingTag, setEditingTag] = useState<{
    id: string
    name: string
    color: string
    isBlacklisted: boolean
  } | null>(null)
  const { data: tags = [], isLoading: tagsLoading } = useTags()
  const createTag = useCreateTag()
  const updateTag = useUpdateTag()
  const deleteTag = useDeleteTag()

  return (
    <div className="min-w-0 max-w-full">
      <h1 className="text-3xl font-semibold text-slate-100 mb-2">Tags</h1>
      <p className="text-xs text-app-muted mb-6">
        Tags bruges til kategorisering. Blacklistede tags bruges ikke af AI.
      </p>
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <input
          type="text"
          value={tagName}
          onChange={(e) => setTagName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && tagName.trim()) {
              e.preventDefault()
              createTag.mutate(
                { name: tagName.trim() },
                { onSuccess: () => setTagName('') }
              )
            }
          }}
          placeholder="Tag-navn"
          className="w-full max-w-[12rem] bg-slate-900/60 border border-white/5 rounded-lg px-4 py-2 text-sm text-slate-200 placeholder:text-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent/40"
        />
        <button
          type="button"
          onClick={() => {
            if (tagName.trim()) {
              createTag.mutate(
                { name: tagName.trim() },
                { onSuccess: () => setTagName('') }
              )
            }
          }}
          disabled={createTag.isPending}
          className="bg-app-accent text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md hover:opacity-90 active:scale-95 transition-colors duration-200 ease-out disabled:opacity-50"
        >
          {createTag.isPending ? 'Tilføjer...' : 'Tilføj'}
        </button>
      </div>
      {createTag.isError && (
        <p className="text-sm text-app-danger mb-2">
          {createTag.error?.message}
        </p>
      )}
      {tagsLoading ? (
        <p className="text-sm text-app-muted">Henter...</p>
      ) : (
        <div className="overflow-x-auto rounded-xl2 border border-white/5 app-card-gradient">
          <table className="w-full min-w-[20rem] table-fixed text-sm">
            <colgroup>
              <col style={{ width: '40%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '6rem' }} />
            </colgroup>
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-app-muted uppercase tracking-wider">
                  Navn
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-app-muted uppercase tracking-wider">
                  Farve
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-app-muted uppercase tracking-wider">
                  Blacklist
                </th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {(
                tags as Array<{
                  id: string
                  name: string
                  color: string
                  isBlacklisted: boolean
                }>
              ).map((t) => (
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
                  <td className="px-4 py-2.5">
                    <span
                      className="inline-block w-6 h-6 rounded border border-white/20"
                      style={{ backgroundColor: t.color }}
                      title={t.color}
                      aria-hidden
                    />
                  </td>
                  <td className="px-4 py-2.5 text-app-muted">
                    {t.isBlacklisted ? 'Ja' : 'Nej'}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingTag(t)}
                        disabled={updateTag.isPending}
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
                          if (confirm('Slet dette tag?'))
                            deleteTag.mutate(t.id)
                        }}
                        disabled={deleteTag.isPending}
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
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingTag && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[modalOverlayIn_200ms_ease-out_forwards]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-tag-title"
          onClick={(e) => e.target === e.currentTarget && setEditingTag(null)}
        >
          <div
            className="app-card-gradient rounded-lg shadow-hover border border-white/10 w-full max-w-md p-5 animate-[modalContentIn_250ms_ease-out_forwards]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2
                id="edit-tag-title"
                className="text-lg font-semibold text-slate-100"
              >
                Rediger tag
              </h2>
              <button
                type="button"
                onClick={() => setEditingTag(null)}
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
                  form.elements.namedItem('edit-tag-name') as HTMLInputElement
                ).value.trim()
                const color = (
                  form.elements.namedItem('edit-tag-color') as HTMLInputElement
                ).value.trim()
                const isBlacklisted = (
                  form.elements.namedItem(
                    'edit-tag-blacklist'
                  ) as HTMLInputElement
                ).checked
                if (name) {
                  updateTag.mutate(
                    {
                      id: editingTag.id,
                      name,
                      color: color || undefined,
                      isBlacklisted,
                    },
                    { onSuccess: () => setEditingTag(null) }
                  )
                }
              }}
              className="space-y-4"
            >
              <div>
                <label
                  htmlFor="edit-tag-name"
                  className="block text-xs font-medium text-app-muted mb-1"
                >
                  Navn
                </label>
                <input
                  id="edit-tag-name"
                  name="edit-tag-name"
                  type="text"
                  defaultValue={editingTag.name}
                  required
                  className="w-full bg-slate-900/60 border border-white/5 rounded-lg px-4 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-app-accent/40"
                />
              </div>
              <div>
                <label
                  htmlFor="edit-tag-color"
                  className="block text-xs font-medium text-app-muted mb-1"
                >
                  Farve (hex)
                </label>
                <input
                  id="edit-tag-color"
                  name="edit-tag-color"
                  type="color"
                  defaultValue={editingTag.color}
                  className="h-10 w-20 cursor-pointer rounded border border-white/5 bg-slate-900/60"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="edit-tag-blacklist"
                  name="edit-tag-blacklist"
                  type="checkbox"
                  defaultChecked={editingTag.isBlacklisted}
                  className="rounded border-white/20 bg-slate-900/60 text-app-accent focus:ring-app-accent/40"
                />
                <label
                  htmlFor="edit-tag-blacklist"
                  className="text-sm text-slate-300"
                >
                  Blacklist (AI bruger ikke dette tag)
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTag(null)}
                  className="shrink-0 p-2 rounded-lg border border-white/10 bg-white/5 text-app-muted hover:text-slate-200 hover:bg-white/10 transition-colors duration-200 ease-out"
                  aria-label="Annuller"
                >
                  Annuller
                </button>
                <button
                  type="submit"
                  disabled={updateTag.isPending}
                  className="bg-app-accent text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md hover:opacity-90 active:scale-95 transition-colors duration-200 ease-out disabled:opacity-50"
                >
                  {updateTag.isPending ? 'Gemmer...' : 'Gem'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
