'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import {
  createBatalhaEvent,
  finishBatalhaEvent,
  submitCategoryVote,
  submitTrackVotes,
} from '@/app/(app)/communities/musica/batalha/actions'
import type {
  BatalhaAlbum,
  BatalhaCategory,
  BatalhaCategoryVote,
  BatalhaEvent,
  BatalhaTrackVote,
} from '@/types'
import type { PastBatalhaEvent } from '@/app/(app)/communities/musica/batalha/page'

// ─── Local types ──────────────────────────────────────────────────────────────

interface SpotifyArtist {
  id:        string
  name:      string
  image:     string | null
  followers: number
  genres:    string[]
}

interface SpotifyAlbumOption {
  id:          string
  name:        string
  cover:       string | null
  year:        string | null
  totalTracks: number
}

interface SpotifyTrack {
  position: number
  name:     string
  id:       string
  duration: number
}

type AlbumTracksMap = Record<string, SpotifyTrack[]> // key: spotify album_id

type CreateStep = 1 | 2 | 3
type MainTab    = 'vote' | 'results'
type VoteSubTab = 'tracks' | 'categories'

interface Props {
  activeEvent:       BatalhaEvent | null
  albums:            BatalhaAlbum[]
  userTrackVotes:    BatalhaTrackVote[]
  userCategoryVotes: BatalhaCategoryVote[]
  allTrackVotes:     BatalhaTrackVote[]
  allCategoryVotes:  BatalhaCategoryVote[]
  pastEvents:        PastBatalhaEvent[]
  isOwner:           boolean
  currentUserId:     string | null
  communityId:       string
}

const RANK_POINTS: Record<number, number> = { 1: 10, 2: 7, 3: 5, 4: 3 }
const RANK_LABELS = ['1º', '2º', '3º', '4º']
const RANK_COLORS = [
  'bg-yellow-500 text-black',
  'bg-zinc-300 text-black',
  'bg-orange-600 text-white',
  'bg-zinc-600 text-white',
]

const CATEGORY_META: Record<BatalhaCategory, { label: string; icon: string }> = {
  favorite:         { label: 'Álbum favorito',      icon: '🏆' },
  best_cover:       { label: 'Melhor capa',          icon: '🎨' },
  best_composition: { label: 'Melhores composições', icon: '✍️' },
  best_production:  { label: 'Melhor produção',      icon: '🎚️' },
}

