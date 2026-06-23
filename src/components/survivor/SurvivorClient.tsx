'use client'

import { useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { castVote, advanceRound, createSurvivorEvent } from '@/app/(app)/communities/musica/survivor/actions'
import type { SurvivorEvent, SurvivorTrack } from '@/types'
import type { VoteWithProfile, PastEventSummary } from '@/app/(app)/communities/musica/survivor/page'

interface SpotifyAlbum {
  id:          string
  name:        string
  artist:      string
  cover:       string | null
  year:        string | null
  totalTracks: number
}

interface TrackInput {
  track_id:     string
  track_name:   string
  track_number: number
  preview_url:  string | null
}

interface Props {
  activeEvent:    SurvivorEvent | null
  tracks:         SurvivorTrack[]
  currentVotes:   VoteWithProfile[]
  userVoteId:     string | null
  finishedEvent:  SurvivorEvent | null
  finishedTracks: SurvivorTrack[]
  pastEvents:     PastEventSummary[]
  isOwner:        boolean
  currentUserId:  string | null
  communityId:    string
}

// ─── small helpers ───────────────────────────────────────────────────────────

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function Avatar({ src, name, size = 24 }: { src: string | null; name: string; size?: number }) {
  if (src) return (
    <Image src={src} alt={name} width={size} height={size}
      className="rounded-full object-cover shrink-0 ring-1 ring-zinc-700"
      style={{ width: size, height: size }}
    />
  )
  return (
    <div
      className="rounded-full bg-[#7F77DD]/40 flex items-center justify-center text-xs shrink-0 ring-1 ring-zinc-700"
      style={{ width: size, height: size }}
    >
      {name[0]?.toUpperCase()}
    </div>
  )
}

async function fetchDeezerPreview(trackName: string, artistName: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/deezer?q=${encodeURIComponent(`${trackName} ${artistName}`)}`)
    const data = await res.json()
    return (data.data as { preview?: string }[])?.[0]?.preview ?? null
  } catch {
    return null
  }
}

// ─── Create Event Modal ───────────────────────────────────────────────────────

function CreateEventModal({
  communityId,
  onClose,
  onCreated,
}: {
  communityId: string
  onClose: () => void
  onCreated: () => void
}) {
  const [query, setQuery]               = useState('')
  const [results, setResults]           = useState<SpotifyAlbum[]>([])
  const [selected, setSelected]         = useState<SpotifyAlbum | null>(null)
  const [albumTracks, setAlbumTracks]   = useState<TrackInput[]>([])
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [loadingPrev, setLoadingPrev]   = useState(false)
  const [submitting, setSubmitting]     = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [playingId, setPlayingId]       = useState<string | null>(null)
  const audioRef                        = useRef<HTMLAudioElement | null>(null)

  async function search(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setLoadingSearch(true)
    setResults([])
    setSelected(null)
    setAlbumTracks([])
    try {
      const res = await fetch(`/api/spotify/albums?action=search&q=${encodeURIComponent(query)}`)
      const data = await res.json()
      console.log('[Survivor] album search response:', data)
      setResults(data.albums ?? [])
    } finally {
      setLoadingSearch(false)
    }
  }

  async function selectAlbum(album: SpotifyAlbum) {
    setSelected(album)
    setResults([])
    setAlbumTracks([])
    setLoadingPrev(true)
    try {
      const res  = await fetch(`/api/spotify/albums?action=album&id=${album.id}`)
      const data = await res.json()
      // API returns { album: { ...details, tracks: { items: [...] } } }
      const raw: { id: string; name: string; track_number: number }[] =
        data.album?.tracks?.items ?? []

      console.log('[Survivor] album fetch →', data)
      console.log('[Survivor] raw tracks:', raw.length, '| submitting:', submitting, '| loadingPrev: true→false')

      // Set tracks immediately so the confirm button enables right away
      const initial: TrackInput[] = raw.map(t => ({
        track_id:     t.id,
        track_name:   t.name,
        track_number: t.track_number,
        preview_url:  null,
      }))
      setAlbumTracks(initial)
      setLoadingPrev(false)

      // Fetch Deezer previews in the background — non-blocking
      const artistName = album.artist
      Promise.all(
        initial.map((t, idx) =>
          fetchDeezerPreview(t.track_name, artistName).then(preview => ({ idx, preview })),
        ),
      ).then(results => {
        setAlbumTracks(prev => {
          const next = [...prev]
          for (const { idx, preview } of results) {
            if (preview) next[idx] = { ...next[idx], preview_url: preview }
          }
          return next
        })
      }).catch(() => { /* previews are optional */ })
    } catch (err) {
      console.error('[Survivor] album fetch error:', err)
      setLoadingPrev(false)
    }
  }

  function togglePreview(track: TrackInput) {
    if (!track.preview_url) return
    if (playingId === track.track_id) {
      audioRef.current?.pause()
      setPlayingId(null)
      return
    }
    audioRef.current?.pause()
    const audio = new Audio(track.preview_url)
    audio.play()
    audio.onended = () => setPlayingId(null)
    audioRef.current = audio
    setPlayingId(track.track_id)
  }

  async function handleConfirm() {
    if (!selected || albumTracks.length === 0) return
    setSubmitting(true)
    setError(null)
    try {
      await createSurvivorEvent({
        communityId,
        albumId:     selected.id,
        albumName:   selected.name,
        artistName:  selected.artist,
        coverUrl:    selected.cover,
        tracks:      albumTracks,
      })
      audioRef.current?.pause()
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-md rounded-xl bg-zinc-900 border border-white/10 p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-white">Criar novo Survivor</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-xl leading-none">×</button>
        </div>

        {!selected ? (
          <>
            <form onSubmit={search} className="flex gap-2">
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar álbum..."
                className="flex-1 rounded-xl bg-white/10 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:ring-1 focus:ring-[#D4537E]"
              />
              <button
                type="submit"
                disabled={loadingSearch}
                className="rounded-xl bg-[#D4537E] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {loadingSearch ? '...' : 'Buscar'}
              </button>
            </form>

            {results.length > 0 && (
              <div className="space-y-2">
                {results.map(a => (
                  <button
                    key={a.id}
                    onClick={() => selectAlbum(a)}
                    className="w-full flex items-center gap-3 rounded-xl bg-white/5 hover:bg-white/10 p-3 text-left transition-colors"
                  >
                    {a.cover && (
                      <Image src={a.cover} alt={a.name} width={48} height={48}
                        className="rounded-lg shrink-0 object-cover"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{a.name}</p>
                      <p className="text-xs text-zinc-400 truncate">{a.artist} · {a.totalTracks} faixas</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <button
              onClick={() => { setSelected(null); setAlbumTracks([]) }}
              className="text-sm text-zinc-400 hover:text-white"
            >
              ← Voltar
            </button>

            <div className="flex items-center gap-3">
              {selected.cover && (
                <Image src={selected.cover} alt={selected.name} width={64} height={64}
                  className="rounded-xl object-cover shrink-0"
                />
              )}
              <div>
                <p className="font-semibold text-white">{selected.name}</p>
                <p className="text-sm text-zinc-400">{selected.artist}</p>
              </div>
            </div>

            {loadingPrev ? (
              <p className="text-sm text-zinc-400 text-center py-4">Carregando faixas...</p>
            ) : (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {albumTracks.map(t => (
                  <div key={t.track_id} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
                    <span className="text-xs text-zinc-500 w-5 shrink-0 text-right">{t.track_number}</span>
                    <span className="flex-1 text-sm text-white truncate">{t.track_name}</span>
                    {t.preview_url && (
                      <button
                        onClick={() => togglePreview(t)}
                        className="shrink-0 text-[#1D9E75] hover:text-[#1D9E75]/80"
                        aria-label={playingId === t.track_id ? 'Pausar' : 'Ouvir'}
                      >
                        {playingId === t.track_id ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button onClick={onClose} className="flex-1 rounded-xl bg-white/10 py-2 text-sm text-zinc-300 hover:text-white">
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={submitting || loadingPrev}
                className="flex-1 rounded-xl bg-[#D4537E] py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {submitting ? 'Criando...' : 'Criar Survivor'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Advance Round Modal ──────────────────────────────────────────────────────

function AdvanceModal({
  nextRound,
  mostVotedTrack,
  onConfirm,
  onCancel,
  loading,
}: {
  nextRound: number
  mostVotedTrack: string
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-sm rounded-xl bg-zinc-900 border border-white/10 p-5 space-y-4">
        <h2 className="font-bold text-white text-center">Avançar para Rodada {nextRound}?</h2>
        <p className="text-sm text-zinc-400 text-center">
          A faixa mais votada será eliminada:<br />
          <span className="text-white font-semibold">{mostVotedTrack}</span>
        </p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-xl bg-white/10 py-2 text-sm text-zinc-300 hover:text-white">
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 rounded-xl bg-[#D4537E] py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? 'Avançando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Finished Results ─────────────────────────────────────────────────────────

function FinishedResults({ event, tracks }: { event: SurvivorEvent; tracks: SurvivorTrack[] }) {
  const winner = tracks.find(t => t.final_position === 1)
  const ordered = [...tracks].sort((a, b) => (a.final_position ?? 999) - (b.final_position ?? 999))

  function shareWinner() {
    if (!winner) return
    const text = `A música campeã de ${event.album_name} nas Incelicas é ${winner.track_name}! 🏆`
    if (navigator.share) {
      navigator.share({ text })
    } else {
      navigator.clipboard.writeText(text)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 rounded-xl bg-white/5 p-4">
        {event.cover_url && (
          <Image src={event.cover_url} alt={event.album_name} width={72} height={72}
            className="rounded-xl object-cover shrink-0"
          />
        )}
        <div className="min-w-0">
          <p className="text-xs text-[#D4537E] font-semibold uppercase tracking-wider">Resultado Final</p>
          <p className="font-bold text-white text-lg truncate">{event.album_name}</p>
          <p className="text-sm text-zinc-400 truncate">{event.artist_name}</p>
        </div>
      </div>

      {winner && (
        <div className="flex items-center gap-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 p-4">
          <span className="text-3xl">🏆</span>
          <div className="min-w-0">
            <p className="text-xs text-yellow-400 font-semibold uppercase tracking-wider">Campeã</p>
            <p className="font-bold text-white text-lg truncate">{winner.track_name}</p>
          </div>
          <button
            onClick={shareWinner}
            className="ml-auto shrink-0 rounded-xl bg-white/10 px-3 py-2 text-xs text-zinc-300 hover:text-white"
          >
            Compartilhar
          </button>
        </div>
      )}

      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 px-1">Ranking final</p>
        {ordered.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${t.final_position === 1 ? 'bg-yellow-500/10' : 'bg-white/5'}`}
          >
            <span className={`w-6 text-center text-sm font-bold shrink-0 ${t.final_position === 1 ? 'text-yellow-400' : 'text-zinc-500'}`}>
              {t.final_position === 1 ? '🏆' : `#${t.final_position}`}
            </span>
            <span className={`flex-1 text-sm truncate ${t.final_position === 1 ? 'text-white font-semibold' : 'text-zinc-300'}`}>
              {t.track_name}
            </span>
            {t.eliminated_at_round && (
              <span className="text-xs text-zinc-600 shrink-0">elim. R{t.eliminated_at_round}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Voting Track Card ────────────────────────────────────────────────────────

function TrackCard({
  track,
  voteCount,
  totalVotes,
  voterProfiles,
  isUserVote,
  hasVoted,
  onVote,
  onPreview,
  isPlaying,
  votingId,
}: {
  track:         SurvivorTrack
  voteCount:     number
  totalVotes:    number
  voterProfiles: VoteWithProfile['profiles'][]
  isUserVote:    boolean
  hasVoted:      boolean
  onVote:        () => void
  onPreview:     () => void
  isPlaying:     boolean
  votingId:      string | null
}) {
  const pct = totalVotes > 0 ? Math.round(voteCount / totalVotes * 100) : 0
  const isVotingThis = votingId === track.id

  return (
    <div className={`rounded-xl border p-3 space-y-2 transition-colors ${
      isUserVote ? 'bg-[#D4537E]/10 border-[#D4537E]/40' : 'bg-white/5 border-white/5'
    }`}>
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500 w-5 text-right shrink-0">{track.track_number}</span>
        <span className="flex-1 text-sm text-white font-medium truncate">{track.track_name}</span>

        {track.preview_url && (
          <button
            onClick={onPreview}
            className="shrink-0 text-[#1D9E75] hover:text-[#1D9E75]/80 p-1"
            aria-label={isPlaying ? 'Pausar' : 'Ouvir trecho'}
          >
            {isPlaying ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
          </button>
        )}

        <button
          onClick={onVote}
          disabled={isVotingThis}
          className={`shrink-0 rounded-lg px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-60 ${
            isUserVote
              ? 'bg-[#D4537E]/30 text-[#D4537E] ring-1 ring-[#D4537E]'
              : 'bg-white/10 text-zinc-300 hover:bg-[#D4537E]/20 hover:text-[#D4537E]'
          }`}
        >
          {isVotingThis ? '...' : isUserVote ? 'Votou ✓' : 'Eliminar'}
        </button>
      </div>

      {hasVoted && (
        <>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${isUserVote ? 'bg-[#D4537E]' : 'bg-zinc-600'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-zinc-500 shrink-0 w-14 text-right">
              {voteCount} voto{voteCount !== 1 ? 's' : ''} · {pct}%
            </span>
          </div>

          {voterProfiles.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {voterProfiles.slice(0, 8).map((p, i) => (
                <Avatar
                  key={i}
                  src={p?.avatar_url ?? null}
                  name={p?.display_name ?? p?.username ?? '?'}
                  size={20}
                />
              ))}
              {voterProfiles.length > 8 && (
                <span className="text-xs text-zinc-500">+{voterProfiles.length - 8}</span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Event History ────────────────────────────────────────────────────────────

function EventHistory({ pastEvents }: { pastEvents: PastEventSummary[] }) {
  if (pastEvents.length === 0) return null
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Histórico de Survivors</p>
      <div className="space-y-2">
        {pastEvents.map(e => (
          <div key={e.id} className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
            {e.cover_url
              ? <Image src={e.cover_url} alt={e.album_name} width={44} height={44} className="rounded-lg object-cover shrink-0" />
              : <div className="w-11 h-11 rounded-lg bg-zinc-800 shrink-0" />
            }
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate">{e.album_name}</p>
              <p className="text-xs text-zinc-400 truncate">{e.artist_name}</p>
              {e.winner_track && (
                <p className="text-xs text-yellow-400 mt-0.5 truncate">🏆 {e.winner_track}</p>
              )}
            </div>
            <span className="text-xs text-zinc-600 shrink-0">{fmt(e.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SurvivorClient({
  activeEvent, tracks, currentVotes, userVoteId,
  finishedEvent, finishedTracks,
  pastEvents, isOwner, currentUserId, communityId,
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [votingId, setVotingId]         = useState<string | null>(null)
  const [showAdvance, setShowAdvance]   = useState(false)
  const [advancing, setAdvancing]       = useState(false)
  const [showCreate, setShowCreate]     = useState(false)
  const [toast, setToast]               = useState<string | null>(null)
  const [playingId, setPlayingId]       = useState<string | null>(null)
  const audioRef                        = useRef<HTMLAudioElement | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  function togglePreview(track: SurvivorTrack) {
    if (!track.preview_url) return
    if (playingId === track.id) {
      audioRef.current?.pause()
      setPlayingId(null)
      return
    }
    audioRef.current?.pause()
    const audio = new Audio(track.preview_url)
    audio.play()
    audio.onended = () => setPlayingId(null)
    audioRef.current = audio
    setPlayingId(track.id)
  }

  async function handleVote(trackId: string) {
    if (!activeEvent) return
    setVotingId(trackId)
    try {
      await castVote(activeEvent.id, trackId, activeEvent.current_round)
      startTransition(() => router.refresh())
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao votar')
    } finally {
      setVotingId(null)
    }
  }

  async function handleAdvance() {
    if (!activeEvent) return
    setAdvancing(true)
    try {
      await advanceRound(activeEvent.id)
      setShowAdvance(false)
      startTransition(() => router.refresh())
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao avançar rodada')
    } finally {
      setAdvancing(false)
    }
  }

  const survivingTracks  = tracks.filter(t => t.eliminated_at_round === null)
  const eliminatedTracks = tracks.filter(t => t.eliminated_at_round !== null)
    .sort((a, b) => (b.eliminated_at_round ?? 0) - (a.eliminated_at_round ?? 0))

  const hasVoted    = currentVotes.some(v => v.user_id === currentUserId)
  const totalVotes  = currentVotes.length

  // Most voted track (for advance confirmation message)
  const tally = new Map<string, number>()
  for (const v of currentVotes) tally.set(v.track_id, (tally.get(v.track_id) ?? 0) + 1)
  let mostVotedTrackId = survivingTracks[0]?.id ?? ''
  let maxVotes = tally.get(mostVotedTrackId) ?? 0
  for (const t of survivingTracks) {
    const c = tally.get(t.id) ?? 0
    if (c > maxVotes) { maxVotes = c; mostVotedTrackId = t.id }
  }
  const mostVotedTrackName = survivingTracks.find(t => t.id === mostVotedTrackId)?.track_name ?? ''

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-xl font-bold text-white">🎵 Survivor Musical</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Vote para eliminar a pior faixa de cada rodada</p>
      </div>

      {/* ── Active event ── */}
      {activeEvent ? (
        <div className="space-y-4">
          {/* Album header */}
          <div className="flex items-center gap-4 rounded-xl bg-white/5 p-4">
            {activeEvent.cover_url && (
              <Image src={activeEvent.cover_url} alt={activeEvent.album_name} width={80} height={80}
                className="rounded-xl object-cover shrink-0"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-bold text-white text-lg truncate">{activeEvent.album_name}</p>
              <p className="text-sm text-zinc-400 truncate">{activeEvent.artist_name}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs bg-[#D4537E]/20 text-[#D4537E] rounded-full px-2.5 py-0.5 font-semibold">
                  Rodada {activeEvent.current_round}
                </span>
                <span className="text-xs text-zinc-500">
                  {survivingTracks.length} faixa{survivingTracks.length !== 1 ? 's' : ''} restante{survivingTracks.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Voting prompt */}
          {!hasVoted && currentUserId && (
            <p className="text-sm text-zinc-400 text-center py-1">
              Qual faixa você quer eliminar? Vote em "Eliminar"
            </p>
          )}
          {!currentUserId && (
            <p className="text-sm text-zinc-500 text-center py-1">Faça login para votar</p>
          )}

          {/* Surviving tracks */}
          <div className="space-y-2">
            {survivingTracks.map(t => (
              <TrackCard
                key={t.id}
                track={t}
                voteCount={tally.get(t.id) ?? 0}
                totalVotes={totalVotes}
                voterProfiles={currentVotes.filter(v => v.track_id === t.id).map(v => v.profiles)}
                isUserVote={userVoteId === t.id}
                hasVoted={hasVoted}
                onVote={() => handleVote(t.id)}
                onPreview={() => togglePreview(t)}
                isPlaying={playingId === t.id}
                votingId={votingId}
              />
            ))}
          </div>

          {/* Eliminated tracks (collapsed) */}
          {eliminatedTracks.length > 0 && (
            <details className="group">
              <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-300 select-none">
                {eliminatedTracks.length} faixa{eliminatedTracks.length !== 1 ? 's' : ''} eliminada{eliminatedTracks.length !== 1 ? 's' : ''} ▸
              </summary>
              <div className="mt-2 space-y-1">
                {eliminatedTracks.map(t => (
                  <div key={t.id} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 opacity-50">
                    <span className="text-xs text-zinc-600 w-5 text-right shrink-0">{t.track_number}</span>
                    <span className="flex-1 text-sm text-zinc-400 line-through truncate">{t.track_name}</span>
                    <span className="text-xs text-zinc-600 shrink-0">elim. R{t.eliminated_at_round}</span>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Owner controls */}
          {isOwner && (
            <div className="pt-2">
              <button
                onClick={() => setShowAdvance(true)}
                className="w-full rounded-xl bg-[#7F77DD] py-3 text-sm font-semibold text-white hover:bg-[#7F77DD]/80 transition-colors"
              >
                Avançar Rodada →
              </button>
            </div>
          )}

          {showAdvance && (
            <AdvanceModal
              nextRound={activeEvent.current_round + 1}
              mostVotedTrack={mostVotedTrackName || 'sem votos ainda'}
              onConfirm={handleAdvance}
              onCancel={() => setShowAdvance(false)}
              loading={advancing}
            />
          )}
        </div>
      ) : finishedEvent ? (
        /* ── Most recent finished event results ── */
        <FinishedResults event={finishedEvent} tracks={finishedTracks} />
      ) : (
        /* ── No event ── */
        <div className="rounded-xl bg-white/5 p-8 text-center space-y-3">
          <p className="text-2xl">🎵</p>
          <p className="text-zinc-400">Nenhum Survivor ativo no momento</p>
          {isOwner && (
            <button
              onClick={() => setShowCreate(true)}
              className="mt-2 rounded-xl bg-[#D4537E] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#D4537E]/80"
            >
              Criar novo Survivor
            </button>
          )}
        </div>
      )}

      {/* Create button for owner when event is finished (not active) */}
      {!activeEvent && finishedEvent && isOwner && (
        <div>
          <button
            onClick={() => setShowCreate(true)}
            className="w-full rounded-xl bg-[#D4537E] py-3 text-sm font-semibold text-white hover:bg-[#D4537E]/80"
          >
            Criar novo Survivor
          </button>
        </div>
      )}

      {/* History */}
      <EventHistory pastEvents={pastEvents} />

      {/* Create modal */}
      {showCreate && (
        <CreateEventModal
          communityId={communityId}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            startTransition(() => router.refresh())
          }}
        />
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

// ─── Icons ────────────────────────────────────────────────────────────────────

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 19h4V5H6zm8-14v14h4V5z" />
    </svg>
  )
}
