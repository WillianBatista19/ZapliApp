import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import GrammyClient from '@/components/grammy/GrammyClient'
import type { GrammyEdition, GrammyNominee } from '@/types'

export const dynamic = 'force-dynamic'

export interface GrammyCategoryFull {
  id:                string
  name:              string
  display_order:     number
  winner_nominee_id: string | null
  nominees:          GrammyNominee[]
  vote_count:        number
  prediction_counts: Record<string, number>
  wish_counts:       Record<string, number>
}

export interface GrammyRankingEntry {
  user_id:      string
  username:     string
  display_name: string | null
  avatar_url:   string | null
  correct:      number
  total:        number
}

export default async function GrammyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Most recent edition
  const { data: editionRaw } = await supabase
    .from('grammy_editions')
    .select('*')
    .order('year', { ascending: false })
    .limit(1)
    .maybeSingle()

  const edition = editionRaw as GrammyEdition | null

  // Admin check
  let isAdmin = false
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single()
    isAdmin = profile?.username === 'incelicasappoficial'
  }

  // All editions for admin panel
  const { data: allEditionsRaw } = isAdmin
    ? await supabase.from('grammy_editions').select('*').order('year', { ascending: false })
    : { data: [] }
  const allEditions = (allEditionsRaw ?? []) as GrammyEdition[]

  let categories: GrammyCategoryFull[] = []
  let userVotes: Record<string, { prediction_nominee_id: string; wish_nominee_id: string | null }> = {}
  let ranking: GrammyRankingEntry[] = []

  if (edition) {
    const { data: catsRaw } = await supabase
      .from('grammy_categories')
      .select('id, name, display_order, winner_nominee_id')
      .eq('edition_id', edition.id)
      .order('display_order')

    const cats = (catsRaw ?? []) as { id: string; name: string; display_order: number; winner_nominee_id: string | null }[]
    const catIds = cats.map(c => c.id)

    const [nomineesRes, allVotesRes] = await Promise.all([
      catIds.length > 0
        ? supabase.from('grammy_nominees').select('*').in('category_id', catIds).order('created_at')
        : Promise.resolve({ data: [] }),
      catIds.length > 0
        ? supabase.from('grammy_votes').select('category_id, prediction_nominee_id, wish_nominee_id, user_id').eq('edition_id', edition.id)
        : Promise.resolve({ data: [] }),
    ])

    const nominees = (nomineesRes.data ?? []) as GrammyNominee[]
    const allVotes = (allVotesRes.data ?? []) as {
      category_id: string
      prediction_nominee_id: string
      wish_nominee_id: string | null
      user_id: string
    }[]

    // Compute per-category stats
    const predictionCounts: Record<string, Record<string, number>> = {}
    const wishCounts:       Record<string, Record<string, number>> = {}
    const votedUsers:       Record<string, Set<string>>            = {}

    for (const v of allVotes) {
      const cid = v.category_id
      if (!predictionCounts[cid]) predictionCounts[cid] = {}
      if (!wishCounts[cid])       wishCounts[cid]       = {}
      if (!votedUsers[cid])       votedUsers[cid]       = new Set()

      predictionCounts[cid][v.prediction_nominee_id] = (predictionCounts[cid][v.prediction_nominee_id] ?? 0) + 1
      if (v.wish_nominee_id) {
        wishCounts[cid][v.wish_nominee_id] = (wishCounts[cid][v.wish_nominee_id] ?? 0) + 1
      }
      votedUsers[cid].add(v.user_id)
    }

    categories = cats.map(cat => ({
      id:                cat.id,
      name:              cat.name,
      display_order:     cat.display_order,
      winner_nominee_id: cat.winner_nominee_id,
      nominees:          nominees.filter(n => n.category_id === cat.id),
      vote_count:        votedUsers[cat.id]?.size ?? 0,
      prediction_counts: predictionCounts[cat.id] ?? {},
      wish_counts:       wishCounts[cat.id] ?? {},
    }))

    // User votes
    if (user) {
      const { data: uvRaw } = await supabase
        .from('grammy_votes')
        .select('category_id, prediction_nominee_id, wish_nominee_id')
        .eq('edition_id', edition.id)
        .eq('user_id', user.id)

      for (const v of uvRaw ?? []) {
        userVotes[v.category_id] = {
          prediction_nominee_id: v.prediction_nominee_id,
          wish_nominee_id:       v.wish_nominee_id,
        }
      }
    }

    // Ranking (revealed only)
    if (edition.status === 'revealed') {
      const winnerMap: Record<string, string> = {}
      for (const cat of cats) {
        if (cat.winner_nominee_id) winnerMap[cat.id] = cat.winner_nominee_id
      }

      // Group votes by user
      const userPredictions: Record<string, Record<string, string>> = {}
      for (const v of allVotes) {
        if (!userPredictions[v.user_id]) userPredictions[v.user_id] = {}
        userPredictions[v.user_id][v.category_id] = v.prediction_nominee_id
      }

      const userStats: Record<string, { correct: number; total: number }> = {}
      for (const [uid, preds] of Object.entries(userPredictions)) {
        let correct = 0
        for (const [catId, predId] of Object.entries(preds)) {
          if (winnerMap[catId] === predId) correct++
        }
        userStats[uid] = { correct, total: Object.keys(preds).length }
      }

      const voterIds = Object.keys(userStats)
      if (voterIds.length > 0) {
        const { data: profilesRaw } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', voterIds)

        ranking = (profilesRaw ?? [])
          .map(p => ({
            user_id:      p.id,
            username:     p.username,
            display_name: p.display_name,
            avatar_url:   p.avatar_url,
            correct:      userStats[p.id]?.correct ?? 0,
            total:        userStats[p.id]?.total   ?? 0,
          }))
          .sort((a, b) => b.correct - a.correct || b.total - a.total)
      }
    }
  }

  const daysUntilCeremony = edition
    ? Math.max(0, Math.ceil((new Date(edition.ceremony_date).getTime() - Date.now()) / 86_400_000))
    : 0

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <Link href="/communities/musica" className="text-zinc-400 hover:text-white transition-colors text-sm">
        ← Música
      </Link>

      <GrammyClient
        edition={edition}
        categories={categories}
        userVotes={userVotes}
        ranking={ranking}
        isAdmin={isAdmin}
        allEditions={allEditions}
        currentUserId={user?.id ?? null}
        daysUntilCeremony={daysUntilCeremony}
      />
    </main>
  )
}
