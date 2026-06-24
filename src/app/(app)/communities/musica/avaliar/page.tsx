import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AlbumRatingClient from '@/components/music/AlbumRatingClient'
import type { RankedAlbum, RecentRating } from '@/components/music/AlbumRatingClient'

export const dynamic = 'force-dynamic'

interface SearchParams {
  albumId?:    string
  albumName?:  string
  artistName?: string
  coverUrl?:   string
}

export default async function AvaliarPage({ searchParams }: { searchParams?: SearchParams }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: allRatings } = await supabase
    .from('album_ratings')
    .select('album_id, album_name, artist_name, cover_url, overall_score, created_at, user_id, release_year, profiles!album_ratings_user_id_fkey(username, display_name)')
    .order('created_at', { ascending: false })

  // Aggregate per-album stats from raw rows (Supabase JS has no GROUP BY)
  const albumMap = new Map<string, {
    album_name:   string
    artist_name:  string
    cover_url:    string | null
    release_year: string | null
    scores:       number[]
    total_rows:   number
  }>()

  for (const r of allRatings ?? []) {
    if (!albumMap.has(r.album_id)) {
      albumMap.set(r.album_id, {
        album_name:   r.album_name,
        artist_name:  r.artist_name,
        cover_url:    r.cover_url,
        release_year: (r as Record<string, unknown>).release_year as string | null ?? null,
        scores:       [],
        total_rows:   0,
      })
    }
    const entry = albumMap.get(r.album_id)!
    entry.total_rows++
    if (r.overall_score != null) entry.scores.push(r.overall_score)
  }

  function makeRanked(id: string): RankedAlbum {
    const v = albumMap.get(id)!
    return {
      album_id:     id,
      album_name:   v.album_name,
      artist_name:  v.artist_name,
      cover_url:    v.cover_url,
      release_year: v.release_year,
      avg_score:    v.scores.length
        ? Math.round((v.scores.reduce((a, b) => a + b, 0) / v.scores.length) * 10) / 10
        : 0,
      rating_count: v.total_rows,
    }
  }

  const topAlbums: RankedAlbum[] = Array.from(albumMap.keys())
    .filter(id => albumMap.get(id)!.scores.length > 0)
    .map(makeRanked)
    .sort((a, b) => b.avg_score - a.avg_score)
    .slice(0, 10)

  const mostRated: RankedAlbum[] = Array.from(albumMap.keys())
    .map(makeRanked)
    .sort((a, b) => b.rating_count - a.rating_count)
    .slice(0, 8)

  const best2026: RankedAlbum[] = Array.from(albumMap.keys())
    .filter(id => albumMap.get(id)!.release_year === '2026' && albumMap.get(id)!.scores.length > 0)
    .map(makeRanked)
    .sort((a, b) => b.avg_score - a.avg_score)

  // Recent: one row per rating (not de-duped), most recent first
  const recentRatings: RecentRating[] = (allRatings ?? []).slice(0, 8).map(r => {
    const profileData = r.profiles
    const p = (Array.isArray(profileData) ? profileData[0] : profileData) as { username: string; display_name: string | null } | null
    return {
      album_id:      r.album_id,
      album_name:    r.album_name,
      artist_name:   r.artist_name,
      cover_url:     r.cover_url,
      overall_score: r.overall_score,
      username:      p?.username ?? 'incelica',
      display_name:  p?.display_name ?? null,
    }
  })

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/communities/musica"
          className="text-zinc-400 hover:text-white transition-colors text-sm"
        >
          ← Música
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-bold text-zinc-100">🎵 Avaliar Álbum — Comunidade Música</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Avalie cada faixa de 0 a 10 e marque seus favoritos
        </p>
      </div>

      <AlbumRatingClient
        topAlbums={topAlbums}
        recentRatings={recentRatings}
        mostRated={mostRated}
        best2026={best2026}
        userId={user?.id ?? null}
        initialAlbumId={searchParams?.albumId}
        initialAlbumName={searchParams?.albumName}
        initialArtistName={searchParams?.artistName}
        initialCoverUrl={searchParams?.coverUrl}
      />
    </main>
  )
}
