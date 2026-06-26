'use server'

import { createClient } from '@/lib/supabase/server'

export type MarkerField =
  | 'favorite_track_id'
  | 'best_composition_track_id'
  | 'most_addictive_track_id'
  | 'best_vocal_track_id'
  | 'best_instrumental_track_id'

interface TrackInput {
  track_id:     string
  track_name:   string
  track_number: number
  score:        number | null
}

interface SaveRatingInput {
  album_id:     string
  album_name:   string
  artist_name:  string
  cover_url:    string | null
  release_year: string | null
  tracks:       TrackInput[]
  markers:      Record<MarkerField, string | null>
  review_text:  string | null
}

export async function saveAlbumRating(input: SaveRatingInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Você precisa estar logada para avaliar')

  // Overall score = average of non-null track scores
  const scored = input.tracks.filter(t => t.score != null && t.score >= 0 && t.score <= 10)
  const overall_score = scored.length > 0
    ? Math.round((scored.reduce((s, t) => s + (t.score ?? 0), 0) / scored.length) * 10) / 10
    : null

  const { data: row, error: albumErr } = await supabase
    .from('album_ratings')
    .upsert(
      {
        user_id:      user.id,
        album_id:     input.album_id,
        album_name:   input.album_name,
        artist_name:  input.artist_name,
        cover_url:    input.cover_url,
        release_year: input.release_year,
        overall_score,
        review_text: input.review_text,
        ...input.markers,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,album_id' },
    )
    .select('id')
    .single()

  if (albumErr) throw new Error(albumErr.message)

  const trackRows = input.tracks.map(t => ({
    album_rating_id: row.id,
    user_id:         user.id,
    track_id:        t.track_id,
    track_name:      t.track_name,
    track_number:    t.track_number,
    score:           t.score,
  }))

  const { error: trackErr } = await supabase
    .from('track_ratings')
    .upsert(trackRows, { onConflict: 'album_rating_id,track_id' })

  if (trackErr) throw new Error(trackErr.message)

  return { albumRatingId: row.id, overall_score }
}

export async function getUserAlbumRating(albumId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('album_ratings')
    .select(`
      id, album_id, overall_score, review_text,
      favorite_track_id, best_composition_track_id, most_addictive_track_id,
      best_vocal_track_id, best_instrumental_track_id,
      track_ratings (track_id, track_name, track_number, score)
    `)
    .eq('album_id', albumId)
    .eq('user_id', user.id)
    .maybeSingle()

  return data
}
