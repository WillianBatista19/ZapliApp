import { NextRequest, NextResponse } from 'next/server'

export const dynamic    = 'force-dynamic'
export const fetchCache = 'force-no-store'

const CLIENT_ID     = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET

let cachedToken = ''
let tokenExpiry = 0

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken

  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: 'grant_type=client_credentials',
  })

  console.log('Token response status:', tokenRes.status)
  const tokenData = await tokenRes.json() as { access_token?: string; expires_in?: number; error?: string }
  console.log('Token response body:', JSON.stringify(tokenData))

  if (!tokenRes.ok) {
    throw new Error(`Spotify token request failed (${tokenRes.status}): ${JSON.stringify(tokenData)}`)
  }

  cachedToken = tokenData.access_token!
  tokenExpiry = Date.now() + (tokenData.expires_in! - 60) * 1000
  return cachedToken
}


type SpotifyAlbumItem = {
  id: string
  name: string
  artists: { name: string }[]
  images: { url: string }[]
  release_date: string
  total_tracks: number
}

export async function GET(req: NextRequest) {
  console.log('CLIENT_ID exists:', !!process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID, 'SECRET exists:', !!process.env.SPOTIFY_CLIENT_SECRET)

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return NextResponse.json({ error: 'Spotify credentials not configured' }, { status: 500 })
  }

  let token: string
  try {
    token = await getAccessToken()
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }

  const action = req.nextUrl.searchParams.get('action')

  // ── Album search: ?action=search&q=... ──────────────────────────────────
  if (action === 'search') {
    const q = req.nextUrl.searchParams.get('q')
    if (!q) return NextResponse.json({ error: 'Missing q' }, { status: 400 })

    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=album&limit=8&market=BR`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
    )

    if (!res.ok) {
      const body = await res.text()
      return NextResponse.json({ error: `Spotify search failed (${res.status}): ${body}` }, { status: res.status })
    }

    const json = await res.json() as { albums?: { items?: SpotifyAlbumItem[] } }
    const items = (json.albums?.items ?? []).map(a => ({
      id:          a.id,
      name:        a.name,
      artist:      a.artists[0]?.name ?? '',
      cover:       a.images[0]?.url ?? null,
      year:        a.release_date?.split('-')[0] ?? null,
      totalTracks: a.total_tracks,
    }))

    return NextResponse.json({ albums: items })
  }

  // ── Album details + tracks: ?action=album&id=... ─────────────────────────
  if (action === 'album') {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const [albumRes, tracksRes] = await Promise.all([
      fetch(`https://api.spotify.com/v1/albums/${id}?market=BR`, {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
      }),
      fetch(`https://api.spotify.com/v1/albums/${id}/tracks?limit=50&market=BR`, {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
      }),
    ])

    if (!albumRes.ok) {
      const body = await albumRes.text()
      return NextResponse.json({ error: `Album fetch failed (${albumRes.status}): ${body}` }, { status: albumRes.status })
    }
    if (!tracksRes.ok) {
      const body = await tracksRes.text()
      return NextResponse.json({ error: `Tracks fetch failed (${tracksRes.status}): ${body}` }, { status: tracksRes.status })
    }

    const [album, tracks] = await Promise.all([albumRes.json(), tracksRes.json()])
    return NextResponse.json({ album: { ...album, tracks } })
  }

  return NextResponse.json({ error: 'Invalid action. Use action=search or action=album' }, { status: 400 })
}
