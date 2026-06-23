import { NextRequest, NextResponse } from 'next/server'

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
  if (!res.ok) throw new Error(`Token request failed (${res.status})`)
  const json = await res.json() as { access_token: string; expires_in: number }
  cachedToken = json.access_token
  tokenExpiry = Date.now() + (json.expires_in - 60) * 1000
  return cachedToken
}

export async function GET(req: NextRequest) {
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

  // Album search: ?action=search&q=...
  if (action === 'search') {
    const q = req.nextUrl.searchParams.get('q')
    if (!q) return NextResponse.json({ error: 'Missing q' }, { status: 400 })

    const res  = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=album&limit=8&market=BR`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    const json = await res.json()
    return NextResponse.json(json)
  }

  // Album details + tracks: ?action=album&id=...
  if (action === 'album') {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const [albumRes, tracksRes] = await Promise.all([
      fetch(`https://api.spotify.com/v1/albums/${id}?market=BR`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`https://api.spotify.com/v1/albums/${id}/tracks?limit=50&market=BR`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ])

    const [album, tracks] = await Promise.all([albumRes.json(), tracksRes.json()])
    return NextResponse.json({ album: { ...album, tracks } })
  }

  return NextResponse.json({ error: 'Invalid action. Use action=search or action=album' }, { status: 400 })
}
