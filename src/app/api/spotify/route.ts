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
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: 'grant_type=client_credentials',
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Spotify token request failed (${res.status}): ${body}`)
  }

  const json = await res.json() as { access_token: string; expires_in: number }
  cachedToken = json.access_token
  tokenExpiry = Date.now() + (json.expires_in - 60) * 1000
  return cachedToken
}

// Handles:
//   https://open.spotify.com/track/TRACK_ID
//   https://open.spotify.com/intl-pt/track/TRACK_ID?si=...
function extractTrackId(url: string): string | null {
  const m = url.match(/\/track\/([A-Za-z0-9]+)/)
  return m ? m[1] : null
}

async function getDeezerPreview(artist: string, title: string): Promise<string | null> {
  try {
    const q   = encodeURIComponent(`${artist} ${title}`)
    const res = await fetch(`https://api.deezer.com/search?q=${q}&limit=1`, {
      // Deezer requires no auth for basic search; called server-side so no CORS issue
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) {
      console.error('[Deezer] search failed:', res.status)
      return null
    }
    const json = await res.json() as { data?: { preview?: string }[] }
    const preview = json.data?.[0]?.preview ?? null
    console.log('[Deezer] preview found:', !!preview)
    return preview || null
  } catch (err) {
    console.error('[Deezer] search error:', err)
    return null
  }
}

export async function GET(req: NextRequest) {
  console.log('[Spotify] CLIENT_ID set:', !!CLIENT_ID)
  console.log('[Spotify] CLIENT_SECRET set:', !!CLIENT_SECRET)

  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('[Spotify] Missing env vars — set NEXT_PUBLIC_SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env.local')
    return NextResponse.json(
      { error: 'Spotify credentials not configured on server' },
      { status: 500 },
    )
  }

  const urlParam = req.nextUrl.searchParams.get('url')
  if (!urlParam) {
    return NextResponse.json({ error: 'Missing ?url= parameter' }, { status: 400 })
  }

  const trackId = extractTrackId(urlParam)
  if (!trackId) {
    return NextResponse.json({ error: 'Could not extract track ID from URL' }, { status: 400 })
  }

  // Step 1 — get Spotify access token
  let token: string
  try {
    token = await getAccessToken()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Spotify] Token error:', msg)
    return NextResponse.json({ error: `Auth failed: ${msg}` }, { status: 502 })
  }

  // Step 2 — fetch track metadata from Spotify
  const trackRes = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!trackRes.ok) {
    const body = await trackRes.text()
    console.error('[Spotify] Track fetch failed:', trackRes.status, body)
    return NextResponse.json(
      { error: `Spotify returned ${trackRes.status}: ${body}` },
      { status: trackRes.status },
    )
  }

  const track = await trackRes.json() as {
    name:        string
    artists:     { name: string }[]
    album:       { images: { url: string }[] }
  }

  const title    = track.name
  const artist   = track.artists.map(a => a.name).join(', ')
  const coverUrl = track.album.images[0]?.url ?? null

  // Step 3 — search Deezer for a 30-second preview (Spotify no longer provides previews)
  const previewUrl = await getDeezerPreview(artist, title)

  return NextResponse.json({
    title,
    artist,
    cover_url:    coverUrl,
    preview_url:  previewUrl,
    deezer_found: previewUrl !== null,
  })
}