const ALL_CATEGORIES: BatalhaCategory[] = [
  'favorite', 'best_cover', 'best_composition', 'best_production',
]

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function formatCountdown(endsAt: string): string {
  const diff = new Date(endsAt).getTime() - Date.now()
  if (diff <= 0) return 'Encerrado'
  const d = Math.floor(diff / 86_400_000)
  const h = Math.floor((diff % 86_400_000) / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  const s = Math.floor((diff % 60_000) / 1_000)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m ${s}s`
  return `${m}m ${s}s`
}

// ─── Score helpers ────────────────────────────────────────────────────────────

function calcLiveScores(
  albums:          BatalhaAlbum[],
  allTrackVotes:   BatalhaTrackVote[],
  allCategoryVotes: BatalhaCategoryVote[],
): Record<string, number> {
  const minTracks = Math.min(...albums.map(a => a.total_tracks))
  const scores: Record<string, number> = {}
  for (const a of albums) scores[a.id] = 0

  for (const v of allTrackVotes) {
    if (v.track_position <= minTracks) {
      scores[v.album_id] = (scores[v.album_id] ?? 0) + (RANK_POINTS[v.rank] ?? 0)
    }
  }
  for (const cat of ALL_CATEGORIES) {
    const cvs = allCategoryVotes.filter(v => v.category === cat)
    if (!cvs.length) continue
    const tally: Record<string, number> = {}
    for (const v of cvs) tally[v.album_id] = (tally[v.album_id] ?? 0) + 1
    const winner = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0]
    if (winner) scores[winner] = (scores[winner] ?? 0) + 15
  }
  return scores
}

// ─── Countdown hook ───────────────────────────────────────────────────────────

function useCountdown(endsAt: string | undefined) {
  const [label, setLabel] = useState(endsAt ? formatCountdown(endsAt) : '')
  useEffect(() => {
    if (!endsAt) return
    const id = setInterval(() => setLabel(formatCountdown(endsAt)), 1000)
    return () => clearInterval(id)
  }, [endsAt])
  return label
}

// ─── Audio preview ────────────────────────────────────────────────────────────

function useAudioPreview() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying]  = useState<string | null>(null)
  const [loading, setLoading]  = useState<string | null>(null)
  const previewCache           = useRef<Record<string, string>>({})

  async function toggle(key: string, artist: string, trackName: string) {
    if (playing === key) {
      audioRef.current?.pause()
      setPlaying(null)
      return
    }
    audioRef.current?.pause()
    setLoading(key)

    let url = previewCache.current[key]
    if (!url) {
      try {
        const res  = await fetch(`/api/deezer?q=${encodeURIComponent(`${artist} ${trackName}`)}`)
        const json = await res.json() as { data?: Array<{ preview?: string }> }
        url = json.data?.[0]?.preview ?? ''
        if (url) previewCache.current[key] = url
      } catch { url = '' }
    }

    setLoading(null)
    if (!url) { alert('Preview não disponível para esta faixa.'); return }

    const audio = new Audio(url)
    audioRef.current = audio
    audio.play()
    setPlaying(key)
    audio.onended = () => setPlaying(null)
  }

  return { playing, loading, toggle }
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BatalhaClient({
  activeEvent,
  albums,
  userTrackVotes,
  userCategoryVotes,
  allTrackVotes,
  allCategoryVotes,
  pastEvents,
  isOwner,
  currentUserId,
  communityId,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError]            = useState<string | null>(null)
  const [toast, setToast]            = useState<string | null>(null)
  const countdown                    = useCountdown(activeEvent?.ends_at)
  const audio                        = useAudioPreview()

  // ── Create-flow state ──────────────────────────────────────────────────────
  const [creating, setCreating]           = useState(false)
  const [createStep, setCreateStep]       = useState<CreateStep>(1)
  const [artistQuery, setArtistQuery]     = useState('')
  const [artistResults, setArtistResults] = useState<SpotifyArtist[]>([])
  const [artistSearching, setArtistSearching] = useState(false)
  const [selectedArtist, setSelectedArtist]   = useState<SpotifyArtist | null>(null)
  const [artistAlbums, setArtistAlbums]       = useState<SpotifyAlbumOption[]>([])
  const [albumsLoading, setAlbumsLoading]     = useState(false)
  const [selectedAlbumIds, setSelectedAlbumIds] = useState<Set<string>>(new Set())
  const [duration, setDuration]               = useState<3 | 7 | 14>(7)
  const [confirming, setConfirming]           = useState(false)

  // ── Voting state ───────────────────────────────────────────────────────────
  const [mainTab, setMainTab]     = useState<MainTab>('vote')
  const [voteSubTab, setVoteSubTab] = useState<VoteSubTab>('tracks')
  const [currentPos, setCurrentPos] = useState(1)

  // positionRankings[position][albumDbId] = rank (1–4)
  const [posRankings, setPosRankings] = useState<Record<number, Record<string, number>>>(() => {
    const init: Record<number, Record<string, number>> = {}
    for (const v of userTrackVotes) {
      if (!init[v.track_position]) init[v.track_position] = {}
      init[v.track_position][v.album_id] = v.rank
    }
    return init
  })

  const [catVotes, setCatVotes] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const v of userCategoryVotes) init[v.category] = v.album_id
    return init
  })

  const [savingPos, setSavingPos] = useState<number | null>(null)

  // ── Spotify tracks ─────────────────────────────────────────────────────────
  const [albumTracks, setAlbumTracks] = useState<AlbumTracksMap>({})
  const [tracksLoading, setTracksLoading] = useState(false)

  useEffect(() => {
    if (!activeEvent || albums.length === 0) return
    setTracksLoading(true)
    Promise.all(
      albums.map(a =>
        fetch(`/api/spotify/artist?action=tracks&id=${a.album_id}`)
          .then(r => r.json() as Promise<{ tracks?: SpotifyTrack[] }>)
          .then(json => ({ albumId: a.album_id, tracks: json.tracks ?? [] })),
      ),
    ).then(results => {
      const map: AlbumTracksMap = {}
      for (const r of results) map[r.albumId] = r.tracks
      setAlbumTracks(map)
      setTracksLoading(false)
    }).catch(() => setTracksLoading(false))
  }, [activeEvent?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-finish notification ───────────────────────────────────────────────
  // (server already handles it; this only fires if client catches an edge case)
  useEffect(() => {
    if (!activeEvent) return
    if (new Date(activeEvent.ends_at) < new Date()) {
      finishBatalhaEvent(activeEvent.id)
    }
  }, [activeEvent]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers ────────────────────────────────────────────────────────────────
  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const minTracks = albums.length > 0 ? Math.min(...albums.map(a => a.total_tracks)) : 0
  const maxTracks = albums.length > 0 ? Math.max(...albums.map(a => a.total_tracks)) : 0
  const liveScores = activeEvent
    ? calcLiveScores(albums, allTrackVotes, allCategoryVotes)
    : {}

  const rankedAlbums = [...albums].sort(
    (a, b) => (liveScores[b.id] ?? 0) - (liveScores[a.id] ?? 0),
  )

  const totalParticipants = new Set(allTrackVotes.map(v => v.user_id)).size

  // Position fully ranked when all albums have a rank at that position
  function isPosRanked(pos: number) {
    const r = posRankings[pos] ?? {}
    return albums.length > 0 && Object.keys(r).length === albums.length
  }
  const rankedPositions = Array.from({ length: maxTracks }, (_, i) => i + 1).filter(isPosRanked).length

  // ── Rank assignment ────────────────────────────────────────────────────────
  function assignRank(pos: number, albumId: string, rank: number) {
    setPosRankings(prev => {
      const posMap = { ...(prev[pos] ?? {}) }

      // Remove this rank from any other album at this position
      for (const [aid, r] of Object.entries(posMap)) {
        if (r === rank && aid !== albumId) delete posMap[aid]
      }

      // Toggle off if same rank clicked again
      if (posMap[albumId] === rank) {
        delete posMap[albumId]
      } else {
        posMap[albumId] = rank
      }

      return { ...prev, [pos]: posMap }
    })
  }

  // Auto-save when a position is fully ranked
  useEffect(() => {
    if (!activeEvent || !currentUserId) return
    if (!isPosRanked(currentPos)) return

    const posMap = posRankings[currentPos]
    const votes = Object.entries(posMap).map(([albumId, rank]) => {
      const album = albums.find(a => a.id === albumId)!
      const trackName = albumTracks[album.album_id]?.find(t => t.position === currentPos)?.name ?? `Faixa ${currentPos}`
      return { albumId, trackPosition: currentPos, trackName, rank }
    })

    setSavingPos(currentPos)
    startTransition(async () => {
      await submitTrackVotes(activeEvent.id, votes)
      setSavingPos(null)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posRankings[currentPos]])

  // ── Artist search ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (artistQuery.length < 2) { setArtistResults([]); return }
    const t = setTimeout(async () => {
      setArtistSearching(true)
      try {
        const res  = await fetch(`/api/spotify/artist?action=search&q=${encodeURIComponent(artistQuery)}`)
        const json = await res.json() as { artists?: SpotifyArtist[] }
        setArtistResults(json.artists ?? [])
      } finally { setArtistSearching(false) }
    }, 400)
    return () => clearTimeout(t)
  }, [artistQuery])

  async function selectArtist(artist: SpotifyArtist) {
    setSelectedArtist(artist)
    setArtistResults([])
    setArtistQuery('')
    setCreateStep(2)
    setAlbumsLoading(true)
    try {
      const res  = await fetch(`/api/spotify/artist?action=albums&id=${artist.id}`)
      const json = await res.json() as { albums?: SpotifyAlbumOption[] }
      setArtistAlbums(json.albums ?? [])
    } finally { setAlbumsLoading(false) }
  }

  function toggleAlbumSelect(id: string) {
    setSelectedAlbumIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < 8) next.add(id)
      return next
    })
  }

  async function handleCreateEvent() {
    if (!selectedArtist) return
    const selected = artistAlbums.filter(a => selectedAlbumIds.has(a.id))
    if (selected.length < 2) return
    setConfirming(true)
    setError(null)

    const res = await createBatalhaEvent({
      communityId,
      artistName:  selectedArtist.name,
      artistId:    selectedArtist.id,
      albums:      selected.map(a => ({
        album_id:     a.id,
        album_name:   a.name,
        cover_url:    a.cover ?? '',
        release_year: a.year,
        total_tracks: a.totalTracks,
      })),
      durationDays: duration,
    })

    setConfirming(false)
    if (res.error) { setError(res.error); return }
    setCreating(false)
    setCreateStep(1)
    setSelectedArtist(null)
    setSelectedAlbumIds(new Set())
  }

  // ── Category vote ──────────────────────────────────────────────────────────
  function handleCategoryVote(cat: BatalhaCategory, albumId: string) {
    if (!activeEvent || !currentUserId) return
    setCatVotes(prev => ({ ...prev, [cat]: albumId }))
    startTransition(async () => {
      const res = await submitCategoryVote(activeEvent.id, cat, albumId)
      if (res.error) showToast(`Erro: ${res.error}`)
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: Create flow
  // ─────────────────────────────────────────────────────────────────────────
  if (creating) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Criar Batalha de Álbuns</h1>
          <button onClick={() => { setCreating(false); setCreateStep(1); setSelectedArtist(null); setSelectedAlbumIds(new Set()) }}
            className="text-sm text-zinc-400 hover:text-white"
          >
            ✕ Cancelar
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex gap-2">
          {([1,2,3] as CreateStep[]).map(s => (
            <div key={s} className={`flex-1 h-1 rounded-full transition-colors ${createStep >= s ? 'bg-[#D4537E]' : 'bg-zinc-800'}`} />
          ))}
        </div>

        {/* Step 1: Artist search */}
        {createStep === 1 && (
          <div className="space-y-4">
            <p className="text-zinc-400 text-sm">Passo 1 de 3 — Buscar artista</p>
            <input
              type="text"
              placeholder="Nome do artista…"
              value={artistQuery}
              onChange={e => setArtistQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-[#D4537E]"
            />
            {artistSearching && (
              <p className="text-zinc-500 text-sm text-center">Buscando…</p>
            )}
            <div className="space-y-2">
              {artistResults.map(a => (
                <button
                  key={a.id}
                  onClick={() => selectArtist(a)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-[#D4537E]/50 transition-colors text-left"
                >
                  {a.image
                    ? <Image src={a.image} alt={a.name} width={48} height={48} className="w-12 h-12 rounded-full object-cover shrink-0" />
                    : <div className="w-12 h-12 rounded-full bg-zinc-800 shrink-0 flex items-center justify-center text-xl">🎤</div>
                  }
                  <div className="min-w-0">
                    <p className="font-semibold text-white">{a.name}</p>
                    <p className="text-xs text-zinc-400">
                      {a.followers.toLocaleString('pt-BR')} seguidores
                      {a.genres.length > 0 && ` · ${a.genres.join(', ')}`}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Select albums */}
        {createStep === 2 && selectedArtist && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <button onClick={() => { setCreateStep(1); setArtistAlbums([]); setSelectedAlbumIds(new Set()) }}
                className="text-zinc-400 hover:text-white text-sm"
              >
                ← Voltar
              </button>
              <p className="text-zinc-400 text-sm flex-1">
                Passo 2 de 3 — Selecionar álbuns de <span className="text-white font-medium">{selectedArtist.name}</span>
              </p>
            </div>
            <p className="text-xs text-zinc-500">
              Selecione de 2 a 8 álbuns. Álbuns com menos faixas limitam as posições que contam para o ranking.
            </p>
            {albumsLoading && <p className="text-zinc-400 text-sm text-center py-6">Carregando álbuns…</p>}
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {artistAlbums.map(a => {
                const selected = selectedAlbumIds.has(a.id)
                const disabled = !selected && selectedAlbumIds.size >= 8
                return (
                  <button
                    key={a.id}
                    onClick={() => toggleAlbumSelect(a.id)}
                    disabled={disabled}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${
                      selected
                        ? 'bg-[#D4537E]/10 border-[#D4537E]'
                        : disabled
                        ? 'bg-zinc-900 border-zinc-800 opacity-40'
                        : 'bg-zinc-900 border-zinc-800 hover:border-zinc-600'
                    }`}
                  >
                    {a.cover
                      ? <Image src={a.cover} alt={a.name} width={48} height={48} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                      : <div className="w-12 h-12 rounded-lg bg-zinc-800 shrink-0 flex items-center justify-center text-xl">💿</div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">{a.name}</p>
                      <p className="text-xs text-zinc-400">{a.year} · {a.totalTracks} faixas</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${
                      selected ? 'border-[#D4537E] bg-[#D4537E]' : 'border-zinc-600'
                    }`}>
                      {selected && <span className="text-white text-xs">✓</span>}
                    </div>
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => setCreateStep(3)}
              disabled={selectedAlbumIds.size < 2}
              className="w-full py-3 rounded-xl font-semibold transition-colors bg-[#D4537E] text-white disabled:opacity-40"
            >
              Próximo → ({selectedAlbumIds.size} selecionados)
            </button>
          </div>
        )}

        {/* Step 3: Duration + confirm */}
        {createStep === 3 && selectedArtist && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <button onClick={() => setCreateStep(2)} className="text-zinc-400 hover:text-white text-sm">
                ← Voltar
              </button>
              <p className="text-zinc-400 text-sm">Passo 3 de 3 — Confirmar</p>
            </div>

            {/* Preview grid */}
            <div>
              <p className="text-sm text-zinc-400 mb-3">Álbuns na batalha</p>
              <div className="grid grid-cols-4 gap-2">
                {artistAlbums.filter(a => selectedAlbumIds.has(a.id)).map(a => (
                  <div key={a.id} className="text-center">
                    {a.cover
                      ? <Image src={a.cover} alt={a.name} width={80} height={80} className="w-full aspect-square rounded-lg object-cover" />
                      : <div className="w-full aspect-square rounded-lg bg-zinc-800 flex items-center justify-center text-2xl">💿</div>
                    }
                    <p className="text-xs text-zinc-400 mt-1 truncate">{a.name}</p>
                    <p className="text-xs text-zinc-600">{a.totalTracks} fx</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-zinc-500 mt-2">
                Posições que contam: 1 a {Math.min(...artistAlbums.filter(a => selectedAlbumIds.has(a.id)).map(a => a.totalTracks))} faixas
              </p>
            </div>

            {/* Duration */}
            <div>
              <p className="text-sm text-zinc-400 mb-3">Duração da votação</p>
              <div className="grid grid-cols-3 gap-2">
                {([3, 7, 14] as const).map(d => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    className={`py-3 rounded-xl font-semibold text-sm transition-colors ${
                      duration === d
                        ? 'bg-[#D4537E] text-white'
                        : 'bg-zinc-900 border border-zinc-700 text-zinc-300 hover:border-[#D4537E]/50'
                    }`}
                  >
                    {d} dias
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-red-400 text-sm text-center">{error}</p>}

            <button
              onClick={handleCreateEvent}
              disabled={confirming}
              className="w-full py-3 rounded-xl font-bold bg-[#D4537E] text-white disabled:opacity-60 transition-opacity"
            >
              {confirming ? 'Criando…' : '🎵 Criar Batalha'}
            </button>
          </div>
        )}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: Active event
  // ─────────────────────────────────────────────────────────────────────────
  if (activeEvent) {
    const positionCount = maxTracks
    const countsForRanking = currentPos <= minTracks

    const currentPosTrackNames: Record<string, string> = {}
    for (const a of albums) {
      const track = albumTracks[a.album_id]?.find(t => t.position === currentPos)
      currentPosTrackNames[a.id] = track?.name ?? `Faixa ${currentPos}`
    }

    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-[#D4537E] font-semibold uppercase tracking-wider mb-1">Batalha Ativa</p>
              <h1 className="text-xl font-bold text-white">{activeEvent.artist_name}</h1>
              <p className="text-sm text-zinc-400 mt-1">
                {albums.length} álbuns · {totalParticipants} participante{totalParticipants !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-zinc-500">Encerra em</p>
              <p className="text-lg font-mono font-bold text-[#1D9E75]">{countdown}</p>
            </div>
          </div>

          {/* Album covers strip */}
          <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
            {albums.map(a => (
              <div key={a.id} className="shrink-0 text-center">
                {a.cover_url
                  ? <Image src={a.cover_url} alt={a.album_name} width={48} height={48} className="w-12 h-12 rounded-lg object-cover" />
                  : <div className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center text-xl">💿</div>
                }
              </div>
            ))}
          </div>
        </div>

        {/* Main tabs */}
        <div className="flex gap-1 border-b border-zinc-800">
          {(['vote', 'results'] as MainTab[]).map(t => (
            <button
              key={t}
              onClick={() => setMainTab(t)}
              className={`px-4 py-2 text-sm font-medium transition ${
                mainTab === t
                  ? 'text-white border-b-2 border-[#D4537E]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {t === 'vote' ? '🗳️ Votar' : '📊 Resultados'}
            </button>
          ))}
        </div>

        {/* VOTE TAB */}
        {mainTab === 'vote' && (
          <div className="space-y-4">
            {!currentUserId && (
              <p className="text-center text-zinc-400 text-sm py-4">
                Faça login para votar.
              </p>
            )}

            {currentUserId && (
              <>
                {/* Vote sub-tabs */}
                <div className="flex gap-2">
                  {(['tracks', 'categories'] as VoteSubTab[]).map(t => (
                    <button
                      key={t}
                      onClick={() => setVoteSubTab(t)}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        voteSubTab === t
                          ? 'bg-[#7F77DD] text-white'
                          : 'bg-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {t === 'tracks' ? '🎵 Faixas' : '🏅 Categorias'}
                    </button>
                  ))}
                </div>

                {/* FAIXAS */}
                {voteSubTab === 'tracks' && (
                  <div className="space-y-4">
                    {tracksLoading && (
                      <p className="text-zinc-400 text-sm text-center py-6">Carregando faixas…</p>
                    )}

                    {!tracksLoading && (
                      <>
                        {/* Position navigation */}
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => setCurrentPos(p => Math.max(1, p - 1))}
                            disabled={currentPos === 1}
                            className="px-3 py-1.5 rounded-lg bg-zinc-800 text-sm disabled:opacity-40 hover:bg-zinc-700 transition"
                          >
                            ← Anterior
                          </button>

                          <div className="text-center">
                            <p className="font-semibold text-white">
                              Faixa {currentPos}
                              {!countsForRanking && (
                                <span className="ml-2 text-xs text-zinc-500 font-normal">(não conta)</span>
                              )}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {rankedPositions} de {positionCount} votadas
                            </p>
                          </div>

                          <button
                            onClick={() => setCurrentPos(p => Math.min(positionCount, p + 1))}
                            disabled={currentPos === positionCount}
                            className="px-3 py-1.5 rounded-lg bg-zinc-800 text-sm disabled:opacity-40 hover:bg-zinc-700 transition"
                          >
                            Próxima →
                          </button>
                        </div>

                        {/* Not-counts notice */}
                        {!countsForRanking && (
                          <div className="bg-zinc-800/50 rounded-xl p-3 text-center">
                            <p className="text-xs text-zinc-400">
                              Esta faixa está além da duração do álbum mais curto ({minTracks} faixas).
                              Os votos aparecem nas stats mas não somam pontos.
                            </p>
                          </div>
                        )}

                        {/* Albums at this position */}
                        <div className="space-y-3">
                          {albums.map(a => {
                            const myRank = posRankings[currentPos]?.[a.id]
                            const track  = albumTracks[a.album_id]?.find(t => t.position === currentPos)
                            const previewKey = `${a.id}-${currentPos}`

                            return (
                              <div
                                key={a.id}
                                className={`rounded-xl border p-3 transition-colors ${
                                  myRank
                                    ? 'bg-zinc-900 border-[#D4537E]/40'
                                    : 'bg-zinc-900 border-zinc-800'
                                }`}
                              >
                                <div className="flex items-center gap-3 mb-3">
                                  {a.cover_url
                                    ? <Image src={a.cover_url} alt={a.album_name} width={40} height={40} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                                    : <div className="w-10 h-10 rounded-lg bg-zinc-800 shrink-0 flex items-center justify-center">💿</div>
                                  }
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-zinc-400 truncate">{a.album_name}</p>
                                    {track ? (
                                      <p className="text-sm font-medium text-white truncate">{track.name}</p>
                                    ) : (
                                      <p className="text-sm text-zinc-600 italic">Faixa não existe neste álbum</p>
                                    )}
                                  </div>
                                  {track && (
                                    <button
                                      onClick={() => audio.toggle(previewKey, activeEvent.artist_name, track.name)}
                                      className="shrink-0 w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center hover:bg-[#D4537E]/20 transition text-sm"
                                      title="Preview"
                                    >
                                      {audio.loading === previewKey ? '⏳' : audio.playing === previewKey ? '⏹' : '▶'}
                                    </button>
                                  )}
                                </div>

                                {/* Rank buttons */}
                                {track && (
                                  <div className="flex gap-2">
                                    {RANK_LABELS.map((label, i) => {
                                      const rank = i + 1
                                      const active = myRank === rank
                                      return (
                                        <button
                                          key={rank}
                                          onClick={() => assignRank(currentPos, a.id, rank)}
                                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                            active
                                              ? RANK_COLORS[i]
                                              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                          }`}
                                        >
                                          {label}
                                        </button>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>

                        {/* Save indicator */}
                        {savingPos === currentPos && (
                          <p className="text-center text-xs text-zinc-500">Salvando…</p>
                        )}
                        {isPosRanked(currentPos) && savingPos !== currentPos && (
                          <p className="text-center text-xs text-[#1D9E75]">✓ Posição votada</p>
                        )}

                        {/* Quick position jump */}
                        <div className="flex flex-wrap gap-1 pt-2">
                          {Array.from({ length: positionCount }, (_, i) => i + 1).map(pos => (
                            <button
                              key={pos}
                              onClick={() => setCurrentPos(pos)}
                              className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                                pos === currentPos
                                  ? 'bg-[#D4537E] text-white'
                                  : isPosRanked(pos)
                                  ? 'bg-[#1D9E75]/20 text-[#1D9E75]'
                                  : pos > minTracks
                                  ? 'bg-zinc-900 text-zinc-600 border border-zinc-800'
                                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                              }`}
                            >
                              {pos}
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-zinc-600">
                          Verde = votado · Cinza escuro = não conta para ranking
                        </p>
                      </>
                    )}
                  </div>
                )}

                {/* CATEGORIAS */}
                {voteSubTab === 'categories' && (
                  <div className="space-y-4">
                    {ALL_CATEGORIES.map(cat => {
                      const meta = CATEGORY_META[cat]
                      const voted = catVotes[cat]
                      return (
                        <div key={cat} className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
                          <p className="font-semibold text-white mb-1">
                            {meta.icon} {meta.label}
                          </p>
                          <p className="text-xs text-zinc-500 mb-3">Vale 15 pontos ao álbum vencedor</p>
                          <div className="space-y-2">
                            {albums.map(a => {
                              const selected = voted === a.id
                              return (
                                <button
                                  key={a.id}
                                  onClick={() => handleCategoryVote(cat, a.id)}
                                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition-colors ${
                                    selected
                                      ? 'bg-[#D4537E]/10 border-[#D4537E]'
                                      : 'bg-zinc-800 border-zinc-700 hover:border-zinc-500'
                                  }`}
                                >
                                  {a.cover_url
                                    ? <Image src={a.cover_url} alt={a.album_name} width={36} height={36} className="w-9 h-9 rounded-lg object-cover shrink-0" />
                                    : <div className="w-9 h-9 rounded-lg bg-zinc-700 shrink-0" />
                                  }
                                  <span className="flex-1 text-sm font-medium text-left text-white">{a.album_name}</span>
                                  <span className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center text-xs ${
                                    selected ? 'border-[#D4537E] bg-[#D4537E] text-white' : 'border-zinc-500'
                                  }`}>
                                    {selected ? '✓' : ''}
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* RESULTS TAB */}
        {mainTab === 'results' && (
          <ResultsView
            albums={albums}
            allTrackVotes={allTrackVotes}
            allCategoryVotes={allCategoryVotes}
            liveScores={liveScores}
            rankedAlbums={rankedAlbums}
            minTracks={minTracks}
            maxTracks={maxTracks}
            totalParticipants={totalParticipants}
            artistName={activeEvent.artist_name}
            isFinished={false}
          />
        )}

        {/* Owner controls */}
        {isOwner && (
          <div className="border-t border-zinc-800 pt-4">
            <button
              onClick={() => {
                if (!confirm('Encerrar a batalha agora e calcular resultados finais?')) return
                startTransition(async () => { await finishBatalhaEvent(activeEvent.id) })
              }}
              disabled={isPending}
              className="w-full py-2 rounded-xl bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700 transition disabled:opacity-50"
            >
              🏁 Encerrar batalha agora
            </button>
          </div>
        )}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: No active event
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">⚔️ Batalha de Álbuns</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Compare álbuns do mesmo artista faixa a faixa e por categoria
          </p>
        </div>
        {isOwner && (
          <button
            onClick={() => { setCreating(true); setCreateStep(1) }}
            className="shrink-0 px-4 py-2 rounded-xl bg-[#D4537E] text-white text-sm font-semibold hover:bg-[#c04470] transition"
          >
            + Criar Batalha
          </button>
        )}
      </div>

      {pastEvents.length === 0 && (
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-8 text-center">
          <p className="text-4xl mb-3">⚔️</p>
          <p className="text-zinc-400">Nenhuma batalha ainda. {isOwner ? 'Crie a primeira!' : 'Aguarde o dono criar uma!'}</p>
        </div>
      )}

      {/* Past events */}
      {pastEvents.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Batalhas anteriores</h2>
          {pastEvents.map(evt => {
            const sorted = [...(evt.batalha_albums ?? [])].sort((a, b) => b.total_score - a.total_score)
            const winner = sorted[0]
            return (
              <div key={evt.id} className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-semibold text-white">{evt.artist_name}</p>
                    <p className="text-xs text-zinc-500">
                      {new Date(evt.created_at).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  {winner && (
                    <div className="text-right">
                      <p className="text-xs text-zinc-500">Vencedor</p>
                      <p className="text-sm font-bold text-yellow-400">🏆 {winner.album_name}</p>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 md:flex-row md:flex-wrap">
                  {sorted.map((a, i) => (
                    <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900 border border-zinc-800 md:flex-col md:text-center md:w-36">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                        i === 0 ? 'bg-yellow-500 text-black' :
                        i === 1 ? 'bg-zinc-400 text-black' :
                        i === 2 ? 'bg-amber-700 text-white' :
                        'bg-zinc-700 text-zinc-300'
                      } md:mx-auto`}>{i + 1}</div>
                      {a.cover_url
                        ? <Image src={a.cover_url} alt={a.album_name} width={148} height={148} className="w-14 h-14 md:w-full md:aspect-square rounded-lg object-cover flex-shrink-0" />
                        : <div className="w-14 h-14 md:w-full md:aspect-square rounded-lg bg-zinc-800 flex-shrink-0" />
                      }
                      <div className="flex-1 min-w-0 md:w-full">
                        <p className="text-sm font-semibold truncate">{a.album_name}</p>
                        <p className={`text-xs font-bold ${i === 0 ? 'text-yellow-400' : 'text-zinc-500'}`}>
                          {i + 1}º · {a.total_score ?? 0}pts
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 whitespace-nowrap rounded-xl bg-zinc-800 px-4 py-2 text-sm text-white shadow-xl">
          {toast}
        </div>
      )}
    </div>
  )
}

// ─── Results sub-component ────────────────────────────────────────────────────

interface ResultsViewProps {
  albums:           BatalhaAlbum[]
  allTrackVotes:    BatalhaTrackVote[]
  allCategoryVotes: BatalhaCategoryVote[]
  liveScores:       Record<string, number>
  rankedAlbums:     BatalhaAlbum[]
  minTracks:        number
  maxTracks:        number
  totalParticipants: number
  artistName:       string
  isFinished:       boolean
}

function ResultsView({
  albums,
  allTrackVotes,
  allCategoryVotes,
  liveScores,
  rankedAlbums,
  minTracks,
  maxTracks,
  totalParticipants,
  artistName,
  isFinished,
}: ResultsViewProps) {
  const [expandedPos, setExpandedPos] = useState<number | null>(null)
  const [showFullRanking, setShowFullRanking] = useState(false)

  // Track breakdown per position
  function trackRankingAt(pos: number) {
    const votes = allTrackVotes.filter(v => v.track_position === pos)
    const RANK_POINTS_MAP: Record<number, number> = { 1: 10, 2: 7, 3: 5, 4: 3 }
    const albumPoints: Record<string, number> = {}
    const albumVoteCount: Record<string, number> = {}
    for (const v of votes) {
      albumPoints[v.album_id]    = (albumPoints[v.album_id] ?? 0) + (RANK_POINTS_MAP[v.rank] ?? 0)
      albumVoteCount[v.album_id] = (albumVoteCount[v.album_id] ?? 0) + 1
    }
    return albums
      .map(a => ({ album: a, points: albumPoints[a.id] ?? 0, votes: albumVoteCount[a.id] ?? 0 }))
      .sort((a, b) => b.points - a.points)
  }

  // Category results
  function categoryResult(cat: BatalhaCategory) {
    const cv = allCategoryVotes.filter(v => v.category === cat)
    const tally: Record<string, number> = {}
    for (const v of cv) tally[v.album_id] = (tally[v.album_id] ?? 0) + 1
    const total = cv.length
    return albums
      .map(a => ({ album: a, votes: tally[a.id] ?? 0, pct: total > 0 ? Math.round(((tally[a.id] ?? 0) / total) * 100) : 0 }))
      .sort((a, b) => b.votes - a.votes)
  }

  // Most controversial position (most even distribution)
  const controversialPos = (() => {
    if (!allTrackVotes.length) return null
    let bestPos = 1
    let bestSpread = Infinity
    for (let p = 1; p <= minTracks; p++) {
      const pvotes = allTrackVotes.filter(v => v.track_position === p)
      if (!pvotes.length) continue
      const tally: Record<string, number> = {}
      for (const v of pvotes) tally[v.album_id] = (tally[v.album_id] ?? 0) + 1
      const counts = Object.values(tally)
      const avg = counts.reduce((s, c) => s + c, 0) / counts.length
      const spread = Math.max(...counts) - avg
      if (spread < bestSpread) { bestSpread = spread; bestPos = p }
    }
    return bestPos
  })()

  return (
    <div className="space-y-6">
      {/* Winner highlight - always visible */}
      <div className="flex items-center gap-3 p-4 rounded-xl bg-zinc-900 border border-yellow-500/30 mb-2">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 bg-yellow-500 text-black">1</div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={rankedAlbums[0]?.cover_url ?? ''} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-yellow-400 font-semibold">🏆 Vencedor</p>
          <p className="font-bold truncate">{rankedAlbums[0]?.album_name}</p>
          <p className="text-xs text-zinc-400">{artistName}</p>
        </div>
        <span className="text-sm font-bold text-yellow-400 flex-shrink-0">{rankedAlbums[0]?.total_score ?? liveScores[rankedAlbums[0]?.id] ?? 0}pts</span>
      </div>

      {/* Other albums - hidden on mobile behind button */}
      <div className="hidden md:flex flex-col gap-2">
        {rankedAlbums.slice(1).map((album, i) => (
          <div key={album.id} className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900 border border-zinc-800">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${i === 0 ? 'bg-zinc-400 text-black' : i === 1 ? 'bg-amber-700 text-white' : 'bg-zinc-700 text-zinc-300'}`}>{i + 2}</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={album.cover_url ?? ''} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate text-sm">{album.album_name}</p>
              <p className="text-xs text-zinc-400">{artistName}</p>
            </div>
            <span className="text-sm font-bold text-[#D4537E] flex-shrink-0">{album.total_score ?? liveScores[album.id] ?? 0}pts</span>
          </div>
        ))}
      </div>

      {/* Mobile: expandable ranking */}
      <div className="md:hidden">
        <button
          onClick={() => setShowFullRanking(!showFullRanking)}
          className="w-full text-sm text-zinc-400 py-2 text-center hover:text-white transition-colors"
        >
          {showFullRanking ? '▲ Ocultar ranking' : `▼ Ver ranking completo (${rankedAlbums.length - 1} álbuns)`}
        </button>
        {showFullRanking && (
          <div className="flex flex-col gap-2 mt-2">
            {rankedAlbums.slice(1).map((album, i) => (
              <div key={album.id} className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i === 0 ? 'bg-zinc-400 text-black' : i === 1 ? 'bg-amber-700 text-white' : 'bg-zinc-700 text-zinc-300'}`}>{i + 2}</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={album.cover_url ?? ''} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate text-sm">{album.album_name}</p>
                </div>
                <span className="text-xs font-bold text-[#D4537E] flex-shrink-0">{album.total_score ?? liveScores[album.id] ?? 0}pts</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Track-by-track accordion */}
      {totalParticipants > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Faixa por faixa</h2>
          {Array.from({ length: maxTracks }, (_, i) => i + 1).map(pos => {
            const ranking   = trackRankingAt(pos)
            const expanded  = expandedPos === pos
            const counts    = ranking.filter(r => r.votes > 0)
            const countsFor = pos <= minTracks

            return (
              <div key={pos} className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden">
                <button
                  onClick={() => setExpandedPos(expanded ? null : pos)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-zinc-800/50 transition"
                >
                  <span className="font-medium text-white text-sm">
                    Faixa {pos}
                    {!countsFor && <span className="ml-2 text-xs text-zinc-600">(não conta)</span>}
                  </span>
                  <div className="flex items-center gap-3">
                    {counts.length > 0 && (
                      <span className="text-xs text-zinc-400">
                        {counts.reduce((s, r) => s + r.votes, 0)} votos
                      </span>
                    )}
                    <span className="text-zinc-500 text-xs">{expanded ? '▲' : '▼'}</span>
                  </div>
                </button>
                {expanded && (
                  <div className="px-4 pb-4 space-y-2 border-t border-zinc-800 pt-3">
                    {ranking.map((r, i) => (
                      <div key={r.album.id} className="flex items-center gap-2">
                        <span className={`text-xs font-bold w-4 shrink-0 ${
                          i === 0 ? 'text-yellow-400' : 'text-zinc-500'
                        }`}>{i + 1}</span>
                        {r.album.cover_url
                          ? <Image src={r.album.cover_url} alt={r.album.album_name} width={28} height={28} className="w-7 h-7 rounded object-cover shrink-0" />
                          : <div className="w-7 h-7 rounded bg-zinc-800 shrink-0" />
                        }
                        <span className="flex-1 text-xs text-zinc-300 truncate">{r.album.album_name}</span>
                        <span className="text-xs text-zinc-400">{r.votes}v · {r.points}pts</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Category results */}
      {allCategoryVotes.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Categorias especiais</h2>
          {ALL_CATEGORIES.map(cat => {
            const meta   = CATEGORY_META[cat]
            const result = categoryResult(cat)
            const total  = allCategoryVotes.filter(v => v.category === cat).length
            return (
              <div key={cat} className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
                <p className="font-semibold text-white mb-3">{meta.icon} {meta.label}</p>
                <div className="space-y-2">
                  {result.map((r, i) => (
                    <div key={r.album.id} className="flex items-center gap-2">
                      {r.album.cover_url
                        ? <Image src={r.album.cover_url} alt={r.album.album_name} width={28} height={28} className="w-7 h-7 rounded object-cover shrink-0" />
                        : <div className="w-7 h-7 rounded bg-zinc-800 shrink-0" />
                      }
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs text-zinc-300 truncate">{r.album.album_name}</span>
                          <span className="text-xs text-zinc-400 shrink-0 ml-2">{r.pct}%</span>
                        </div>
                        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${i === 0 ? 'bg-[#7F77DD]' : 'bg-zinc-600'}`}
                            style={{ width: `${r.pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-zinc-600 mt-2">{total} votos</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Statistics */}
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 space-y-2">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Estatísticas</h2>
        <p className="text-sm text-zinc-300">
          👥 <span className="text-white font-medium">{totalParticipants}</span> participante{totalParticipants !== 1 ? 's' : ''}
        </p>
        <p className="text-sm text-zinc-300">
          🗳️ <span className="text-white font-medium">{allTrackVotes.length}</span> votos em faixas
        </p>
        <p className="text-sm text-zinc-300">
          🏅 <span className="text-white font-medium">{allCategoryVotes.length}</span> votos em categorias
        </p>
        {controversialPos && (
          <p className="text-sm text-zinc-300">
            🔥 Posição mais disputada: <span className="text-white font-medium">Faixa {controversialPos}</span>
          </p>
        )}
      </div>
    </div>
  )
}
