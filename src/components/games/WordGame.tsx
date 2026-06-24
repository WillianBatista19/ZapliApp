'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

const WORD_LEN  = 5
const MAX_TRIES = 6
const SCORES    = [600, 500, 400, 300, 200, 100]

type LetterState = 'correct' | 'present' | 'absent'

function evaluateGuess(guess: string, target: string): LetterState[] {
  const result    = Array<LetterState>(WORD_LEN).fill('absent')
  const remaining = target.split('')   // tracks un-consumed target letters

  // Pass 1 — greens: correct letter at correct position
  for (let i = 0; i < WORD_LEN; i++) {
    if (guess[i] === target[i]) {
      result[i]    = 'correct'
      remaining[i] = ''              // consume so pass 2 can't re-use it
    }
  }

  // Pass 2 — yellows: correct letter at wrong position (only for non-green slots)
  // Uses remaining[] to handle duplicates: e.g. target "CARRO", guess "RRRRR"
  // → only 2 of the 5 Rs get yellow/green, the rest get gray.
  for (let i = 0; i < WORD_LEN; i++) {
    if (result[i] === 'correct') continue
    const j = remaining.indexOf(guess[i])
    if (j !== -1) {
      result[i]    = 'present'
      remaining[j] = ''             // consume so the next duplicate stays gray
    }
  }

  return result
}

const TILE_STYLE: Record<LetterState | 'empty' | 'current', string> = {
  correct: 'bg-[#1D9E75] border-[#1D9E75] text-white',
  present: 'bg-amber-500  border-amber-500  text-white',
  absent:  'bg-zinc-700   border-zinc-700   text-zinc-300',
  empty:   'border-zinc-700  bg-transparent text-zinc-100',
  current: 'border-zinc-400  bg-transparent text-zinc-100',
}

const KB_ROWS = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['ENTER','Z','X','C','V','B','N','M','⌫'],
]

