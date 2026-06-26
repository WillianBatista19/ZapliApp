import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AlbumReviews from '@/components/music/AlbumReviews'
import type { AlbumReview } from '@/components/music/AlbumReviews'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ albumId: string }>
}

const MARKERS = [
  { field: 'favorite_track_id',          emoji: '⭐', label: 'Música favorita' },
  { field: 'best_composition_track_id',  emoji: '✍️', label: 'Melhor composição' },
  { field: 'most_addictive_track_id',    emoji: '🔥', label: 'Mais viciante' },
  { field: 'best_vocal_track_id',        emoji: '🎤', label: 'Melhor vocal' },
  { field: 'best_instrumental_track_id', emoji: '🎸', label: 'Melhor instrumental' },
] as const

export default async function AlbumResultsPage({ params }: Props) {
  const { albumId } = await params
  const supabase    = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: rows } = await supabase
    .from('album_ratings')
    .select(`
      id, user_id, album_name, artist_name, cover_url, overall_score, review_text, created_at,
      favorite_track_id, best_composition_track_id, most_addictive_track_id,
      best_vocal_track_id, best_instrumental_track_id,
      profiles!album_ratings_user_id_fkey (username, display_name, avatar_url),
      track_ratings (track_id, track_name, track_number, score)
    `)
    .eq('album_id', albumId)
    .order('created_at', { ascending: false })

  if (!rows || rows.length === 0) notFound()

  // Album meta from first row
  const first = rows[0]

  // Community average
  const scored = rows.filter(r => r.overall_score != null)
  const communityAvg = scored.length
    ? Math.round((scored.reduce((s, r) => s + (r.overall_score ?? 0), 0) / scored.length) * 10) / 10
    : null

  // Per-track averages
  const trackMap = new Map<string, { name: string; number: number; scores: number[] }>()
  for (const row of rows) {
    for (const tr of row.track_ratings ?? []) {
      if (!trackMap.has(tr.track_id)) {
        trackMap.set(tr.track_id, { name: tr.track_name, number: tr.track_number, scores: [] })
      }
      if (tr.score != null) trackMap.get(tr.track_id)!.scores.push(tr.score)
    }
  }

  const trackAverages = Array.from(trackMap.entries())
    .map(([id, t]) => ({
      id,
      name:   t.name,
      number: t.number,
      avg:    t.scores.length
        ? Math.round((t.scores.reduce((a, b) => a + b, 0) / t.scores.length) * 10) / 10
        : null,
      count:  t.scores.length,
    }))
    .sort((a, b) => a.number - b.number)

  const maxAvg = Math.max(...trackAverages.map(t => t.avg ?? 0), 0.1)

  // Marker tallies
  const markerTallies = MARKERS.map(m => {
    const counts = new Map<string, { name: string; count: number }>()
    for (const row of rows) {
      const tid = (row as Record<string, unknown>)[m.field] as string | null
      if (!tid) continue
      const track = trackMap.get(tid)
      if (!track) continue
      if (!counts.has(tid)) counts.set(tid, { name: track.name, count: 0 })
      counts.get(tid)!.count++
    }
    const sorted = Array.from(counts.entries())
      .sort((a, b) => b[1].count - a[1].count)
    return {
      ...m,
      entries: sorted.map(([id, v]) => ({
        trackId:   id,
        trackName: v.name,
        count:     v.count,
        pct:       Math.round((v.count / rows.length) * 100),
      })),
    }
  })

  const isOwn = !!user && rows.some(r => r.user_id === user.id)

  const reviews: AlbumReview[] = rows
    .filter(r => r.review_text && r.review_text.trim())
    .map(r => {
      const profileData = r.profiles
      const p = (Array.isArray(profileData) ? profileData[0] : profileData) as { username: string; display_name: string | null; avatar_url: string | null } | null
      return {
        id:            r.id,
        review_text:   r.review_text as string,
        overall_score: r.overall_score as number | null,
        created_at:    r.created_at,
        username:      p?.username ?? 'incelica',
        display_name:  p?.display_name ?? null,
        avatar_url:    p?.avatar_url ?? null,
      }
    })

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <Link href="/communities/musica/avaliar" className="hover:text-white transition-colors">
          ← Avaliações
        </Link>
      </div>

      {/* Album header */}
      <div className="flex items-center gap-4">
        {first.cover_url ? (
          <Image
            src={first.cover_url}
            alt={first.album_name}
            width={88} height={88}
            className="rounded-xl shrink-0 object-cover"
          />
        ) : (
          <div className="w-[88px] h-[88px] rounded-xl bg-[#7F77DD]/30 flex items-center justify-center text-4xl shrink-0">🎵</div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold text-zinc-100 leading-tight">{first.album_name}</h1>
          <p className="text-sm text-zinc-400">{first.artist_name}</p>
          <p className="text-xs text-zinc-600 mt-1">{rows.length} avaliação{rows.length !== 1 ? 'ões' : ''}</p>
        </div>
        {communityAvg != null && (
          <div className="shrink-0 text-right">
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">Média</p>
            <p className="text-3xl font-black text-[#D4537E]">{communityAvg.toFixed(1)}</p>
          </div>
        )}
      </div>

      {/* Rate / edit button — passes album data as params so the form skips search */}
      <Link
        href={`/communities/musica/avaliar?albumId=${encodeURIComponent(albumId)}&albumName=${encodeURIComponent(first.album_name)}&artistName=${encodeURIComponent(first.artist_name)}${first.cover_url ? `&coverUrl=${encodeURIComponent(first.cover_url)}` : ''}`}
        className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/20 transition-colors"
      >
        {isOwn ? '✏️ Editar minha avaliação' : '🎵 Avaliar este álbum'}
      </Link>

      {/* Track averages */}
      {trackAverages.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Médias por faixa</h2>
          <div className="space-y-2">
            {trackAverages.map(t => (
              <div key={t.id} className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-zinc-600 w-5 shrink-0 text-right text-xs">{t.number}</span>
                  <span className="flex-1 text-zinc-200 truncate">{t.name}</span>
                  <span className="shrink-0 font-semibold text-[#D4537E] tabular-nums">
                    {t.avg != null ? t.avg.toFixed(1) : '—'}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden ml-7">
                  <div
                    className="h-full rounded-full bg-[#D4537E]/60 transition-all"
                    style={{ width: t.avg != null ? `${(t.avg / 10) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Marker tallies */}
      {markerTallies.some(m => m.entries.length > 0) && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Escolhas da comunidade</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {markerTallies.map(m => (
              <div key={m.field} className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-3">
                <p className="text-xs text-zinc-500 mb-2">{m.emoji} {m.label}</p>
                {m.entries.length === 0 ? (
                  <p className="text-xs text-zinc-700">Nenhum voto</p>
                ) : (
                  <div className="space-y-1.5">
                    {m.entries.slice(0, 3).map(e => (
                      <div key={e.trackId}>
                        <div className="flex items-center justify-between text-xs mb-0.5">
                          <span className="text-zinc-300 truncate">{e.trackName}</span>
                          <span className="text-zinc-500 shrink-0 ml-2">{e.count} ({e.pct}%)</span>
                        </div>
                        <div className="h-1 rounded-full bg-white/5">
                          <div
                            className="h-full rounded-full bg-[#7F77DD]/60"
                            style={{ width: `${e.pct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Community reviews */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">💬 Reviews da comunidade</h2>
        <AlbumReviews reviews={reviews} />
      </section>

      {/* User ratings list */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Quem avaliou</h2>
        <div className="space-y-2">
          {rows.map(row => {
            const profileData = row.profiles
            const p = (Array.isArray(profileData) ? profileData[0] : profileData) as { username: string; display_name: string | null; avatar_url: string | null } | null
            const name = p?.display_name ?? p?.username ?? 'Incelica'
            return (
              <div key={row.id} className="flex items-center gap-3 rounded-xl bg-zinc-900/60 border border-zinc-800 p-3">
                <Link href={`/profile/${p?.username}`}>
                  {p?.avatar_url ? (
                    <Image src={p.avatar_url} alt={name} width={32} height={32}
                      className="w-8 h-8 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[#7F77DD]/40 flex items-center justify-center text-sm shrink-0">
                      {name[0].toUpperCase()}
                    </div>
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/profile/${p?.username}`} className="text-sm font-semibold text-zinc-100 hover:underline">
                    {name}
                  </Link>
                  <p className="text-xs text-zinc-600">
                    {new Date(row.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                {row.overall_score != null && (
                  <span className="shrink-0 text-base font-bold text-[#D4537E]">
                    {(row.overall_score as number).toFixed(1)}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </main>
  )
}
