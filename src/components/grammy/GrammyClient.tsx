'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  saveGrammyVotes,
  createGrammyEdition,
  addGrammyCategory,
  addGrammyNominee,
  closeGrammyVoting,
  revealGrammyWinners,
  deleteGrammyCategory,
  deleteGrammyNominee,
} from '@/app/(app)/communities/musica/grammy/actions'
import type { GrammyEdition } from '@/types'
import type { GrammyCategoryFull, GrammyRankingEntry } from '@/app/(app)/communities/musica/grammy/page'

interface Props {
  edition:           GrammyEdition | null
  categories:        GrammyCategoryFull[]
  userVotes:         Record<string, { prediction_nominee_id: string; wish_nominee_id: string | null }>
  ranking:           GrammyRankingEntry[]
  isAdmin:           boolean
  allEditions:       GrammyEdition[]
  currentUserId:     string | null
  daysUntilCeremony: number
}

type MainTab = 'vote' | 'results' | 'ranking'

export default function GrammyClient({
  edition, categories, userVotes, ranking, isAdmin, allEditions, currentUserId, daysUntilCeremony,
}: Props) {
  const router = useRouter()

  const [tab, setTab] = useState<MainTab>(
    edition?.status === 'revealed' ? 'results' : 'vote',
  )

  const [localVotes, setLocalVotes] = useState<Record<string, { prediction: string | null; wish: string | null }>>(() => {
    const init: Record<string, { prediction: string | null; wish: string | null }> = {}
    for (const cat of categories) {
      const uv = userVotes[cat.id]
      init[cat.id] = { prediction: uv?.prediction_nominee_id ?? null, wish: uv?.wish_nominee_id ?? null }
    }
    return init
  })

  const [savingCat,  setSavingCat]  = useState<string | null>(null)
  const [savedCats,  setSavedCats]  = useState<Set<string>>(() => new Set(Object.keys(userVotes)))
  const [toast,      setToast]      = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  function toggleVote(catId: string, type: 'prediction' | 'wish', nomineeId: string) {
    setLocalVotes(prev => ({
      ...prev,
      [catId]: {
        ...prev[catId],
        [type]: prev[catId]?.[type] === nomineeId ? null : nomineeId,
      },
    }))
  }

  async function handleSaveCategory(catId: string) {
    if (!edition || !currentUserId) return
    const vote = localVotes[catId]
    if (!vote?.prediction) { showToast('Selecione sua previsão (🎯 Vai ganhar)'); return }
    setSavingCat(catId)
    const result = await saveGrammyVotes(edition.id, [{
      categoryId:          catId,
      predictionNomineeId: vote.prediction,
      wishNomineeId:       vote.wish ?? null,
    }])
    setSavingCat(null)
    if (result.error) { showToast(result.error); return }
    setSavedCats(prev => { const next = new Set(prev); next.add(catId); return next })
    showToast('Voto salvo!')
    router.refresh()
  }

  if (!edition && !isAdmin) {
    return (
      <div className="text-center py-16 space-y-2">
        <p className="text-4xl">🏆</p>
        <p className="text-zinc-400">Nenhuma edição do Grammy disponível ainda.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-5 flex items-start gap-3">
        <span className="text-4xl shrink-0">🏆</span>
        <div>
          {edition ? (
            <>
              <h1 className="text-xl font-bold text-zinc-100">Grammy {edition.year}</h1>
              {edition.status === 'voting' && daysUntilCeremony > 0 && (
                <p className="text-sm text-[#D4537E] mt-1">faltam {daysUntilCeremony} dias para a cerimônia</p>
              )}
              {edition.status === 'voting' && daysUntilCeremony === 0 && (
                <p className="text-sm text-[#D4537E] mt-1">A cerimônia é hoje! 🎉</p>
              )}
              {edition.status === 'closed' && (
                <p className="text-sm text-yellow-400 mt-1">⏳ Votações encerradas — aguardando resultados</p>
              )}
              {edition.status === 'revealed' && (
                <p className="text-sm text-[#1D9E75] mt-1">✅ Resultados revelados!</p>
              )}
            </>
          ) : (
            <h1 className="text-xl font-bold text-zinc-100">Grammy Predictions</h1>
          )}
        </div>
      </div>

      {/* Tabs (only shown when revealed) */}
      {edition?.status === 'revealed' && (
        <div className="flex gap-1 border-b border-zinc-800">
          <TabBtn active={tab === 'results'} onClick={() => setTab('results')}>🏆 Resultados</TabBtn>
          <TabBtn active={tab === 'ranking'} onClick={() => setTab('ranking')}>📊 Ranking</TabBtn>
        </div>
      )}

      {/* Vote / closed view */}
      {edition && edition.status !== 'revealed' && (
        <VoteSection
          edition={edition}
          categories={categories}
          localVotes={localVotes}
          savedCats={savedCats}
          savingCat={savingCat}
          currentUserId={currentUserId}
          toggleVote={toggleVote}
          onSave={handleSaveCategory}
        />
      )}

      {/* Results tab */}
      {tab === 'results' && edition?.status === 'revealed' && (
        <ResultsSection
          categories={categories}
          userVotes={userVotes}
          currentUserId={currentUserId}
        />
      )}

      {/* Ranking tab */}
      {tab === 'ranking' && edition?.status === 'revealed' && (
        <RankingSection ranking={ranking} currentUserId={currentUserId} />
      )}

      {/* Admin panel */}
      {isAdmin && (
        <AdminPanel
          edition={edition}
          allEditions={allEditions}
          categories={categories}
          onRefresh={() => router.refresh()}
        />
      )}

      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-zinc-800 px-4 py-2 text-sm text-white shadow-xl whitespace-nowrap">
          {toast}
        </div>
      )}
    </div>
  )
}