export default function WordGame({ currentUserId }: { currentUserId: string | null }) {
  const supabase = useMemo(() => createClient(), [])
  const today    = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

  const [word,         setWord]         = useState('')
  const [guesses,      setGuesses]      = useState<string[]>([])
  const [currentGuess, setCurrentGuess] = useState('')
  const [gameOver,     setGameOver]     = useState(false)
  const [won,          setWon]          = useState(false)
  const [loading,      setLoading]      = useState(true)
  const [message,      setMessage]      = useState('')
  const [errorRow,     setErrorRow]     = useState(false)

  useEffect(() => {
    async function init() {
      const { data, error } = await supabase.rpc('get_daily_word')
      if (error) {
        console.error('[WordGame] get_daily_word:', error.message, error.code)
        setMessage('Erro ao carregar palavra. Verifique as permissões no Supabase.')
        setLoading(false)
        return
      }
      const rows  = Array.isArray(data) ? data : (data ? [data] : [])
      const row   = rows[0] as { word: string } | undefined
      if (!row?.word) { setMessage('Nenhuma palavra disponível hoje.'); setLoading(false); return }
      setWord(row.word.toUpperCase())

      if (currentUserId) {
        const { data: attempt } = await supabase
          .from('game_attempts')
          .select('guesses, solved')
          .eq('user_id', currentUserId)
          .eq('game_type', 'word')
          .eq('play_date', today)
          .maybeSingle()
        if (attempt) {
          setGuesses((attempt.guesses as string[]) || [])
          setGameOver(true)
          setWon(attempt.solved as boolean)
        }
      }
      setLoading(false)
    }
    void init()
  }, [supabase, currentUserId, today])

  const letterStates = useMemo<Record<string, LetterState>>(() => {
    const map: Record<string, LetterState> = {}
    const prio: Record<LetterState, number> = { correct: 3, present: 2, absent: 1 }
    guesses.forEach(g => {
      evaluateGuess(g, word).forEach((s, i) => {
        if ((prio[s] ?? 0) > (prio[map[g[i]]] ?? 0)) map[g[i]] = s
      })
    })
    return map
  }, [guesses, word])

  const flash = useCallback((msg: string) => {
    setMessage(msg)
    setTimeout(() => setMessage(''), 2200)
  }, [])

  const submitGuess = useCallback(async () => {
    if (currentGuess.length !== WORD_LEN) {
      flash('Digite 5 letras')
      setErrorRow(true); setTimeout(() => setErrorRow(false), 400)
      return
    }
    const newGuesses = [...guesses, currentGuess]
    setGuesses(newGuesses)
    setCurrentGuess('')

    const solved = currentGuess === word
    const over   = solved || newGuesses.length >= MAX_TRIES

    if (solved) flash(`Arrasou! 🎉 +${SCORES[newGuesses.length - 1] ?? 0} pts`)
    else if (over) flash(`A palavra era ${word}`)

    if (over) {
      setGameOver(true)
      setWon(solved)
      if (currentUserId) {
        const score = solved ? (SCORES[newGuesses.length - 1] ?? 0) : 0
        await supabase.from('game_attempts').insert({
          user_id: currentUserId, game_type: 'word', play_date: today,
          attempts: newGuesses.length, guesses: newGuesses, solved, score,
        })
        if (score > 0) {
          await supabase.rpc('add_game_score', {
            p_user_id: currentUserId, p_game_type: 'word', p_score: score,
          })
        }
      }
    }
  }, [currentGuess, guesses, word, currentUserId, supabase, today, flash])

  const handleKey = useCallback((key: string) => {
    if (gameOver) return
    if (key === '⌫' || key === 'BACKSPACE') {
      setCurrentGuess(g => g.slice(0, -1))
    } else if (key === 'ENTER') {
      void submitGuess()
    } else if (/^[A-ZÁÉÍÓÚÃÕÂÊÔÇ]$/.test(key) && currentGuess.length < WORD_LEN) {
      setCurrentGuess(g => g + key)
    }
  }, [gameOver, currentGuess.length, submitGuess])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      handleKey(e.key.toUpperCase())
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleKey])

  if (loading) {
    return <div className="flex h-56 items-center justify-center text-sm text-zinc-500">Carregando...</div>
  }

  const displayRows = Array.from({ length: MAX_TRIES }, (_, i) => {
    if (i < guesses.length) {
      const g = guesses[i]
      return { letters: g.split(''), states: evaluateGuess(g, word) as Array<LetterState | 'empty' | 'current'> }
    }
    if (i === guesses.length && !gameOver) {
      const letters = currentGuess.padEnd(WORD_LEN).split('')
      return {
        letters,
        states: letters.map((_, j) => (j < currentGuess.length ? 'current' : 'empty')) as Array<LetterState | 'empty' | 'current'>,
      }
    }
    return { letters: Array(WORD_LEN).fill(''), states: Array(WORD_LEN).fill('empty') as Array<'empty'> }
  })

  return (
    <div className="flex flex-col items-center gap-5">
      {message && (
        <div className="rounded-xl bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-100">
          {message}
        </div>
      )}

      {/* Board */}
      <div className="flex flex-col gap-1.5">
        {displayRows.map((row, ri) => (
          <div
            key={ri}
            className={`flex gap-1.5 ${ri === guesses.length && errorRow ? 'animate-pulse' : ''}`}
          >
            {row.letters.map((letter, ci) => (
              <div
                key={ci}
                className={`flex h-12 w-12 items-center justify-center rounded-lg border-2 text-lg font-black uppercase transition-colors duration-300 ${TILE_STYLE[row.states[ci]]}`}
              >
                {letter.trim()}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* On-screen keyboard */}
      <div className="flex w-full flex-col items-center gap-1.5">
        {KB_ROWS.map((row, ri) => (
          <div key={ri} className="flex gap-1">
            {row.map(key => {
              const state = letterStates[key]
              const wide  = key === 'ENTER' || key === '⌫'
              return (
                <button
                  key={key}
                  onPointerDown={e => { e.preventDefault(); handleKey(key) }}
                  className={`flex select-none items-center justify-center rounded-lg text-xs font-bold transition-colors active:opacity-70 ${
                    wide ? 'h-10 min-w-[52px] px-2' : 'h-10 w-9'
                  } ${
                    state === 'correct' ? 'bg-[#1D9E75] text-white' :
                    state === 'present' ? 'bg-amber-500 text-white' :
                    state === 'absent'  ? 'bg-zinc-700 text-zinc-500' :
                    'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
                  }`}
                >
                  {key}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {!currentUserId && (
        <p className="text-xs text-zinc-600">Faça login para salvar sua pontuação</p>
      )}
    </div>
  )
}
