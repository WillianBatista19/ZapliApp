'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

type Guess = { word: string; rank: number }

function getRankColor(rank: number): string {
  if (rank === 1)    return 'text-[#7F77DD]'
  if (rank <= 200)   return 'text-[#1D9E75]'
  if (rank <= 1000)  return 'text-yellow-500'
  if (rank <= 3000)  return 'text-orange-500'
  return 'text-red-400'
}

function getRankBg(rank: number): string {
  if (rank === 1)    return 'bg-[#7F77DD]/10 ring-1 ring-[#7F77DD]/30'
  if (rank <= 200)   return 'bg-[#1D9E75]/10'
  if (rank <= 1000)  return 'bg-yellow-500/10'
  if (rank <= 3000)  return 'bg-orange-500/10'
  return 'bg-zinc-800/60'
}

function getEmoji(rank: number): string {
  if (rank === 1)    return '✅'
  if (rank <= 200)   return '🟢'
  if (rank <= 1000)  return '🟡'
  if (rank <= 3000)  return '🟠'
  return '🔴'
}

function getHint(rank: number): string {
  if (rank === 1)    return '✅ Você acertou!'
  if (rank <= 50)    return '🔥 Quente!'
  if (rank <= 200)   return '♨️ Morno'
  if (rank <= 1000)  return '🌤️ Frio'
  return '🧊 Gelado'
}

function computeScore(attemptsCount: number): number {
  return Math.max(600 - attemptsCount * 10, 50)
}

