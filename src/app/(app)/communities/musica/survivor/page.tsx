import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SurvivorClient from '@/components/survivor/SurvivorClient'
import type { SurvivorEvent, SurvivorTrack } from '@/types'

export const dynamic = 'force-dynamic'

export interface VoteWithProfile {
  id:       string
  track_id: string
  user_id:  string
  profiles: { username: string; display_name: string | null; avatar_url: string | null } | null
}

export interface PastEventSummary {
  id:          string
  album_name:  string
  artist_name: string
  cover_url:   string | null
  created_at:  string
  winner_track: string | null
}

export default async function SurvivorPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: community } = await supabase
    .from('communities')
    .select('id')
    .eq('slug', 'musica')
    .single()

  const communityId = community?.id ?? ''

  let isOwner = false
  if (user && communityId) {
    const { data: member } = await supabase
      .from('community_members')
      .select('role')
      .eq('community_id', communityId)
      .eq('user_id', user.id)
      .maybeSingle()
    isOwner = member?.role === 'owner'
  }

  const { data: activeEventRaw } = await supabase
    .from('survivor_events')
    .select('*')
    .eq('community_id', communityId)
    .eq('status', 'active')
    .maybeSingle()

  const activeEvent = activeEventRaw as SurvivorEvent | null

  let tracks: SurvivorTrack[] = []
  let currentVotes: VoteWithProfile[] = []
  let userVoteId: string | null = null

  if (activeEvent) {
    const [tracksRes, votesRes] = await Promise.all([
      supabase
        .from('survivor_tracks')
        .select('*')
        .eq('event_id', activeEvent.id)
        .order('track_number'),
      supabase
        .from('survivor_votes')
        .select('id, track_id, user_id, profiles!survivor_votes_user_id_fkey(username, display_name, avatar_url)')
        .eq('event_id', activeEvent.id)
        .eq('round', activeEvent.current_round),
    ])

    tracks = (tracksRes.data ?? []) as SurvivorTrack[]

    const rawVotes = (votesRes.data ?? []) as Record<string, unknown>[]
    currentVotes = rawVotes.map(v => ({
      id:       v.id as string,
      track_id: v.track_id as string,
      user_id:  v.user_id as string,
      profiles: (() => {
        const p = v.profiles
        return (Array.isArray(p) ? p[0] : p) as VoteWithProfile['profiles']
      })(),
    }))

    if (user) {
      userVoteId = currentVotes.find(v => v.user_id === user.id)?.track_id ?? null
    }
  }

  // Most recent finished event (for results display when no active event)
  let finishedEvent: SurvivorEvent | null = null
  let finishedTracks: SurvivorTrack[] = []

  if (!activeEvent) {
    const { data: latest } = await supabase
      .from('survivor_events')
      .select('*')
      .eq('community_id', communityId)
      .eq('status', 'finished')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latest) {
      finishedEvent = latest as SurvivorEvent
      const { data: ft } = await supabase
        .from('survivor_tracks')
        .select('*')
        .eq('event_id', latest.id)
        .order('final_position')
      finishedTracks = (ft ?? []) as SurvivorTrack[]
    }
  }

  // Past events summary for history list
  const { data: pastRaw } = await supabase
    .from('survivor_events')
    .select('id, album_name, artist_name, cover_url, created_at')
    .eq('community_id', communityId)
    .eq('status', 'finished')
    .order('created_at', { ascending: false })
    .limit(10)

  const pastEvents: PastEventSummary[] = await Promise.all(
    (pastRaw ?? []).map(async e => {
      const { data: winner } = await supabase
        .from('survivor_tracks')
        .select('track_name')
        .eq('event_id', e.id)
        .eq('final_position', 1)
        .maybeSingle()
      return { ...e, winner_track: winner?.track_name ?? null }
    }),
  )

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/communities/musica" className="text-zinc-400 hover:text-white transition-colors text-sm">
          ← Música
        </Link>
      </div>

      <SurvivorClient
        activeEvent={activeEvent}
        tracks={tracks}
        currentVotes={currentVotes}
        userVoteId={userVoteId}
        finishedEvent={finishedEvent}
        finishedTracks={finishedTracks}
        pastEvents={pastEvents}
        isOwner={isOwner}
        currentUserId={user?.id ?? null}
        communityId={communityId}
      />
    </main>
  )
}
