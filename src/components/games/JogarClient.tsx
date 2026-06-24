'use client'

import { useState } from 'react'
import Link from 'next/link'
import WordGame     from '@/components/games/WordGame'
import MusicGame    from '@/components/games/MusicGame'
import ContextoGame from '@/components/games/ContextoGame'
import GameRanking  from '@/components/games/GameRanking'

type Tab = 'word' | 'music' | 'contexto'

const TAB_CONFIG: Record<Tab, { label: string; color: string; activeColor: string; badge: string }> = {
  word:     { label: '📝 Termo',    color: 'text-zinc-500 hover:text-zinc-300', activeColor: 'bg-[#7F77DD] text-white shadow-sm', badge: '6 tentativas' },
  music:    { label: '🎵 Música',   color: 'text-zinc-500 hover:text-zinc-300', activeColor: 'bg-[#D4537E] text-white shadow-sm', badge: '6 trechos'    },
  contexto: { label: '🧠 Contexto', color: 'text-zinc-500 hover:text-zinc-300', activeColor: 'bg-[#1D9E75] text-white shadow-sm', badge: '∞ tentativas' },
}

const GAME_TITLE: Record<Tab, string> = {
  word:     '📝 Termo das Incelicas',
  music:    '🎵 Adivinhe a Música',
  contexto: '🧠 Contexto',
}

export default function JogarClient({
  currentUserId,
  isAdmin,
}: {
  currentUserId: string | null
  isAdmin:       boolean
}) {
  const [tab, setTab] = useState<Tab>('word')

  const today = new Date().toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday:  'long',
    day:      'numeric',
    month:    'long',
  })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-zinc-100">🎮 Jogar</h1>
          <p className="text-xs capitalize text-zinc-500">{today}</p>
        </div>
        {isAdmin && (
          <Link
            href="/jogar/admin"
            className="rounded-xl border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
          >
            ⚙️ Admin
          </Link>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 rounded-2xl bg-zinc-900 p-1">
        {(Object.keys(TAB_CONFIG) as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-xl py-2.5 text-xs font-semibold transition-colors sm:text-sm ${
              tab === t ? TAB_CONFIG[t].activeColor : TAB_CONFIG[t].color
            }`}
          >
            {TAB_CONFIG[t].label}
          </button>
        ))}
      </div>

      {/* Game card */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm font-semibold text-zinc-100">{GAME_TITLE[tab]}</span>
          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-500">
            {TAB_CONFIG[tab].badge}
          </span>
        </div>

        {tab === 'word'     && <WordGame     currentUserId={currentUserId} />}
        {tab === 'music'    && <MusicGame    currentUserId={currentUserId} />}
        {tab === 'contexto' && (
          <div>
            <p className="mb-4 text-xs text-zinc-500">
              Encontre a palavra secreta por similaridade semântica. Rank #1 é a palavra do dia — quanto menor o número, mais perto você está!
            </p>
            <ContextoGame currentUserId={currentUserId} />
          </div>
        )}
      </div>

      {/* Ranking */}
      <GameRanking currentUserId={currentUserId} />
    </div>
  )
}
