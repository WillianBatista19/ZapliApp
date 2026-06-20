import { NextRequest, NextResponse } from 'next/server'

const STEAM_BASE = 'https://api.steampowered.com'
const API_KEY    = process.env.STEAM_API_KEY ?? ''

export async function GET(req: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json({ error: 'Steam API key not configured' }, { status: 500 })
  }

  const steamId = req.nextUrl.searchParams.get('steamId')
  if (!steamId || !/^\d{17}$/.test(steamId)) {
    return NextResponse.json({ error: 'Invalid Steam ID' }, { status: 400 })
  }

  try {
    const [summaryRes, recentRes] = await Promise.all([
      fetch(
        `${STEAM_BASE}/ISteamUser/GetPlayerSummaries/v2/?key=${API_KEY}&steamids=${steamId}`,
        { cache: 'no-store' },
      ),
      fetch(
        `${STEAM_BASE}/IPlayerService/GetRecentlyPlayedGames/v1/?key=${API_KEY}&steamid=${steamId}&count=3`,
        { cache: 'no-store' },
      ),
    ])

    if (!summaryRes.ok) {
      return NextResponse.json({ error: 'Steam API error' }, { status: 502 })
    }

    const [summaryJson, recentJson] = await Promise.all([
      summaryRes.json(),
      recentRes.ok ? recentRes.json() : Promise.resolve(null),
    ])

    const player = summaryJson?.response?.players?.[0] ?? null

    return NextResponse.json({
      gameextrainfo: player?.gameextrainfo   ?? null,
      gameid:        player?.gameid          ?? null,
      recentGames:   recentJson?.response?.games ?? [],
    })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch from Steam' }, { status: 502 })
  }
}
