'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

interface TrackInput {
  track_id:     string
  track_name:   string
  track_number: number
  preview_url:  string | null
}

interface CreateEventInput {
  communityId: string
  albumId:     string
  albumName:   string
  artistName:  string
  coverUrl:    string | null
  tracks:      TrackInput[]
}

export async function castVote(
  eventId: string,
  trackId: string,
  round: number,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Login necessário' }

  const { error } = await supabase
    .from('survivor_votes')
    .upsert(
      { event_id: eventId, track_id: trackId, user_id: user.id, round },
      { onConflict: 'event_id,user_id,round' },
    )

  if (error) {
    if (error.code === '42501' || error.code === '23505') {
      return { error: 'Você já votou nessa rodada. Aguarde a próxima!' }
    }
    return { error: error.message }
  }

  revalidatePath('/communities/musica/survivor')
  return {}
}

export async function advanceRound(eventId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Login necessário')

  const { data: event } = await supabase
    .from('survivor_events')
    .select('community_id, current_round, status')
    .eq('id', eventId)
    .single()
  if (!event) throw new Error('Evento não encontrado')
  if (event.status !== 'active') throw new Error('Evento não está ativo')

  const { data: member } = await supabase
    .from('community_members')
    .select('role')
    .eq('community_id', event.community_id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (member?.role !== 'owner') throw new Error('Sem permissão')

  const { data: surviving } = await supabase
    .from('survivor_tracks')
    .select('id')
    .eq('event_id', eventId)
    .is('eliminated_at_round', null)
    .order('track_number')
  if (!surviving || surviving.length < 2) throw new Error('Faixas insuficientes para avançar')

  const { data: votes } = await supabase
    .from('survivor_votes')
    .select('track_id')
    .eq('event_id', eventId)
    .eq('round', event.current_round)

  const tally = new Map<string, number>()
  for (const v of votes ?? []) {
    tally.set(v.track_id, (tally.get(v.track_id) ?? 0) + 1)
  }

  // Most-voted track; ties broken by order in surviving (ascending track_number)
  let toEliminate = surviving[0].id
  let max = tally.get(toEliminate) ?? 0
  for (const t of surviving) {
    const c = tally.get(t.id) ?? 0
    if (c > max) { max = c; toEliminate = t.id }
  }

  const newCount = surviving.length - 1

  await supabase
    .from('survivor_tracks')
    .update({ eliminated_at_round: event.current_round, final_position: newCount + 1 })
    .eq('id', toEliminate)

  if (newCount === 1) {
    const winnerId = surviving.find(t => t.id !== toEliminate)!.id
    await supabase.from('survivor_tracks').update({ final_position: 1 }).eq('id', winnerId)
    await supabase.from('survivor_events').update({ status: 'finished' }).eq('id', eventId)
  } else {
    await supabase
      .from('survivor_events')
      .update({ current_round: event.current_round + 1 })
      .eq('id', eventId)
  }

  revalidatePath('/communities/musica/survivor')
}

export async function createSurvivorEvent(input: CreateEventInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Login necessário')

  const { data: member } = await supabase
    .from('community_members')
    .select('role')
    .eq('community_id', input.communityId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (member?.role !== 'owner') throw new Error('Sem permissão')

  const { data: existing } = await supabase
    .from('survivor_events')
    .select('id')
    .eq('community_id', input.communityId)
    .eq('status', 'active')
    .maybeSingle()
  if (existing) throw new Error('Já existe um Survivor ativo')

  console.log('[createSurvivorEvent] tracks received:', input.tracks.length, input.tracks.map(t => t.track_name))

  if (input.tracks.length === 0) throw new Error('Nenhuma faixa encontrada para criar o Survivor')

  const { data: event, error } = await supabase
    .from('survivor_events')
    .insert({
      community_id: input.communityId,
      created_by:   user.id,
      album_id:     input.albumId,
      album_name:   input.albumName,
      artist_name:  input.artistName,
      cover_url:    input.coverUrl,
    })
    .select('id')
    .single()
  if (error || !event) throw new Error(error?.message ?? 'Erro ao criar evento')

  console.log('[createSurvivorEvent] event created:', event.id, '— inserting', input.tracks.length, 'tracks')

  const { error: trackErr } = await supabase
    .from('survivor_tracks')
    .insert(input.tracks.map(t => ({
      event_id:     event.id,
      track_id:     t.track_id,
      track_name:   t.track_name,
      track_number: t.track_number,
      preview_url:  t.preview_url,
    })))

  console.log('[createSurvivorEvent] track insert error:', trackErr)
  if (trackErr) throw new Error(`Erro ao inserir faixas: ${trackErr.message}`)

  revalidatePath('/communities/musica/survivor')
  return { eventId: event.id }
}
