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
    .select('album_id, album_name, artist_name, cover_url, overall_score, created_at, user_id, profiles!album_ratings_user_id_fkey(username, display_name)')
    .order('created_at', { ascending: false })

  // Aggregate rankings from raw rows (Supabase JS client has no GROUP BY)
  const albumMap = new Map<string, {
    album_name:   string
    artist_name:  string
    cover_url:    string | null
    scores:       number[]
  }>()

  for (const r of allRatings ?? []) {
    if (!albumMap.has(r.album_id)) {
      albumMap.set(r.album_id, {
        album_name:  r.album_name,
        artist_name: r.artist_name,
        cover_url:   r.cover_url,
        scores:      [],
      })
    }
    if (r.overall_score != null) albumMap.get(r.album_id)!.scores.push(r.overall_score)
  }

  const topAlbums: RankedAlbum[] = Array.from(albumMap.entries())
    .filter(([, v]) => v.scores.length > 0)
    .map(([id, v]) => ({
      album_id:     id,
      album_name:   v.album_name,
      artist_name:  v.artist_name,
      cover_url:    v.cover_url,
      avg_score:    Math.round((v.scores.reduce((a, b) => a + b, 0) / v.scores.length) * 10) / 10,
      rating_count: v.scores.length,
    }))
    .sort((a, b) => b.avg_score - a.avg_score)
    .slice(0, 10)

  const mostRated: RankedAlbum[] = Array.from(albumMap.entries())
    .map(([id, v]) => ({
      album_id:     id,
      album_name:   v.album_name,
      artist_name:  v.artist_name,
      cover_url:    v.cover_url,
      avg_score:    v.scores.length
        ? Math.round((v.scores.reduce((a, b) => a + b, 0) / v.scores.length) * 10) / 10
        : 0,
      rating_count: albumMap.get(id)
        ? (allRatings ?? []).filter(r => r.album_id === id).length
        : 0,
    }))
    .sort((a, b) => b.rating_count - a.rating_count)
    .slice(0, 8)

  // Recent: one row per rating (not de-duped by album), most recent first
  const recentRatings: RecentRating[] = (allRatings ?? []).slice(0, 8).map(r => {
    const p = r.profiles as { username: string; display_name: string | null } | null
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
        <h1 className="text-xl font-bold text-white">🎵 Avaliar Álbum</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Avalie cada faixa de 0 a 10 e marque seus favoritos
        </p>
      </div>

      <AlbumRatingClient
        topAlbums={topAlbums}
        recentRatings={recentRatings}
        mostRated={mostRated}
        userId={user?.id ?? null}
        initialAlbumId={searchParams?.albumId}
        initialAlbumName={searchParams?.albumName}
        initialArtistName={searchParams?.artistName}
        initialCoverUrl={searchParams?.coverUrl}
      />
    </main>
  )
}
