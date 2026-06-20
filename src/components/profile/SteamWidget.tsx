'use client'

import { useEffect, useState } from 'react'

type RecentGame = {
  appid:             number
  name:              string
  playtime_forever:  number
  playtime_2weeks?:  number
  img_icon_url:      string
}

type SteamData = {
  gameextrainfo: string | null
  gameid:        string | null
  recentGames:   RecentGame[]
}

function gameHeader(appid: number) {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`
}

function fmtHours(minutes: number) {
  const h = Math.floor(minutes / 60)
  return h === 1 ? '1 hora' : `${h.toLocaleString('pt-BR')} horas`
}

export default function SteamWidget({ steamId }: { steamId: string }) {
  const [data,    setData]    = useState<SteamData | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchData() {
    try {
      const res = await fetch(`/api/steam?steamId=${encodeURIComponent(steamId)}`, { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json() as SteamData
      setData(json)
    } catch {
      // silent — widget just won't show
    } finally {
      setLoading(false)
    }
  }

  async function pollPlaying() {
    try {
      const res = await fetch(`/api/steam?steamId=${encodeURIComponent(steamId)}`, { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json() as SteamData
      setData(prev => prev ? { ...prev, gameextrainfo: json.gameextrainfo, gameid: json.gameid } : json)
    } catch { /* silent */ }
  }

  useEffect(() => {
    fetchData()
    const timer = setInterval(pollPlaying, 60_000)
    return () => clearInterval(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steamId])

  if (loading) return <SteamSkeleton />
  if (!data || (data.recentGames.length === 0 && !data.gameextrainfo)) return null

  return (
    <div className="space-y-3">

      {/* Playing now banner */}
      {data.gameextrainfo && data.gameid && (
        <a
          href={`https://store.steampowered.com/app/${data.gameid}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-2xl border border-[#1D9E75]/30 bg-[#1D9E75]/10 p-4 transition-colors hover:border-[#1D9E75]/50"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={gameHeader(Number(data.gameid))}
            alt={data.gameextrainfo}
            className="h-12 w-20 flex-shrink-0 rounded-xl object-cover shadow-md"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1D9E75] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#1D9E75]" />
              </span>
              <span className="text-xs font-semibold text-[#1D9E75]">Jogando agora</span>
            </div>
            <p className="truncate text-sm font-semibold text-zinc-100">
              🎮 {data.gameextrainfo}
            </p>
          </div>
          <SteamIcon className="h-5 w-5 shrink-0 text-zinc-600" />
        </a>
      )}

      {/* Recent games */}
      {data.recentGames.length > 0 && (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            <SteamIcon className="h-3.5 w-3.5 shrink-0" />
            Jogos recentes
          </h3>
          <ol className="space-y-3">
            {data.recentGames.map((game) => (
              <li key={game.appid}>
                <a
                  href={`https://store.steampowered.com/app/${game.appid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 transition-opacity hover:opacity-80"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={gameHeader(game.appid)}
                    alt={game.name}
                    className="h-9 w-16 flex-shrink-0 rounded-lg object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-200">{game.name}</p>
                    <p className="text-xs text-zinc-500">
                      {fmtHours(game.playtime_forever)} no total
                      {game.playtime_2weeks
                        ? ` · ${fmtHours(game.playtime_2weeks)} essa semana`
                        : ''}
                    </p>
                  </div>
                </a>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}

function SteamSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
        <div className="h-12 w-20 flex-shrink-0 rounded-xl bg-zinc-800" />
        <div className="flex-1 space-y-2">
          <div className="h-2.5 w-20 rounded bg-zinc-800" />
          <div className="h-3.5 w-36 rounded bg-zinc-800" />
        </div>
      </div>
    </div>
  )
}

function SteamIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.497 1.009 2.455-.397.957-1.497 1.41-2.455 1.012zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.252 0-2.265-1.014-2.265-2.265z" />
    </svg>
  )
}
