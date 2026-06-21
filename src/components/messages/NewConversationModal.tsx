'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/components/Avatar'
import { getOrCreateConversation } from '@/app/(app)/messages/actions'

type Profile = {
  id:           string
  username:     string
  display_name: string | null
  avatar_url:   string | null
}

export default function NewConversationModal({ onClose }: { onClose: () => void }) {
  const router   = useRouter()
  const supabase = createClient()

  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState<Profile[]>([])
  const [loading,  setLoading]  = useState(false)
  const [starting, setStarting] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function search(q: string) {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .or(`username.ilike.%${q.trim()}%,display_name.ilike.%${q.trim()}%`)
      .limit(8)
    setResults((data as Profile[] | null) ?? [])
    setLoading(false)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value
    setQuery(q)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => void search(q), 300)
  }

  async function startConversation(profileId: string) {
    setStarting(profileId)
    try {
      const result = await getOrCreateConversation(profileId)
      if ('conversationId' in result) {
        router.push(`/messages/${result.conversationId}`)
        onClose()
      }
    } finally {
      setStarting(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3.5">
          <h2 className="text-sm font-bold text-zinc-100">Nova mensagem</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
            aria-label="Fechar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="h-4 w-4" aria-hidden>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pt-3 pb-2">
          <div className="relative">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 pointer-events-none" aria-hidden>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              type="search"
              value={query}
              onChange={handleChange}
              placeholder="Buscar pelo nome ou @username…"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 py-2.5 pl-9 pr-4 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-colors focus:border-[#D4537E]"
            />
          </div>
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto px-2 pb-3">
          {loading && (
            <p className="px-3 py-3 text-xs text-zinc-500">Buscando…</p>
          )}
          {!loading && query.trim() && results.length === 0 && (
            <p className="px-3 py-3 text-xs text-zinc-500">
              Nenhuma incelica encontrada. Tenta outro nome.
            </p>
          )}
          {!query.trim() && (
            <p className="px-3 py-3 text-xs text-zinc-500">
              Digite um nome para buscar incelicas…
            </p>
          )}
          {results.map(p => {
            const busy = starting === p.id
            return (
              <button
                key={p.id}
                type="button"
                disabled={!!starting}
                onClick={() => void startConversation(p.id)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-zinc-800 disabled:opacity-60"
              >
                <Avatar src={p.avatar_url} name={p.display_name || p.username} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-200">{p.display_name || p.username}</p>
                  <p className="truncate text-xs text-zinc-500">@{p.username}</p>
                </div>
                {busy && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="h-4 w-4 shrink-0 animate-spin text-zinc-400" aria-hidden>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
