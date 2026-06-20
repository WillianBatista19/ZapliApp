'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type MediaResult = {
  id:       string
  title:    string
  subtitle: string   // year for movies, author for books
  imageUrl: string | null
}

type Props = {
  type:     'movie' | 'book'
  onSelect: (result: MediaResult) => void
  onClose:  () => void
}

export default function MediaSearchModal({ type, onSelect, onClose }: Props) {
  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState<MediaResult[]>([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Cache: query string → results, max 10 entries (insertion-order eviction)
  const cacheRef = useRef<Map<string, MediaResult[]>>(new Map())

  useEffect(() => {
    inputRef.current?.focus()
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [onClose])

  const search = useCallback(async (q: string) => {
    const trimmed = q.trim()
    if (trimmed.length < 3) { setResults([]); return }

    setSearched(true)

    // Serve from cache if available
    const cacheKey = trimmed.toLowerCase()
    if (cacheRef.current.has(cacheKey)) {
      setResults(cacheRef.current.get(cacheKey)!)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      let mapped: MediaResult[]

      if (type === 'movie') {
        const key = process.env.NEXT_PUBLIC_TMDB_API_KEY
        const res  = await fetch(
          `https://api.themoviedb.org/3/search/movie?api_key=${key}&query=${encodeURIComponent(trimmed)}&language=pt-BR&page=1`
        )
        const json = await res.json()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mapped = (json.results ?? []).slice(0, 8).map((m: any) => ({
          id:       String(m.id),
          title:    String(m.title ?? ''),
          subtitle: m.release_date ? String(m.release_date).slice(0, 4) : '',
          imageUrl: m.poster_path ? `https://image.tmdb.org/t/p/w300${m.poster_path}` : null,
        }))
      } else {
        const res = await fetch(
          `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(trimmed)}&maxResults=8&key=${process.env.NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY}`
        )
        if (res.status === 429) {
          setError('Muitas buscas em pouco tempo. Aguarde alguns segundos e tente novamente.')
          return
        }
        if (!res.ok) {
          setError('Erro ao buscar livros. Tenta de novo!')
          return
        }
        const json = await res.json()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mapped = (json.items ?? []).map((item: any) => ({
          id:       item.id,
          title:    item.volumeInfo?.title ?? '',
          subtitle: (item.volumeInfo?.authors ?? []).join(', '),
          imageUrl: item.volumeInfo?.imageLinks?.thumbnail?.replace('http://', 'https://') ?? null,
        }))
      }

      // Store in cache, evict oldest when full
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
  }, [type])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(val), 500)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
  }

  const heading     = type === 'movie' ? 'Buscar filme ou série' : 'Buscar livro'
  const placeholder = type === 'movie' ? 'Nome do filme ou série…' : 'Título ou autor…'
  const showEmpty   = !loading && !error && searched && results.length === 0

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
          <h2 className="text-sm font-semibold text-zinc-100">{heading}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 transition-colors hover:text-zinc-200"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-4 pb-2">
          <input
            ref={inputRef}
            value={query}
            onChange={handleChange}
            placeholder={placeholder}
            className="input-base"
          />
        </form>

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
              key={r.id}
              type="button"
              onClick={() => onSelect(r)}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-zinc-800 active:scale-[0.98]"
            >
              {r.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={r.imageUrl}
                  alt=""
                  className="h-14 w-10 flex-shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-14 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-zinc-600">
                  {type === 'movie' ? <MovieIcon className="h-5 w-5" /> : <BookIcon className="h-5 w-5" />}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-100">{r.title}</p>
                {r.subtitle && <p className="truncate text-xs text-zinc-500">{r.subtitle}</p>}
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

export function MovieIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z" />
      <path d="M8 4l0 16" /><path d="M16 4l0 16" />
      <path d="M4 8l4 0" /><path d="M4 16l4 0" /><path d="M4 12l16 0" />
      <path d="M16 8l4 0" /><path d="M16 16l4 0" />
    </svg>
  )
}

export function BookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0" />
      <path d="M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0" />
      <path d="M3 6l0 13" /><path d="M12 6l0 13" /><path d="M21 6l0 13" />
    </svg>
  )
}
