'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type AniListResult = {
  id:       number
  title:    string
  year:     string | null
  score:    number | null
  coverUrl: string | null
  kind:     'ANIME' | 'MANGA'
}

type Props = {
  onSelect: (result: AniListResult) => void
  onClose:  () => void
}

type Kind = 'ANIME' | 'MANGA'

const GQL = `
  query ($search: String, $type: MediaType) {
    Page(perPage: 8) {
      media(search: $search, type: $type) {
        id
        title { romaji english native }
        coverImage { large }
        seasonYear
        averageScore
      }
    }
  }
`

export default function AniListSearchModal({ onSelect, onClose }: Props) {
  const [query,    setQuery]    = useState('')
  const [kind,     setKind]     = useState<Kind>('ANIME')
  const [results,  setResults]  = useState<AniListResult[]>([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cacheRef = useRef<Map<string, AniListResult[]>>(new Map())

  useEffect(() => {
    inputRef.current?.focus()
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [onClose])

  const search = useCallback(async (q: string, k: Kind) => {
    const trimmed = q.trim()
    if (trimmed.length < 3) { setResults([]); return }

    setSearched(true)

    const cacheKey = `${k}:${trimmed.toLowerCase()}`
    if (cacheRef.current.has(cacheKey)) {
      setResults(cacheRef.current.get(cacheKey)!)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('https://graphql.anilist.co', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body:    JSON.stringify({ query: GQL, variables: { search: trimmed, type: k } }),
      })

      if (res.status === 429) {
        setError('Muitas buscas em pouco tempo. Aguarde alguns segundos e tente novamente.')
        return
      }
      if (!res.ok) {
        setError('Erro ao buscar. Tenta de novo!')
        return
      }

      const json  = await res.json()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items = (json?.data?.Page?.media ?? []) as any[]

      const mapped: AniListResult[] = items.map(m => ({
        id:       m.id,
        title:    m.title?.english || m.title?.romaji || m.title?.native || '',
        year:     m.seasonYear ? String(m.seasonYear) : null,
        score:    m.averageScore ?? null,
        coverUrl: m.coverImage?.large ?? null,
        kind:     k,
      }))

      if (cacheRef.current.size >= 10) {
        cacheRef.current.delete(cacheRef.current.keys().next().value!)
      }
      cacheRef.current.set(cacheKey, mapped)
      setResults(mapped)
    } catch {
      setError('Erro ao buscar. Tenta de novo!')
    } finally {
      setLoading(false)
    }
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(val, kind), 500)
  }

  function handleKindToggle(newKind: Kind) {
    setKind(newKind)
    setResults([])
    setError(null)
    setSearched(false)
    if (query.trim().length >= 3) {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => search(query, newKind), 100)
    }
  }

  const showEmpty = !loading && !error && searched && results.length === 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-100">
            Buscar {kind === 'ANIME' ? 'Anime' : 'Manga'}
          </h2>
          <div className="flex items-center gap-2">
            {/* Anime / Manga toggle */}
            <div className="flex rounded-full border border-zinc-700 bg-zinc-800 p-0.5">
              <button
                type="button"
                onClick={() => handleKindToggle('ANIME')}
                className={[
                  'rounded-full px-3 py-0.5 text-xs font-semibold transition-all',
                  kind === 'ANIME' ? 'bg-[#D4537E] text-white' : 'text-zinc-400 hover:text-zinc-200',
                ].join(' ')}
              >
                Anime
              </button>
              <button
                type="button"
                onClick={() => handleKindToggle('MANGA')}
                className={[
                  'rounded-full px-3 py-0.5 text-xs font-semibold transition-all',
                  kind === 'MANGA' ? 'bg-[#D4537E] text-white' : 'text-zinc-400 hover:text-zinc-200',
                ].join(' ')}
              >
                Manga
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-zinc-400 transition-colors hover:text-zinc-200"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Input */}
        <div className="p-4 pb-2">
          <input
            ref={inputRef}
            value={query}
            onChange={handleChange}
            placeholder={kind === 'ANIME' ? 'Nome do anime…' : 'Nome do manga…'}
            className="input-base"
          />
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto px-2 pb-3">
          {loading && (
            <p className="py-6 text-center text-xs text-zinc-500">Buscando…</p>
          )}
          {error && (
            <p className="py-4 px-3 text-center text-xs text-red-400">{error}</p>
          )}
          {showEmpty && (
            <p className="py-6 text-center text-xs text-zinc-500">Nenhum resultado encontrado.</p>
          )}
          {results.map(r => (
            <button
              key={`${r.kind}-${r.id}`}
              type="button"
              onClick={() => onSelect(r)}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-zinc-800 active:scale-[0.98]"
            >
              {r.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={r.coverUrl}
                  alt=""
                  className="h-14 w-10 flex-shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-14 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-zinc-600">
                  <TvIcon className="h-5 w-5" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-100">{r.title}</p>
                <p className="truncate text-xs text-zinc-500">
                  {[r.year, r.score != null ? `${r.score}%` : null].filter(Boolean).join(' · ')}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 6l-12 12" /><path d="M6 6l12 12" />
    </svg>
  )
}

export function TvIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M3 7m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z" />
      <path d="M16 3l-4 4l-4 -4" />
    </svg>
  )
}
