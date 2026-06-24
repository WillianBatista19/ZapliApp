'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export interface CategoryVote {
  categoryId:          string
  predictionNomineeId: string
  wishNomineeId:       string | null
}

// ─── Voting ───────────────────────────────────────────────────────────────────

export async function saveGrammyVotes(
  editionId: string,
  votes: CategoryVote[],
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Login necessário' }

  const { data: edition } = await supabase
    .from('grammy_editions')
    .select('status')
    .eq('id', editionId)
    .single()

  if (!edition) return { error: 'Edição não encontrada' }
  if (edition.status !== 'voting') return { error: 'Votações encerradas' }

  const rows = votes.map(v => ({
    edition_id:            editionId,
    category_id:           v.categoryId,
    user_id:               user.id,
    prediction_nominee_id: v.predictionNomineeId,
    wish_nominee_id:       v.wishNomineeId ?? null,
  }))

  const { error } = await supabase
    .from('grammy_votes')
    .upsert(rows, { onConflict: 'category_id,user_id' })

  if (error) return { error: error.message }

  revalidatePath('/communities/musica/grammy')
  return {}
}

// ─── Admin ────────────────────────────────────────────────────────────────────

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Login necessário')

  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .single()

  if (profile?.username !== 'incelicasappoficial') throw new Error('Sem permissão')
  return { supabase, userId: user.id }
}

export async function createGrammyEdition(
  year: number,
  ceremonyDate: string,
): Promise<{ error?: string; id?: string }> {
  try {
    const { supabase, userId } = await requireAdmin()
    const { data, error } = await supabase
      .from('grammy_editions')
      .insert({ year, ceremony_date: ceremonyDate, created_by: userId })
      .select('id')
      .single()
    if (error) return { error: error.message }
    revalidatePath('/communities/musica/grammy')
    return { id: data.id }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function addGrammyCategory(
  editionId: string,
  name: string,
  displayOrder: number,
): Promise<{ error?: string }> {
  try {
    const { supabase } = await requireAdmin()
    const { error } = await supabase
      .from('grammy_categories')
      .insert({ edition_id: editionId, name, display_order: displayOrder })
    if (error) return { error: error.message }
    revalidatePath('/communities/musica/grammy')
    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function addGrammyNominee(
  categoryId: string,
  name: string,
  artist: string | null,
  coverUrl: string | null,
): Promise<{ error?: string }> {
  try {
    const { supabase } = await requireAdmin()
    const { error } = await supabase
      .from('grammy_nominees')
      .insert({ category_id: categoryId, name, artist, cover_url: coverUrl })
    if (error) return { error: error.message }
    revalidatePath('/communities/musica/grammy')
    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function closeGrammyVoting(
  editionId: string,
): Promise<{ error?: string }> {
  try {
    const { supabase } = await requireAdmin()
    const { error } = await supabase
      .from('grammy_editions')
      .update({ status: 'closed' })
      .eq('id', editionId)
    if (error) return { error: error.message }
    revalidatePath('/communities/musica/grammy')
    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function revealGrammyWinners(
  editionId: string,
  winners: Array<{ categoryId: string; winnerId: string }>,
): Promise<{ error?: string }> {
  try {
    const { supabase } = await requireAdmin()

    for (const { categoryId, winnerId } of winners) {
      const { error } = await supabase
        .from('grammy_categories')
        .update({ winner_nominee_id: winnerId })
        .eq('id', categoryId)
        .eq('edition_id', editionId)
      if (error) throw new Error(error.message)
    }

    const { error } = await supabase
      .from('grammy_editions')
      .update({ status: 'revealed' })
      .eq('id', editionId)
    if (error) throw new Error(error.message)

    revalidatePath('/communities/musica/grammy')
    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function deleteGrammyNominee(
  nomineeId: string,
): Promise<{ error?: string }> {
  try {
    const { supabase } = await requireAdmin()
    const { error } = await supabase
      .from('grammy_nominees')
      .delete()
      .eq('id', nomineeId)
    if (error) return { error: error.message }
    revalidatePath('/communities/musica/grammy')
    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function deleteGrammyCategory(
  categoryId: string,
): Promise<{ error?: string }> {
  try {
    const { supabase } = await requireAdmin()
    const { error } = await supabase
      .from('grammy_categories')
      .delete()
      .eq('id', categoryId)
    if (error) return { error: error.message }
    revalidatePath('/communities/musica/grammy')
    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}
