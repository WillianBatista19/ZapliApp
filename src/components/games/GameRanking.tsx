'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/components/Avatar'

type RankRow = {
  user_id:        string
  username:       string
  display_name:   string | null
  avatar_url:     string | null
  music_total:    number
  word_total:     number
  contexto_total: number
  total:          number
}

type Tab = 'total' | 'music' | 'word' | 'contexto'

export default function GameRanking({ currentUserId }: { currentUserId: string | null }) {
  const supabase            = useMemo(() => createClient(), [])
  const [rows,    setRows]  = useState<RankRow[]>([])
  const [tab,     setTab]   = useState<Tab>('total')
  const [loading, setLoad]  = useState(true)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.rpc('get_game_ranking')
      if (!error && data) {
        setRows((data as RankRow[]).map(r => ({
          ...r,
          contexto_total: r.contexto_total ?? 0,
          total: r.music_total + r.word_total + (r.contexto_total ?? 0),
        })))
      }
      setLoad(false)
    }
    void load()
  }, [supabase])

  const TAB_KEY: Record<Tab, keyof RankRow> = {
    total:    'total',
    music:    'music_total',
    word:     'word_total',
    contexto: 'contexto_total',
  }

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => (b[TAB_KEY[tab]] as number) - (a[TAB_KEY[tab]] as number)).slice(0, 10)
  }, [rows, tab])

  const myRow = useMemo(() => {
    if (!currentUserId) return null
    const all = [...rows].sort((a, b) => (b[TAB_KEY[tab]] as number) - (a[TAB_KEY[tab]] as number))
    const idx = all.findIndex(r => r.user_id === currentUserId)
    return idx >= 10 ? { rank: idx + 1, row: all[idx] } : null
  }, [rows, tab, currentUserId])

  function getScore(r: RankRow) {
    return r[TAB_KEY[tab]] as number
  }

  const MEDALS = ['🥇','🥈','🥉']

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <h3 className="mb-3 text-sm font-semibold text-zinc-100">🏆 Ranking</h3>

      {/* Tab switcher */}
      <div className="mb-3 flex gap-1 rounded-xl bg-zinc-800 p-0.5">
        {(['total','music','word','contexto'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
              tab === t ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t === 'total' ? 'Geral' : t === 'music' ? '🎵' : t === 'word' ? '📝' : '🧠'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-zinc-600">Carregando...</div>
      ) : sorted.length === 0 ? (
        <div className="py-8 text-center text-xs text-zinc-600">
          Nenhuma pontuação ainda. Jogue para aparecer!
        </div>
      ) : (
        <div className="space-y-1.5">
          {sorted.map((r, i) => {
            const isMe = r.user_id === currentUserId
            return (
              <div
                key={r.user_id}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 ${
                  isMe ? 'bg-[#D4537E]/10 ring-1 ring-[#D4537E]/30' : 'bg-zinc-800/50'
                }`}
              >
                <span className="w-5 text-center text-xs font-bold">
                  {i < 3 ? MEDALS[i] : <span className="text-zinc-600">{i + 1}.</span>}
                </span>
                <Avatar src={r.avatar_url} name={r.display_name || r.username} size="sm" />
                <span className="min-w-0 flex-1 truncate text-xs text-zinc-300">
                  {r.display_name || r.username}
                </span>
                <span className="text-xs font-bold text-[#D4537E]">
                  {getScore(r).toLocaleString()}
                </span>
              </div>
            )
          })}

          {myRow && (
            <>
              <div className="px-3 py-0.5 text-center text-xs text-zinc-700">· · ·</div>
              <div className="flex items-center gap-2 rounded-xl bg-[#D4537E]/10 px-3 py-2 ring-1 ring-[#D4537E]/30">
                <span className="w-5 text-center text-xs font-bold text-zinc-600">{myRow.rank}.</span>
                <Avatar src={myRow.row.avatar_url} name={myRow.row.display_name || myRow.row.username} size="sm" />
                <span className="min-w-0 flex-1 truncate text-xs text-zinc-300">
                  {myRow.row.display_name || myRow.row.username}
                </span>
                <span className="text-xs font-bold text-[#D4537E]">{getScore(myRow.row).toLocaleString()}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
