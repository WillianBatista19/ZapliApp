'use client'

import { useEffect, useState } from 'react'

// ─── Last.fm API types ────────────────────────────────────────────────────────

type LfmImage    = { '#text': string; size: string }

type LfmTrack = {
  name:    string
  artist:  { '#text': string }
  album:   { '#text': string }
  image:   LfmImage[]
  '@attr'?: { nowplaying: string }
}

type LfmArtist = {
  name:      string
  playcount: string
  image:     LfmImage[]
}

type LfmTopTrack = {
  name:      string
  playcount: string
  artist:    { name: string }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function lfmUrl(params: Record<string, string>) {
  return `/api/lastfm?${new URLSearchParams(params)}`
}

function albumArt(images: LfmImage[]): string {
  return (
    images.find(i => i.size === 'large')?.['#text'] ||
    images.find(i => i.size === 'extralarge')?.['#text'] ||
    ''
  )
}

function fmtPlays(n: string | number) {
  return Number(n).toLocaleString('pt-BR')
}

// ─── Fetch functions (all fire from the browser) ─────────────────────────────

async function fetchRecent(user: string): Promise<LfmTrack | null> {
  try {
    const res  = await fetch(lfmUrl({ method: 'user.getrecenttracks', user, limit: '1' }), { cache: 'no-store' })
    if (!res.ok) return null
    const json = await res.json()
    const raw  = json?.recenttracks?.track
    if (!raw) return null
    return Array.isArray(raw) ? (raw[0] ?? null) : raw
  } catch { return null }
}

async function fetchTopArtists(user: string): Promise<LfmArtist[]> {
  try {
    const res  = await fetch(lfmUrl({ method: 'user.gettopartists', user, period: '7day', limit: '5' }))
    if (!res.ok) return []
    const json = await res.json()
    const raw  = json?.topartists?.artist
    if (!raw) return []
    return Array.isArray(raw) ? raw : [raw]
  } catch { return [] }
}

async function fetchTopTracks(user: string): Promise<LfmTopTrack[]> {
  try {
    const res  = await fetch(lfmUrl({ method: 'user.gettoptracks', user, period: '7day', limit: '5' }))
    if (!res.ok) return []
    const json = await res.json()
    const raw  = json?.toptracks?.track
    if (!raw) return []
    return Array.isArray(raw) ? raw : [raw]
  } catch { return [] }
}

// ─── Main widget ─────────────────────────────────────────────────────────────

export default function LastfmWidget({ username }: { username: string }) {
  const [track,      setTrack]      = useState<LfmTrack | null>(null)
  const [nowPlaying, setNowPlaying] = useState(false)
  const [artists,    setArtists]    = useState<LfmArtist[]>([])
  const [topTracks,  setTopTracks]  = useState<LfmTopTrack[]>([])
  const [loading,    setLoading]    = useState(true)

  async function loadAll() {
    const [recent, arts, tracks] = await Promise.all([
      fetchRecent(username),
      fetchTopArtists(username),
      fetchTopTracks(username),
    ])
    setTrack(recent)
    setNowPlaying(recent?.['@attr']?.nowplaying === 'true')
    setArtists(arts)
    setTopTracks(tracks)
    setLoading(false)
  }

  async function pollNowPlaying() {
    const recent = await fetchRecent(username)
    setTrack(recent)
    setNowPlaying(recent?.['@attr']?.nowplaying === 'true')
  }

  useEffect(() => {
    loadAll()
    const timer = setInterval(pollNowPlaying, 30_000)
    return () => clearInterval(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username])

  if (loading) return <WidgetSkeleton />
  if (!track && artists.length === 0 && topTracks.length === 0) return null

  return (
    <div className="mb-6 space-y-3">

      {/* Now playing / recent track */}
      {track && <TrackBanner track={track} isLive={nowPlaying} username={username} />}

      {/* Top artists + top tracks side-by-side on wider screens */}
      {(artists.length > 0 || topTracks.length > 0) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {artists.length > 0 && (
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
              <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <LastfmIcon className="h-3.5 w-3.5 shrink-0" />
                Top artistas essa semana
              </h3>
              <ol className="space-y-2.5">
                {artists.map((a, i) => {
                  const art = albumArt(a.image)
                  return (
                    <li key={a.name} className="flex items-center gap-2.5">
                      <span className="w-4 shrink-0 text-right text-xs tabular-nums text-zinc-600">
                        {i + 1}
                      </span>
                      {art ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={art} alt="" className="h-8 w-8 shrink-0 rounded-md object-cover" />
                      ) : (
                        <div className="h-8 w-8 shrink-0 rounded-md bg-zinc-800" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-200">{a.name}</p>
                        <p className="text-xs text-zinc-500">{fmtPlays(a.playcount)} plays</p>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </section>
          )}

          {topTracks.length > 0 && (
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
              <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <LastfmIcon className="h-3.5 w-3.5 shrink-0" />
                Top músicas essa semana
              </h3>
              <ol className="space-y-2.5">
                {topTracks.map((t, i) => (
                  <li key={`${t.name}-${i}`} className="flex items-center gap-2.5">
                    <span className="w-4 shrink-0 text-right text-xs tabular-nums text-zinc-600">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-200">{t.name}</p>
                      <p className="truncate text-xs text-zinc-500">{t.artist.name}</p>
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-zinc-600">
                      {fmtPlays(t.playcount)}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

// ─── TrackBanner ─────────────────────────────────────────────────────────────

function TrackBanner({
  track,
  isLive,
  username,
}: {
  track:    LfmTrack
  isLive:   boolean
  username: string
}) {
  const art        = albumArt(track.image)
  const artistName = track.artist['#text']
  const albumName  = track.album['#text']

  return (
    <a
      href={`https://www.last.fm/user/${encodeURIComponent(username)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 transition-colors hover:border-zinc-700"
    >
      {/* Album art */}
      {art ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={art}
          alt={albumName || track.name}
          className="h-14 w-14 shrink-0 rounded-xl object-cover shadow-md"
        />
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-2xl">
          🎵
        </div>
      )}

      {/* Text */}
      <div className="min-w-0 flex-1">
        {/* Label */}
        <div className="mb-1 flex items-center gap-1.5">
          {isLive ? (
            <>
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#D4537E] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#D4537E]" />
              </span>
              <span className="text-xs font-semibold text-[#D4537E]">Ouvindo agora</span>
            </>
          ) : (
            <>
              <LastfmIcon className="h-3 w-3 shrink-0 text-zinc-500" />
              <span className="text-xs text-zinc-500">Ouviu recentemente</span>
            </>
          )}
        </div>

        <p className="truncate text-sm font-semibold text-zinc-100">{track.name}</p>
        <p className="truncate text-xs text-zinc-400">
          {artistName}
          {albumName && albumName !== artistName && (
            <span className="text-zinc-600"> · {albumName}</span>
          )}
        </p>
      </div>

      {/* Last.fm icon */}
      <LastfmIcon className="h-5 w-5 shrink-0 text-zinc-600" />
    </a>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function WidgetSkeleton() {
  return (
    <div className="mb-6 space-y-3 animate-pulse">
      <div className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
        <div className="h-14 w-14 shrink-0 rounded-xl bg-zinc-800" />
        <div className="flex-1 space-y-2">
          <div className="h-2.5 w-20 rounded bg-zinc-800" />
          <div className="h-3.5 w-40 rounded bg-zinc-800" />
          <div className="h-3 w-28 rounded bg-zinc-800" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="h-40 rounded-2xl border border-zinc-800 bg-zinc-900/60" />
        <div className="h-40 rounded-2xl border border-zinc-800 bg-zinc-900/60" />
      </div>
    </div>
  )
}

// ─── Equaliser bars icon (used as Last.fm section marker) ────────────────────

function LastfmIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="2"  y="14" width="4" height="7" rx="1" />
      <rect x="10" y="9"  width="4" height="12" rx="1" />
      <rect x="18" y="3"  width="4" height="18" rx="1" />
    </svg>
  )
}
