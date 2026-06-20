import { NextRequest, NextResponse } from 'next/server'

const BASE    = 'https://ws.audioscrobbler.com/2.0/'
const API_KEY = process.env.NEXT_PUBLIC_LASTFM_API_KEY ?? process.env.LASTFM_API_KEY ?? ''

export async function GET(req: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json({ error: 'Last.fm API key not configured' }, { status: 500 })
  }

  const params = Object.fromEntries(req.nextUrl.searchParams.entries())
  const qs     = new URLSearchParams({ ...params, api_key: API_KEY, format: 'json' })

  try {
    const res  = await fetch(`${BASE}?${qs}`, { cache: 'no-store' })
    const json = await res.json()
    return NextResponse.json(json)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch from Last.fm' }, { status: 502 })
  }
}
