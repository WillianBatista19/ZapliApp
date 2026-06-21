'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/components/Avatar'
import type { VibeType } from '@/types'

// ─── types ────────────────────────────────────────────────────────────────────

type VibeUser = {
  type:    VibeType
  user_id: string
  profiles: {
    display_name: string | null
    username:     string
    avatar_url:   string | null
  } | null
}

// ─── constants ────────────────────────────────────────────────────────────────

const VIBE_EMOJI: Record<VibeType, string> = {
  serving: '🔥',
  morrei:  '💀',
  iconic:  '👑',
  cha:     '☕',
  hype:    '🌊',
}

const TABS: { id: VibeType | 'all'; label: string }[] = [
  { id: 'all',     label: 'Todos' },
  { id: 'serving', label: '🔥 Serving' },
  { id: 'morrei',  label: '💀 Morri' },
  { id: 'iconic',  label: '👑 Iconic' },
  { id: 'cha',     label: '☕ Chá' },
  { id: 'hype',    label: '🌊 No Hype' },
]

// ─── component ────────────────────────────────────────────────────────────────

type Props = {
  postId:  string
  onClose: () => void
}

export default function VibeListModal({ postId, onClose }: Props) {
  const supabase              = useMemo(() => createClient(), [])
  const [vibes,    setVibes]  = useState<VibeUser[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setTab]   = useState<VibeType | 'all'>('all')

  useEffect(() => {
    supabase
      .from('vibes')
      .select('type, user_id, profiles(display_name, username, avatar_url)')
      .eq('post_id', postId)
      .then(({ data }) => {
        setVibes((data ?? []) as unknown as VibeUser[])
        setLoading(false)
      })
  }, [supabase, postId])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const total = vibes.length

  const tabCounts = useMemo(() => {
    const counts: Partial<Record<VibeType, number>> = {}
    for (const v of vibes) counts[v.type] = (counts[v.type] ?? 0) + 1
    return counts
  }, [vibes])

  const filtered = activeTab === 'all' ? vibes : vibes.filter(v => v.type === activeTab)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl"
        style={{ maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h2 className="text-sm font-semibold text-zinc-100">
            {loading ? 'Vibes' : `${total} ${total === 1 ? 'vibe' : 'vibes'}`}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="h-4 w-4" aria-hidden>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 overflow-x-auto border-b border-zinc-800 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map(tab => {
            const count = tab.id === 'all' ? total : (tabCounts[tab.id as VibeType] ?? 0)
            if (tab.id !== 'all' && count === 0) return null
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTab(tab.id)}
                className={[
                  'shrink-0 whitespace-nowrap px-4 py-2.5 text-xs font-semibold transition-colors',
                  isActive
                    ? 'border-b-2 border-[#D4537E] text-[#D4537E]'
                    : 'text-zinc-500 hover:text-zinc-300',
                ].join(' ')}
              >
                {tab.label}
                {tab.id !== 'all' && count > 0 && (
                  <span className="ml-1 tabular-nums opacity-60">·{count}</span>
                )}
              </button>
            )
          })}
        </div>

        {/* User list */}
        <div className="overflow-y-auto">
          {loading ? (
            <p className="py-10 text-center text-xs text-zinc-600">Carregando…</p>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-xs text-zinc-600">Nenhuma vibe por aqui ainda.</p>
          ) : (
            filtered.map((v, i) => {
              const p = v.profiles
              if (!p) return null
              return (
                <Link
                  key={`${v.user_id}-${i}`}
                  href={`/profile/${p.username}`}
                  onClick={onClose}
                  className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-zinc-800/60"
                >
                  <Avatar src={p.avatar_url} name={p.display_name || p.username} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-100">{p.display_name || p.username}</p>
                    <p className="truncate text-xs text-zinc-500">@{p.username}</p>
                  </div>
                  {activeTab === 'all' && (
                    <span className="shrink-0 text-base">{VIBE_EMOJI[v.type]}</span>
                  )}
                </Link>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