// ─── TabBtn ───────────────────────────────────────────────────────────────────

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium transition ${
        active ? 'text-[#D4537E] border-b-2 border-[#D4537E]' : 'text-zinc-400 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

// ─── VoteSection ─────────────────────────────────────────────────────────────

function VoteSection({
  edition, categories, localVotes, savedCats, savingCat, currentUserId,
  toggleVote, onSave,
}: {
  edition:      GrammyEdition
  categories:   GrammyCategoryFull[]
  localVotes:   Record<string, { prediction: string | null; wish: string | null }>
  savedCats:    Set<string>
  savingCat:    string | null
  currentUserId: string | null
  toggleVote:   (catId: string, type: 'prediction' | 'wish', nomineeId: string) => void
  onSave:       (catId: string) => void
}) {
  if (edition.status === 'closed') {
    return (
      <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-8 text-center space-y-2">
        <p className="text-2xl">⏳</p>
        <p className="text-zinc-300 font-medium">Votações encerradas</p>
        <p className="text-zinc-500 text-sm">Aguarde a revelação dos vencedores.</p>
        {categories.length > 0 && (
          <div className="pt-4 space-y-2">
            {categories.map(cat => (
              <div key={cat.id} className="text-left rounded-lg bg-zinc-800/50 px-3 py-2 text-sm">
                <span className="text-zinc-300 font-medium">{cat.name}</span>
                <span className="text-zinc-600 ml-2 text-xs">{cat.vote_count} votos</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (categories.length === 0) {
    return <p className="text-zinc-500 text-center py-10">Nenhuma categoria disponível ainda.</p>
  }

  return (
    <div className="space-y-4">
      {!currentUserId && (
        <div className="rounded-xl bg-[#D4537E]/10 border border-[#D4537E]/30 p-3 text-sm text-[#D4537E] text-center">
          <a href="/login" className="underline font-medium">Faça login</a> para votar nas suas previsões!
        </div>
      )}

      {categories.map(cat => {
        const votes   = localVotes[cat.id] ?? { prediction: null, wish: null }
        const isSaved = savedCats.has(cat.id)
        const isSaving = savingCat === cat.id
        const canVote = !!currentUserId && edition.status === 'voting'

        return (
          <div key={cat.id} className="rounded-xl bg-zinc-900/60 border border-zinc-800 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <h2 className="font-semibold text-zinc-100">{cat.name}</h2>
              <span className="text-xs text-zinc-500">
                {cat.vote_count} {cat.vote_count === 1 ? 'voto' : 'votos'}
              </span>
            </div>

            <div className="p-3 space-y-2">
              {canVote && (
                <div className="flex gap-4 text-xs text-zinc-500 pb-1">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#D4537E] inline-block" />🎯 Vai ganhar</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#7F77DD] inline-block" />💜 Deveria ganhar (opcional)</span>
                </div>
              )}

              <div className="space-y-1.5">
                {cat.nominees.map(nominee => {
                  const isPrediction = votes.prediction === nominee.id
                  const isWish       = votes.wish       === nominee.id
                  return (
                    <div
                      key={nominee.id}
                      className={`flex items-center gap-3 rounded-xl border p-2.5 transition-colors ${
                        isPrediction ? 'border-[#D4537E] bg-[#D4537E]/10' :
                        isWish       ? 'border-[#7F77DD] bg-[#7F77DD]/10' :
                                       'border-zinc-700 bg-zinc-800/40'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-zinc-700 flex items-center justify-center">
                        {nominee.cover_url
                          ? (/* eslint-disable-next-line @next/next/no-img-element */
                            <img src={nominee.cover_url} alt={nominee.name} className="w-full h-full object-cover" />)
                          : <span className="text-zinc-500 text-lg">🎵</span>
                        }
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-100 truncate">{nominee.name}</p>
                        {nominee.artist && <p className="text-xs text-zinc-500 truncate">{nominee.artist}</p>}
                      </div>

                      {canVote ? (
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            onClick={() => toggleVote(cat.id, 'prediction', nominee.id)}
                            title="Vai ganhar"
                            className={`rounded-lg px-2.5 py-1.5 text-sm transition ${
                              isPrediction ? 'bg-[#D4537E] text-white' : 'bg-zinc-700 text-zinc-400 hover:bg-[#D4537E]/30 hover:text-[#D4537E]'
                            }`}
                          >
                            🎯
                          </button>
                          <button
                            onClick={() => toggleVote(cat.id, 'wish', nominee.id)}
                            title="Deveria ganhar"
                            className={`rounded-lg px-2.5 py-1.5 text-sm transition ${
                              isWish ? 'bg-[#7F77DD] text-white' : 'bg-zinc-700 text-zinc-400 hover:bg-[#7F77DD]/30 hover:text-[#7F77DD]'
                            }`}
                          >
                            💜
                          </button>
                        </div>
                      ) : (isPrediction || isWish) ? (
                        <div className="shrink-0 flex gap-1">
                          {isPrediction && <span className="text-[#D4537E] text-sm">🎯</span>}
                          {isWish       && <span className="text-[#7F77DD] text-sm">💜</span>}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>

              {canVote && (
                <button
                  onClick={() => onSave(cat.id)}
                  disabled={isSaving || !votes.prediction}
                  className={`w-full mt-1 rounded-xl py-2.5 text-sm font-semibold transition ${
                    isSaved
                      ? 'bg-[#1D9E75]/20 text-[#1D9E75] border border-[#1D9E75]/30 hover:bg-[#1D9E75]/30'
                      : 'bg-[#D4537E] text-white hover:bg-[#c44370] disabled:opacity-40 disabled:cursor-not-allowed'
                  }`}
                >
                  {isSaving ? 'Salvando...' : isSaved ? '✓ Voto salvo — alterar' : 'Salvar votos'}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── ResultsSection ───────────────────────────────────────────────────────────

function ResultsSection({
  categories, userVotes, currentUserId,
}: {
  categories:   GrammyCategoryFull[]
  userVotes:    Record<string, { prediction_nominee_id: string; wish_nominee_id: string | null }>
  currentUserId: string | null
}) {
  let correct = 0
  const votedCount = Object.keys(userVotes).length
  for (const cat of categories) {
    if (cat.winner_nominee_id && userVotes[cat.id]?.prediction_nominee_id === cat.winner_nominee_id) {
      correct++
    }
  }

  return (
    <div className="space-y-4">
      {currentUserId && votedCount > 0 && (
        <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-5 text-center">
          <p className="text-xs text-zinc-500 uppercase tracking-wide">Seu placar</p>
          <p className="text-3xl font-bold text-zinc-100 mt-1">{correct * 10} <span className="text-lg font-normal text-zinc-400">pontos</span></p>
          <p className="text-sm text-zinc-400 mt-1">
            Você acertou {correct} de {votedCount} {votedCount === 1 ? 'categoria' : 'categorias'}
          </p>
        </div>
      )}

      {categories.map(cat => {
        const winner           = cat.nominees.find(n => n.id === cat.winner_nominee_id)
        const totalVotes       = cat.vote_count
        const winnerPredCount  = winner ? (cat.prediction_counts[winner.id] ?? 0) : 0
        const winnerPredPct    = totalVotes > 0 ? Math.round((winnerPredCount / totalVotes) * 100) : 0

        const topPredId   = Object.entries(cat.prediction_counts).sort((a, b) => b[1] - a[1])[0]?.[0]
        const topWishId   = Object.entries(cat.wish_counts).sort((a, b) => b[1] - a[1])[0]?.[0]
        const topPredName = cat.nominees.find(n => n.id === topPredId)?.name
        const topWishName = cat.nominees.find(n => n.id === topWishId)?.name

        const communityPredictedRight  = !!winner && topPredId === winner.id
        const communityWantedWinner    = !!winner && topWishId === winner.id

        let insightMsg = ''
        if (communityPredictedRight && communityWantedWinner)   insightMsg = 'A comunidade acertou e queria isso mesmo! 🎉'
        else if (communityPredictedRight && !communityWantedWinner) insightMsg = 'A comunidade sabia mas queria outro resultado 💔'

        return (
          <div key={cat.id} className="rounded-xl bg-zinc-900/60 border border-zinc-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800">
              <h2 className="font-semibold text-zinc-100">{cat.name}</h2>
            </div>

            <div className="p-4 space-y-3">
              {/* Winner highlight */}
              {winner && (
                <div className="flex items-center gap-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 p-3">
                  <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-zinc-700 flex items-center justify-center">
                    {winner.cover_url
                      ? (/* eslint-disable-next-line @next/next/no-img-element */
                        <img src={winner.cover_url} alt={winner.name} className="w-full h-full object-cover" />)
                      : <span className="text-xl text-zinc-500">🎵</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-yellow-400 font-medium">🏆 Vencedor</p>
                    <p className="font-semibold text-zinc-100 truncate">{winner.name}</p>
                    {winner.artist && <p className="text-xs text-zinc-400 truncate">{winner.artist}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-[#D4537E]">{winnerPredPct}%</p>
                    <p className="text-xs text-zinc-500">previram</p>
                  </div>
                </div>
              )}

              {/* All nominees with bars */}
              <div className="space-y-2">
                {cat.nominees.map(nominee => {
                  const predCount = cat.prediction_counts[nominee.id] ?? 0
                  const wishCount = cat.wish_counts[nominee.id]       ?? 0
                  const predPct   = totalVotes > 0 ? Math.round((predCount / totalVotes) * 100) : 0
                  const wishPct   = totalVotes > 0 ? Math.round((wishCount / totalVotes) * 100) : 0
                  const isWinner  = nominee.id === cat.winner_nominee_id
                  const uPred     = userVotes[cat.id]?.prediction_nominee_id === nominee.id
                  const uWish     = userVotes[cat.id]?.wish_nominee_id       === nominee.id

                  return (
                    <div key={nominee.id} className={`rounded-lg p-3 space-y-2 ${isWinner ? 'bg-yellow-500/5 border border-yellow-500/20' : 'bg-zinc-800/40'}`}>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded overflow-hidden shrink-0 bg-zinc-700 flex items-center justify-center">
                          {nominee.cover_url
                            ? (/* eslint-disable-next-line @next/next/no-img-element */
                              <img src={nominee.cover_url} alt={nominee.name} className="w-full h-full object-cover" />)
                            : <span className="text-sm text-zinc-500">🎵</span>
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {isWinner && <span className="text-yellow-400 text-xs">🏆</span>}
                            <p className="text-sm font-medium text-zinc-100 truncate">{nominee.name}</p>
                            {uPred && <span className="text-[#D4537E] text-xs shrink-0" title="Sua previsão">🎯</span>}
                            {uWish && <span className="text-[#7F77DD] text-xs shrink-0" title="Seu desejo">💜</span>}
                          </div>
                          {nominee.artist && <p className="text-xs text-zinc-500 truncate">{nominee.artist}</p>}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-zinc-700 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full bg-[#D4537E]" style={{ width: `${predPct}%` }} />
                          </div>
                          <span className="text-xs text-zinc-500 w-9 text-right">{predPct}%</span>
                          <span className="text-xs">🎯</span>
                        </div>
                        {wishCount > 0 && (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-zinc-700 rounded-full h-1.5">
                              <div className="h-1.5 rounded-full bg-[#7F77DD]" style={{ width: `${wishPct}%` }} />
                            </div>
                            <span className="text-xs text-zinc-500 w-9 text-right">{wishPct}%</span>
                            <span className="text-xs">💜</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Community insights */}
              {totalVotes > 0 && topPredName && (
                <div className="rounded-lg bg-zinc-800/50 p-3 space-y-1.5 text-sm">
                  <div className="flex items-start gap-2 text-zinc-300">
                    <span className="shrink-0">🎯</span>
                    <span>Previsão da comunidade: <span className="font-medium text-white">{topPredName}</span></span>
                  </div>
                  {topWishName && topWishId !== topPredId && (
                    <div className="flex items-start gap-2 text-zinc-300">
                      <span className="shrink-0">💜</span>
                      <span>Favorito da comunidade: <span className="font-medium text-white">{topWishName}</span></span>
                    </div>
                  )}
                  {insightMsg && (
                    <p className={`text-xs pt-1.5 border-t border-zinc-700 ${communityPredictedRight && communityWantedWinner ? 'text-[#1D9E75]' : 'text-zinc-400'}`}>
                      {insightMsg}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── RankingSection ───────────────────────────────────────────────────────────

function RankingSection({ ranking, currentUserId }: { ranking: GrammyRankingEntry[]; currentUserId: string | null }) {
  if (ranking.length === 0) {
    return <p className="text-zinc-500 text-center py-8">Nenhum voto registrado.</p>
  }
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-medium text-zinc-400 px-1">Melhores previsores</h2>
      {ranking.map((entry, i) => {
        const accuracy      = entry.total > 0 ? Math.round((entry.correct / entry.total) * 100) : 0
        const isCurrentUser = entry.user_id === currentUserId
        const medal         = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null

        return (
          <div
            key={entry.user_id}
            className={`flex items-center gap-3 rounded-xl p-3 border ${
              isCurrentUser ? 'bg-[#D4537E]/10 border-[#D4537E]/30' : 'bg-zinc-900/60 border-zinc-800'
            }`}
          >
            <span className="w-6 text-center text-sm shrink-0">
              {medal ?? <span className="text-zinc-600 text-xs">{i + 1}</span>}
            </span>

            <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 bg-[#7F77DD]/40 flex items-center justify-center text-sm">
              {entry.avatar_url
                ? (/* eslint-disable-next-line @next/next/no-img-element */
                  <img src={entry.avatar_url} alt={entry.display_name ?? entry.username} className="w-full h-full object-cover" />)
                : (entry.display_name ?? entry.username)[0]?.toUpperCase()
              }
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-100 truncate">
                {entry.display_name ?? entry.username}
                {isCurrentUser && <span className="text-[#D4537E] text-xs ml-1">(você)</span>}
              </p>
              <p className="text-xs text-zinc-500">
                {entry.correct} acerto{entry.correct !== 1 ? 's' : ''} · {accuracy}% precisão
              </p>
            </div>

            <div className="text-right shrink-0">
              <p className="text-sm font-bold text-zinc-100">{entry.correct * 10} pts</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── AdminPanel ───────────────────────────────────────────────────────────────

type AdminSection = 'main' | 'new-edition' | 'add-category' | 'add-nominee' | 'reveal' | 'delete-nominee'

function AdminPanel({
  edition, allEditions, categories, onRefresh,
}: {
  edition:     GrammyEdition | null
  allEditions: GrammyEdition[]
  categories:  GrammyCategoryFull[]
  onRefresh:   () => void
}) {
  const [open,    setOpen]    = useState(false)
  const [section, setSection] = useState<AdminSection>('main')
  const [saving,  setSaving]  = useState(false)
  const [msg,     setMsg]     = useState('')

  const [year,         setYear]         = useState('')
  const [ceremonyDate, setCeremonyDate] = useState('')
  const [catName,      setCatName]      = useState('')
  const [selCatId,     setSelCatId]     = useState('')
  const [nomName,      setNomName]      = useState('')
  const [nomArtist,    setNomArtist]    = useState('')
  const [nomCover,     setNomCover]     = useState('')
  const [revealMap,    setRevealMap]    = useState<Record<string, string>>({})

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(''), 4000) }

  async function handleCreateEdition() {
    if (!year || !ceremonyDate) return flash('Preencha ano e data')
    setSaving(true)
    const r = await createGrammyEdition(parseInt(year), ceremonyDate)
    setSaving(false)
    if (r.error) return flash(r.error)
    flash('Edição criada!')
    setYear(''); setCeremonyDate(''); setSection('main')
    onRefresh()
  }

  async function handleAddCategory() {
    if (!edition || !catName.trim()) return flash('Preencha o nome da categoria')
    setSaving(true)
    const r = await addGrammyCategory(edition.id, catName.trim(), categories.length)
    setSaving(false)
    if (r.error) return flash(r.error)
    flash('Categoria adicionada!')
    setCatName('')
    onRefresh()
  }

  async function handleAddNominee() {
    if (!selCatId || !nomName.trim()) return flash('Selecione categoria e nome')
    setSaving(true)
    const r = await addGrammyNominee(selCatId, nomName.trim(), nomArtist.trim() || null, nomCover.trim() || null)
    setSaving(false)
    if (r.error) return flash(r.error)
    flash('Indicado adicionado!')
    setNomName(''); setNomArtist(''); setNomCover('')
    onRefresh()
  }

  async function handleCloseVoting() {
    if (!edition) return
    setSaving(true)
    const r = await closeGrammyVoting(edition.id)
    setSaving(false)
    if (r.error) return flash(r.error)
    flash('Votações encerradas!')
    onRefresh()
  }

  async function handleReveal() {
    if (!edition) return
    const winners = Object.entries(revealMap)
      .filter(([, v]) => v)
      .map(([catId, winnerId]) => ({ categoryId: catId, winnerId }))
    if (winners.length === 0) return flash('Selecione pelo menos um vencedor')
    setSaving(true)
    const r = await revealGrammyWinners(edition.id, winners)
    setSaving(false)
    if (r.error) return flash(r.error)
    flash('Vencedores revelados!')
    onRefresh()
  }

  async function handleDeleteCategory(catId: string) {
    if (!confirm('Apagar esta categoria e todos os indicados?')) return
    setSaving(true)
    const r = await deleteGrammyCategory(catId)
    setSaving(false)
    if (r.error) return flash(r.error)
    flash('Categoria removida!')
    onRefresh()
  }

  async function handleDeleteNominee(nomineeId: string, nomineeName: string) {
    if (!confirm(`Apagar "${nomineeName}"?`)) return
    setSaving(true)
    const r = await deleteGrammyNominee(nomineeId)
    setSaving(false)
    if (r.error) return flash(r.error)
    flash('Indicado removido!')
    onRefresh()
  }

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900/40">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
      >
        <span>⚙️ Admin — Grammy</span>
        <span className="text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-zinc-700 p-4 space-y-4">
          {msg && (
            <div className="rounded-lg bg-zinc-700 px-3 py-2 text-sm text-zinc-200">{msg}</div>
          )}

          {edition && (
            <p className="text-xs text-zinc-500">
              Grammy {edition.year} · status: <span className="text-zinc-300">{edition.status}</span>
            </p>
          )}

          {/* Quick actions */}
          <div className="flex flex-wrap gap-2">
            <ABtn onClick={() => setSection('new-edition')}>+ Nova Edição</ABtn>
            {edition && <ABtn onClick={() => setSection('add-category')}>+ Categoria</ABtn>}
            {edition && categories.length > 0 && <ABtn onClick={() => setSection('add-nominee')}>+ Indicado</ABtn>}
            {edition && categories.length > 0 && <ABtn onClick={() => setSection('delete-nominee')}>🗑 Remover</ABtn>}
            {edition?.status === 'voting' && (
              <ABtn onClick={handleCloseVoting} disabled={saving}>Encerrar Votações</ABtn>
            )}
            {edition?.status === 'closed' && (
              <ABtn onClick={() => setSection('reveal')}>🏆 Revelar Vencedores</ABtn>
            )}
          </div>

          {/* New edition */}
          {section === 'new-edition' && (
            <div className="space-y-2 border-t border-zinc-700 pt-3">
              <p className="text-xs text-zinc-400 font-medium">Nova Edição</p>
              <input value={year} onChange={e => setYear(e.target.value)} type="number" placeholder="Ano (ex: 2027)" className={inputClass} />
              <input value={ceremonyDate} onChange={e => setCeremonyDate(e.target.value)} type="date" className={inputClass} />
              <button onClick={handleCreateEdition} disabled={saving} className={btnClass}>{saving ? 'Criando...' : 'Criar Edição'}</button>
            </div>
          )}

          {/* Add category */}
          {section === 'add-category' && edition && (
            <div className="space-y-2 border-t border-zinc-700 pt-3">
              <p className="text-xs text-zinc-400 font-medium">Adicionar Categoria</p>
              <input value={catName} onChange={e => setCatName(e.target.value)} placeholder="Ex: Álbum do Ano" className={inputClass} />
              <button onClick={handleAddCategory} disabled={saving} className={btnClass}>{saving ? 'Adicionando...' : 'Adicionar'}</button>
            </div>
          )}

          {/* Add nominee */}
          {section === 'add-nominee' && (
            <div className="space-y-2 border-t border-zinc-700 pt-3">
              <p className="text-xs text-zinc-400 font-medium">Adicionar Indicado</p>
              <select value={selCatId} onChange={e => setSelCatId(e.target.value)} className={inputClass}>
                <option value="">Selecione a categoria</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input value={nomName} onChange={e => setNomName(e.target.value)} placeholder="Nome (ex: Short n' Sweet)" className={inputClass} />
              <input value={nomArtist} onChange={e => setNomArtist(e.target.value)} placeholder="Artista (opcional)" className={inputClass} />
              <input value={nomCover} onChange={e => setNomCover(e.target.value)} placeholder="URL da capa (opcional)" className={inputClass} />
              <button onClick={handleAddNominee} disabled={saving} className={btnClass}>{saving ? 'Adicionando...' : 'Adicionar Indicado'}</button>
            </div>
          )}

          {/* Delete nominees */}
          {section === 'delete-nominee' && (
            <div className="space-y-3 border-t border-zinc-700 pt-3">
              <p className="text-xs text-zinc-400 font-medium">Remover categoria ou indicado</p>
              {categories.map(cat => (
                <div key={cat.id} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-zinc-300 font-medium flex-1">{cat.name}</p>
                    <button onClick={() => handleDeleteCategory(cat.id)} disabled={saving} className="text-xs text-red-400 hover:text-red-300">apagar cat.</button>
                  </div>
                  {cat.nominees.map(n => (
                    <div key={n.id} className="flex items-center gap-2 pl-2">
                      <span className="text-xs text-zinc-500 flex-1 truncate">{n.name}</span>
                      <button onClick={() => handleDeleteNominee(n.id, n.name)} disabled={saving} className="text-xs text-red-400 hover:text-red-300 shrink-0">×</button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Reveal winners */}
          {section === 'reveal' && edition && (
            <div className="space-y-3 border-t border-zinc-700 pt-3">
              <p className="text-xs text-zinc-400 font-medium">Selecione os vencedores</p>
              {categories.map(cat => (
                <div key={cat.id} className="space-y-1">
                  <p className="text-xs text-zinc-300 font-medium">{cat.name}</p>
                  <select
                    value={revealMap[cat.id] ?? ''}
                    onChange={e => setRevealMap(prev => ({ ...prev, [cat.id]: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="">Selecione o vencedor</option>
                    {cat.nominees.map(n => (
                      <option key={n.id} value={n.id}>{n.name}{n.artist ? ` — ${n.artist}` : ''}</option>
                    ))}
                  </select>
                </div>
              ))}
              <button onClick={handleReveal} disabled={saving} className={btnClass}>
                {saving ? 'Revelando...' : '🏆 Revelar Vencedores'}
              </button>
            </div>
          )}

          {/* Category overview */}
          {categories.length > 0 && section === 'main' && (
            <div className="space-y-1 border-t border-zinc-700 pt-3">
              <p className="text-xs text-zinc-500">{categories.length} categorias</p>
              {categories.map(cat => (
                <p key={cat.id} className="text-xs text-zinc-400">
                  {cat.name} <span className="text-zinc-600">({cat.nominees.length} indicados, {cat.vote_count} votos)</span>
                </p>
              ))}
            </div>
          )}

          {allEditions.length > 1 && (
            <div className="border-t border-zinc-700 pt-3">
              <p className="text-xs text-zinc-500 mb-1">Todas as edições</p>
              {allEditions.map(e => (
                <p key={e.id} className="text-xs text-zinc-400">{e.year} · {e.status}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const inputClass = 'w-full rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-100 border border-zinc-700 focus:outline-none focus:border-[#D4537E]'
const btnClass   = 'w-full rounded-xl bg-[#D4537E] text-white py-2.5 text-sm font-semibold hover:bg-[#c44370] disabled:opacity-50 transition'

function ABtn({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg bg-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-600 transition disabled:opacity-50"
    >
      {children}
    </button>
  )
}