export default function ContextoGame({ currentUserId }: { currentUserId: string | null }) {
  const supabase = useMemo(() => createClient(), [])
  const today    = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

  const [guesses,     setGuesses]     = useState<Guess[]>([])
  const [input,       setInput]       = useState('')
  const [loading,     setLoading]     = useState(false)
  const [initLoading, setInitLoading] = useState(true)
  const [solved,      setSolved]      = useState(false)
  const [message,     setMessage]     = useState('')
  const [shared,      setShared]      = useState(false)
  const [warming,     setWarming]     = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load saved state — filter out old-format entries that lack rank
  useEffect(() => {
    if (!currentUserId) { setInitLoading(false); return }
    async function load() {
      const { data } = await supabase
        .from('contexto_attempts')
        .select('guesses, solved')
        .eq('user_id', currentUserId)
        .eq('play_date', today)
        .maybeSingle()
      if (data) {
        const saved = ((data.guesses as Guess[]) ?? []).filter(g => typeof g.rank === 'number')
        setGuesses(saved)
        setSolved(data.solved as boolean)
      }
      setInitLoading(false)
    }
    void load()
  }, [supabase, currentUserId, today])

  async function saveAttempt(newGuesses: Guess[], isSolved: boolean) {
    if (!currentUserId) return
    await supabase.from('contexto_attempts').upsert({
      user_id:        currentUserId,
      play_date:      today,
      guesses:        newGuesses,
      solved:         isSolved,
      attempts_count: newGuesses.length,
    }, { onConflict: 'user_id,play_date' })
  }

  async function handleSubmit() {
    const word = input.trim().toLowerCase()
    if (!word) return

    if (guesses.some(g => g.word === word)) {
      setMessage('Você já tentou essa palavra.')
      setTimeout(() => setMessage(''), 2000)
      return
    }

    setLoading(true)
    setMessage('')
    let didSolve = false

    try {
      const res  = await fetch('/api/contexto/similarity', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ guess: word, playDate: today }),
      })
      const json = await res.json() as { rank?: number; isCorrect?: boolean; error?: string; retryAfter?: number }

      if (res.status === 503) {
        setWarming(true)
        setInput(word)
        setTimeout(() => setWarming(false), (json.retryAfter ?? 10) * 1000)
        return
      }

      if (!res.ok || typeof json.rank !== 'number') {
        setMessage(json.error ?? 'Erro ao calcular rank.')
        return
      }

      setWarming(false)

      const newGuess: Guess = { word, rank: json.rank }
      const newGuesses      = [...guesses, newGuess]
      const isSolved        = json.isCorrect === true

      setGuesses(newGuesses)
      setInput('')

      if (isSolved) {
        didSolve = true
        setSolved(true)
        const score = computeScore(newGuesses.length)
        setMessage(`Encontrou! 🎉 +${score} pts`)
        if (currentUserId) {
          await saveAttempt(newGuesses, true)
          await supabase.rpc('add_game_score', {
            p_user_id:   currentUserId,
            p_game_type: 'contexto',
            p_score:     score,
          })
        }
      } else {
        await saveAttempt(newGuesses, false)
      }
    } finally {
      setLoading(false)
      if (!didSolve) setTimeout(() => document.getElementById('contexto-input')?.focus(), 100)
    }
  }

  function handleShare() {
    const text = `Encontrei a palavra do Contexto em ${guesses.length} tentativa${guesses.length !== 1 ? 's' : ''}! 🧠 #incelicas`
    void navigator.clipboard.writeText(text).then(() => {
      setShared(true)
      setTimeout(() => setShared(false), 2000)
    })
  }

  // Sorted: lowest rank first (rank 1 = the answer, best guess at top)
  const sorted = [...guesses].sort((a, b) => a.rank - b.rank)

  if (initLoading) {
    return <div className="flex h-40 items-center justify-center text-sm text-zinc-500">Carregando...</div>
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Input row */}
      {!solved && (
        <div className="flex gap-2">
          <input
            ref={inputRef}
            id="contexto-input"
            type="text"
            value={input}
            onChange={e => setInput(e.target.value.toLowerCase())}
            onKeyDown={e => { if (e.key === 'Enter' && !loading) void handleSubmit() }}
            placeholder="Digite uma palavra em português..."
            disabled={loading}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors focus:border-[#7F77DD] disabled:opacity-50"
          />
          <button
            onClick={() => void handleSubmit()}
            disabled={loading || !input.trim()}
            className="rounded-xl bg-[#7F77DD] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#6d65cb] disabled:opacity-40"
          >
            {loading ? (
              <span className="flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Calculando
              </span>
            ) : 'Tentar'}
          </button>
        </div>
      )}

      {/* Model warming banner */}
      {warming && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center">
          <p className="text-sm font-semibold text-amber-400">⏳ Modelo carregando…</p>
          <p className="mt-0.5 text-xs text-zinc-400">Aguarde alguns segundos e tente novamente. A tentativa não foi contada.</p>
        </div>
      )}

      {/* Message */}
      {message && (
        <div className="rounded-xl bg-zinc-800 px-4 py-2 text-center text-sm font-semibold text-zinc-100">
          {message}
        </div>
      )}

      {/* Solved banner + share */}
      {solved && (
        <div className="rounded-xl border border-[#7F77DD]/40 bg-[#7F77DD]/10 px-4 py-3">
          <p className="text-sm font-semibold text-[#7F77DD]">
            ✅ Encontrou em {guesses.length} tentativa{guesses.length !== 1 ? 's' : ''}!
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">
            Pontuação: {computeScore(guesses.length)} pts
          </p>
          <button
            onClick={handleShare}
            className="mt-2 rounded-xl bg-[#7F77DD] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#6d65cb]"
          >
            {shared ? '✓ Copiado!' : '📋 Compartilhar resultado'}
          </button>
        </div>
      )}

      {/* Guess list — sorted by rank ascending */}
      {sorted.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-zinc-600">
            {guesses.length} tentativa{guesses.length !== 1 ? 's' : ''}
          </p>
          {sorted.map((g, i) => (
            <div
              key={g.word}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 ${getRankBg(g.rank)}`}
            >
              <span className="w-5 shrink-0 text-center text-xs text-zinc-600">{i + 1}.</span>
              <span className="w-24 shrink-0 truncate font-mono text-sm text-zinc-200">{g.word}</span>
              <div className="flex flex-1 items-center justify-end gap-3">
                <span className="text-xs text-zinc-500">{getHint(g.rank)}</span>
                <span className={`font-mono text-sm font-bold tabular-nums ${getRankColor(g.rank)}`}>
                  #{g.rank}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {guesses.length === 0 && !solved && (
        <p className="py-4 text-center text-xs text-zinc-600">
          Tente qualquer palavra — quanto menor o rank, mais perto você está!
        </p>
      )}

      {!currentUserId && (
        <p className="text-center text-xs text-zinc-600">
          Faça login para salvar sua pontuação
        </p>
      )}
    </div>
  )
}
