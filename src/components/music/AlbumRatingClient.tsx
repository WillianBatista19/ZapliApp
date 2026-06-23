'use client'

import { useState, useEffect, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { saveAlbumRating, getUserAlbumRating } from '@/app/(app)/communities/musica/avaliar/actions'
import type { MarkerField } from '@/app/(app)/communities/musica/avaliar/actions'

const MARKERS: { field: MarkerField; emoji: string; label: string }[] = [
  { field: 'favorite_track_id',          emoji: '⭐', label: 'Música favorita' },
  { field: 'best_composition_track_id',  emoji: '✍️', label: 'Melhor composição' },
  { field: 'most_addictive_track_id',    emoji: '🔥', label: 'Mais viciante' },
  { field: 'best_vocal_track_id',        emoji: '🎤', label: 'Melhor vocal' },
  { field: 'best_instrumental_track_id', emoji: '🎸', label: 'Melhor instrumental' },
]

const EMPTY_MARKERS: Record<MarkerField, string | null> = {
  favorite_track_id: null,
  best_composition_track_id: null,
  most_addictive_track_id: null,
  best_vocal_track_id: null,
  best_instrumental_track_id: null,
}

interface SpotifyAlbumResult {
  id:           string
  name:         string
  artists:      { name: string }[]
  images:       { url: string }[]
  release_date: string
  total_tracks: number
}

interface SpotifyTrack {
  id:           string
  name:         string
  track_number: number
  disc_number:  number
  duration_ms:  number
}

interface SelectedAlbum {
  id:          string
  name:        string
  artist:      string
  coverUrl:    string | null
  year:        string
  totalTracks: number
  tracks:      SpotifyTrack[]
}

export interface RankedAlbum {
  album_id:     string
  album_name:   string
  artist_name:  string
  cover_url:    string | null
  avg_score:    number
  rating_count: number
}

export interface RecentRating {
  album_id:      string
  album_name:    string
  artist_name:   string
  cover_url:     string | null
  overall_score: number | null
  username:      string
  display_name:  string | null
}

interface Props {
  topAlbums:        RankedAlbum[]
  recentRatings:    RecentRating[]
  mostRated:        RankedAlbum[]
  userId:           string | null
  initialAlbumId?:    string
  initialAlbumName?:  string
  initialArtistName?: string
  initialCoverUrl?:   string
}

function fmt(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

export default function AlbumRatingClient({
  topAlbums, recentRatings, mostRated, userId,
  initialAlbumId, initialAlbumName, initialArtistName, initialCoverUrl,
}: Props) {
  const [query,         setQuery]         = useState('')
  const [searching,     setSearching]     = useState(false)
  const [results,       setResults]       = useState<SpotifyAlbumResult[]>([])
  const [selectedAlbum, setSelectedAlbum] = useState<SelectedAlbum | null>(null)
  const [loadingAlbum,  setLoadingAlbum]  = useState(false)
  const [scores,        setScores]        = useState<Record<string, string>>({})
  const [markers,       setMarkers]       = useState<Record<MarkerField, string | null>>(EMPTY_MARKERS)
  const [hasExisting,   setHasExisting]   = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [saveError,     setSaveError]     = useState<string | null>(null)
  const [savedAlbumId,  setSavedAlbumId]  = useState<string | null>(null)

  const avgScore = useMemo(() => {
    const vals = Object.values(scores)
      .map(Number)
      .filter(n => !isNaN(n) && n >= 0 && n <= 10)
    if (!vals.length) return null
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)
  }, [scores])

  // Debounced search
  useEffect(() => {
    if (query.length < 2) { setResults([]); setSearching(false); return }
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/spotify/albums?action=search&q=${encodeURIComponent(query)}`)
        const json = await res.json()
        setResults(json.albums?.items ?? [])
      } catch { setResults([]) }
      setSearching(false)
    }, 400)
    return () => clearTimeout(t)
  }, [query])

  async function selectAlbum(item: SpotifyAlbumResult) {
    setLoadingAlbum(true)
    setSelectedAlbum(null)
    setScores({})
    setMarkers(EMPTY_MARKERS)
    setHasExisting(false)
    setSaveError(null)
    setSavedAlbumId(null)

    try {
      const [tracksRes, existing] = await Promise.all([
        fetch(`/api/spotify/albums?action=album&id=${item.id}`).then(r => r.json()),
        userId ? getUserAlbumRating(item.id) : Promise.resolve(null),
      ])

      const tracks: SpotifyTrack[] = tracksRes.album?.tracks?.items ?? []

      setSelectedAlbum({
        id:          item.id,
        name:        item.name,
        artist:      item.artists.map((a: { name: string }) => a.name).join(', '),
        coverUrl:    item.images[0]?.url ?? null,
        year:        item.release_date?.slice(0, 4) ?? '',
        totalTracks: item.total_tracks,
        tracks,
      })

      if (existing) {
        setHasExisting(true)
        const scoreMap: Record<string, string> = {}
        for (const tr of existing.track_ratings ?? []) {
          if (tr.score != null) scoreMap[tr.track_id] = String(tr.score)
        }
        setScores(scoreMap)
        setMarkers({
          favorite_track_id:          existing.favorite_track_id          ?? null,
          best_composition_track_id:  existing.best_composition_track_id  ?? null,
          most_addictive_track_id:    existing.most_addictive_track_id    ?? null,
          best_vocal_track_id:        existing.best_vocal_track_id        ?? null,
          best_instrumental_track_id: existing.best_instrumental_track_id ?? null,
        })
      }
    } catch {
      setSaveError('Erro ao carregar álbum. Tenta novamente.')
    } finally {
      setLoadingAlbum(false)
    }
  }

  // Auto-select album from URL params (navigating from results page)
  useEffect(() => {
    if (!initialAlbumId || !initialAlbumName || !initialArtistName) return
    autoSelectAlbum({ albumId: initialAlbumId, albumName: initialAlbumName, artistName: initialArtistName, coverUrl: initialCoverUrl ?? null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function autoSelectAlbum(params: {
    albumId:    string
    albumName:  string
    artistName: string
    coverUrl:   string | null
  }) {
    setLoadingAlbum(true)
    setSelectedAlbum(null)
    setScores({})
    setMarkers(EMPTY_MARKERS)
    setHasExisting(false)
    setSaveError(null)
    setSavedAlbumId(null)

    try {
      const [tracksRes, existing] = await Promise.all([
        fetch(`/api/spotify/albums?action=album&id=${params.albumId}`).then(r => r.json()),
        userId ? getUserAlbumRating(params.albumId) : Promise.resolve(null),
      ])

      const tracks: SpotifyTrack[] = tracksRes.album?.tracks?.items ?? []

      setSelectedAlbum({
        id:          params.albumId,
        name:        params.albumName,
        artist:      params.artistName,
        coverUrl:    params.coverUrl,
        year:        tracksRes.album?.release_date?.slice(0, 4) ?? '',
        totalTracks: tracks.length,
        tracks,
      })

      if (existing) {
        setHasExisting(true)
        const scoreMap: Record<string, string> = {}
        for (const tr of existing.track_ratings ?? []) {
          if (tr.score != null) scoreMap[tr.track_id] = String(tr.score)
        }
        setScores(scoreMap)
        setMarkers({
          favorite_track_id:          existing.favorite_track_id          ?? null,
          best_composition_track_id:  existing.best_composition_track_id  ?? null,
          most_addictive_track_id:    existing.most_addictive_track_id    ?? null,
          best_vocal_track_id:        existing.best_vocal_track_id        ?? null,
          best_instrumental_track_id: existing.best_instrumental_track_id ?? null,
        })
      }
    } catch {
      setSaveError('Erro ao carregar álbum. Tenta novamente.')
    } finally {
      setLoadingAlbum(false)
    }
  }

  function toggleMarker(field: MarkerField, trackId: string) {
    setMarkers(prev => ({ ...prev, [field]: prev[field] === trackId ? null : trackId }))
  }

  async function handleSave() {
    if (!selectedAlbum || !userId) return
    setSaving(true)
    setSaveError(null)
    try {
      await saveAlbumRating({
        album_id:    selectedAlbum.id,
        album_name:  selectedAlbum.name,
        artist_name: selectedAlbum.artist,
        cover_url:   selectedAlbum.coverUrl,
        tracks:      selectedAlbum.tracks.map(t => ({
          track_id:     t.id,
          track_name:   t.name,
          track_number: t.track_number,
          score:        scores[t.id] !== undefined && scores[t.id] !== ''
            ? Number(scores[t.id])
            : null,
        })),
        markers,
      })
      setSavedAlbumId(selectedAlbum.id)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  function reset() {
    setSavedAlbumId(null)
    setSelectedAlbum(null)
    setQuery('')
  }

  // ── SUCCESS ──────────────────────────────────────────────────────────────
  if (savedAlbumId) {
    return (
      <div className="text-center py-12 space-y-4">
        <p className="text-4xl">🎵</p>
        <p className="text-xl font-bold text-white">
          {hasExisting ? 'Avaliação atualizada!' : 'Avaliação salva!'}
        </p>
        <div className="flex justify-center gap-3 flex-wrap">
          <Link
            href={`/communities/musica/avaliar/${savedAlbumId}`}
            className="rounded-xl bg-[#D4537E] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#c04370] transition-colors"
          >
            Ver resultados da comunidade
          </Link>
          <button
            onClick={reset}
            className="rounded-xl bg-white/10 px-5 py-2.5 text-sm text-zinc-300 hover:bg-white/20 transition-colors"
          >
            Avaliar outro álbum
          </button>
        </div>
      </div>
    )
  }

  // ── LOADING ──────────────────────────────────────────────────────────────
  if (loadingAlbum) {
    return <p className="text-center py-12 text-zinc-500 text-sm">Carregando álbum...</p>
  }

  // ── RATING FORM ──────────────────────────────────────────────────────────
  if (selectedAlbum) {
    return (
      <div className="space-y-5">
        <button
          onClick={() => setSelectedAlbum(null)}
          className="text-zinc-400 hover:text-white text-sm"
        >
          ← Voltar
        </button>

        {/* Album header */}
        <div className="flex items-start gap-4">
          {selectedAlbum.coverUrl ? (
            <Image
              src={selectedAlbum.coverUrl}
              alt={selectedAlbum.name}
              width={72} height={72}
              className="rounded-xl shrink-0 object-cover"
            />
          ) : (
            <div className="w-[72px] h-[72px] rounded-xl bg-[#7F77DD]/30 flex items-center justify-center text-3xl shrink-0">🎵</div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-white leading-tight">{selectedAlbum.name}</h2>
            <p className="text-sm text-zinc-400">{selectedAlbum.artist}</p>
            <p className="text-xs text-zinc-600 mt-0.5">{selectedAlbum.year} · {selectedAlbum.totalTracks} faixas</p>
          </div>
          {avgScore && (
            <div className="shrink-0 text-right">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Sua média</p>
              <p className="text-2xl font-bold text-[#D4537E]">{avgScore}</p>
            </div>
          )}
        </div>

        {hasExisting && (
          <p className="text-xs text-[#1D9E75] bg-[#1D9E75]/10 rounded-xl px-3 py-2">
            ✓ Editando avaliação existente
          </p>
        )}

        {/* Marker legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
          {MARKERS.map(m => (
            <span key={m.field}>{m.emoji} {m.label}</span>
          ))}
        </div>

        {/* Track list */}
        <div className="space-y-1.5">
          {selectedAlbum.tracks.map(track => (
            <div key={track.id} className="rounded-xl bg-white/5 px-3 pt-3 pb-2 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-600 w-5 shrink-0 text-right">{track.track_number}</span>
                <span className="flex-1 text-sm text-zinc-200 truncate">{track.name}</span>
                <span className="text-[11px] text-zinc-700 shrink-0">{fmt(track.duration_ms)}</span>
                <input
                  type="number"
                  min="0" max="10" step="0.5"
                  placeholder="—"
                  value={scores[track.id] ?? ''}
                  onChange={e => {
                    const raw = e.target.value
                    if (raw === '') { setScores(prev => ({ ...prev, [track.id]: '' })); return }
                    const num = parseFloat(raw)
                    if (isNaN(num)) return
                    const clamped = num > 10 ? '10' : num < 0 ? '0' : raw
                    setScores(prev => ({ ...prev, [track.id]: clamped }))
                  }}
                  className="w-16 rounded-lg bg-white/10 px-2 py-1 text-center text-sm text-white placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-[#D4537E] shrink-0"
                />
              </div>
              <div className="flex gap-1.5 pl-7">
                {MARKERS.map(m => (
                  <button
                    key={m.field}
                    type="button"
                    title={m.label}
                    onClick={() => toggleMarker(m.field, track.id)}
                    className={`rounded-md px-1.5 py-0.5 text-sm transition-colors ${
                      markers[m.field] === track.id
                        ? 'bg-[#D4537E]/20 text-[#D4537E]'
                        : 'text-zinc-700 hover:text-zinc-400'
                    }`}
                  >
                    {m.emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {saveError && <p className="text-sm text-red-400 text-center">{saveError}</p>}

        {!userId ? (
          <p className="text-center text-sm text-zinc-500">
            <Link href="/login" className="text-[#D4537E] underline">Entre</Link> para salvar sua avaliação
          </p>
        ) : (
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-xl bg-[#D4537E] py-3 text-sm font-semibold text-white hover:bg-[#c04370] disabled:opacity-50 transition-colors"
          >
            {saving ? 'Salvando...' : hasExisting ? 'Atualizar avaliação' : 'Salvar avaliação'}
          </button>
        )}
      </div>
    )
  }

  // ── SEARCH / HOME ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <input
        type="text"
        placeholder="🔍  Pesquise um álbum..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        className="w-full rounded-xl bg-white/10 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#D4537E]"
      />

      {/* Search results */}
      {query.length >= 2 && (
        <div className="space-y-2">
          {searching && <p className="text-xs text-zinc-500 text-center">Buscando...</p>}
          {!searching && results.length === 0 && (
            <p className="text-sm text-zinc-500 text-center py-4">Nenhum álbum encontrado</p>
          )}
          {results.map(item => (
            <button
              key={item.id}
              onClick={() => selectAlbum(item)}
              className="w-full flex items-center gap-3 rounded-xl bg-white/5 p-3 text-left hover:bg-white/10 transition-colors"
            >
              {item.images[0]?.url ? (
                <Image src={item.images[0].url} alt={item.name} width={48} height={48}
                  className="rounded-lg shrink-0 object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center text-xl shrink-0">🎵</div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white truncate">{item.name}</p>
                <p className="text-xs text-zinc-400">{item.artists.map((a: { name: string }) => a.name).join(', ')}</p>
                <p className="text-xs text-zinc-600">{item.release_date?.slice(0, 4)} · {item.total_tracks} faixas</p>
              </div>
              <span className="text-xs text-zinc-600 shrink-0">→</span>
            </button>
          ))}
        </div>
      )}

      {/* Rankings — shown when not typing */}
      {query.length < 2 && (
        <>
          {topAlbums.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
                🏆 Top Álbuns da Comunidade
              </h3>
              <div className="space-y-2">
                {topAlbums.map((album, i) => (
                  <Link
                    key={album.album_id}
                    href={`/communities/musica/avaliar/${album.album_id}`}
                    className="flex items-center gap-3 rounded-xl bg-white/5 p-3 hover:bg-white/10 transition-colors"
                  >
                    <span className="text-sm font-bold text-zinc-600 w-5 shrink-0 text-right">{i + 1}</span>
                    {album.cover_url ? (
                      <Image src={album.cover_url} alt={album.album_name} width={40} height={40}
                        className="rounded-lg shrink-0 object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-zinc-800 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white truncate">{album.album_name}</p>
                      <p className="text-xs text-zinc-400 truncate">{album.artist_name}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold text-[#D4537E]">{album.avg_score.toFixed(1)}</p>
                      <p className="text-xs text-zinc-600">{album.rating_count} aval.</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {recentRatings.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
                🕐 Avaliações Recentes
              </h3>
              <div className="space-y-2">
                {recentRatings.map((r, i) => (
                  <Link
                    key={i}
                    href={`/communities/musica/avaliar/${r.album_id}`}
                    className="flex items-center gap-3 rounded-xl bg-white/5 p-3 hover:bg-white/10 transition-colors"
                  >
                    {r.cover_url ? (
                      <Image src={r.cover_url} alt={r.album_name} width={40} height={40}
                        className="rounded-lg shrink-0 object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-zinc-800 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white truncate">{r.album_name}</p>
                      <p className="text-xs text-zinc-400">{r.display_name ?? r.username} · {r.artist_name}</p>
                    </div>
                    {r.overall_score != null && (
                      <span className="shrink-0 text-sm font-bold text-[#7F77DD]">{r.overall_score.toFixed(1)}</span>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {mostRated.length > 0 && topAlbums.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
                📊 Mais Avaliados
              </h3>
              <div className="space-y-2">
                {mostRated.map(album => (
                  <Link
                    key={album.album_id}
                    href={`/communities/musica/avaliar/${album.album_id}`}
                    className="flex items-center gap-3 rounded-xl bg-white/5 p-3 hover:bg-white/10 transition-colors"
                  >
                    {album.cover_url ? (
                      <Image src={album.cover_url} alt={album.album_name} width={40} height={40}
                        className="rounded-lg shrink-0 object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-zinc-800 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white truncate">{album.album_name}</p>
                      <p className="text-xs text-zinc-400">{album.artist_name}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold text-[#1D9E75]">{album.rating_count}</p>
                      <p className="text-xs text-zinc-600">avaliações</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {topAlbums.length === 0 && recentRatings.length === 0 && (
            <div className="text-center py-10">
              <p className="text-2xl mb-2">🎵</p>
              <p className="text-sm text-zinc-500">
                Nenhuma avaliação ainda. Seja a primeira a avaliar um álbum!
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
