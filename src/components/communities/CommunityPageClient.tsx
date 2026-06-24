'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Community, CommunityMemberRow, CommunityPost, CommunityRole } from '@/types'
import CommunityPostCard from './CommunityPostCard'
import CommunityPostComposer from './CommunityPostComposer'
import MembersTab from './MembersTab'
import JoinButton from './JoinButton'
import CommunityAvatarModal from './CommunityAvatarModal'
import { toggleNotificationsMuted } from '@/app/(app)/communities/actions'

type Tab = 'posts' | 'members' | 'jogos'

interface Props {
  community:          Community
  posts:              CommunityPost[]
  members:            CommunityMemberRow[]
  currentUserId:      string | null
  viewerRole:         CommunityRole | null
  canPost:            boolean
  notificationsMuted: boolean
  activeSurvivorEvent?: { album_name: string; artist_name: string; current_round: number } | null
}

export default function CommunityPageClient({
  community, posts, members, currentUserId, viewerRole, canPost, notificationsMuted,
  activeSurvivorEvent,
}: Props) {
  const router = useRouter()
  const [tab, setTab]                 = useState<Tab>('posts')
  const [showAvatarModal, setShowAvatarModal] = useState(false)
  const [muted, setMuted]             = useState(notificationsMuted)
  const [muteLoading, setMuteLoading] = useState(false)
  const [toast, setToast]             = useState<string | null>(null)

  const isMember = !!viewerRole
  const isOwner  = viewerRole === 'owner'

  // Auto-dismiss toast after 2.5 s
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  function handleNewPost() {
    router.refresh()
  }

  async function handleMuteToggle() {
    if (muteLoading) return
    const next = !muted
    setMuted(next)           // optimistic
    setMuteLoading(true)
    try {
      await toggleNotificationsMuted(community.id, next)
      setToast(next ? 'Notificações silenciadas' : 'Notificações ativadas')
    } catch {
      setMuted(!next)        // revert
    } finally {
      setMuteLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Back link */}
      <Link
        href="/communities"
        className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors text-sm"
      >
        <ArrowLeftIcon className="h-4 w-4 shrink-0" />
        <span className="hidden sm:inline">Comunidades</span>
      </Link>

      {/* Header */}
      <div className="rounded-xl overflow-hidden bg-zinc-900/60 border border-zinc-800">
        {community.banner_url && (
          <div
            className="h-32 w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${community.banner_url})` }}
          />
        )}
        <div className="p-4 flex items-start gap-3">
          {community.avatar_url ? (
            <button
              type="button"
              onClick={() => setShowAvatarModal(true)}
              className="shrink-0 rounded-xl transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4537E]"
              aria-label="Ver foto da comunidade"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={community.avatar_url}
                alt={community.name}
                className="w-14 h-14 rounded-xl object-cover"
              />
            </button>
          ) : (
            <div className="w-14 h-14 rounded-xl bg-[#7F77DD]/30 flex items-center justify-center text-2xl shrink-0">
              🏘️
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-zinc-100">{community.name}</h1>
            {community.description && (
              <p className="text-sm text-zinc-400 mt-0.5">{community.description}</p>
            )}
            <p className="text-xs text-zinc-500 mt-1">{members.length} membros</p>
          </div>

          {currentUserId && (
            <div className="flex items-center gap-2 shrink-0">
              {/* Notification mute toggle — members only */}
              {isMember && (
                <button
                  type="button"
                  onClick={handleMuteToggle}
                  disabled={muteLoading}
                  aria-label={muted ? 'Ativar notificações' : 'Silenciar notificações'}
                  title={muted ? 'Ativar notificações' : 'Silenciar notificações'}
                  className="rounded-xl bg-white/10 p-2 text-zinc-300 hover:text-white transition-colors disabled:opacity-50"
                >
                  {muted ? <BellMutedIcon className="h-4 w-4" /> : <BellIcon className="h-4 w-4" />}
                </button>
              )}

              {isOwner && (
                <a
                  href={`/communities/${community.slug}/settings`}
                  className="rounded-xl bg-white/10 px-3 py-2 text-sm text-zinc-300 hover:text-white"
                >
                  ⚙️
                </a>
              )}

              <JoinButton communityId={community.id} isMember={isMember} isOwner={isOwner} />
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-800">
        {(['posts', 'members', ...(community.slug === 'musica' ? ['jogos' as Tab] : [])] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition
              ${tab === t ? 'text-[#D4537E] border-b-2 border-[#D4537E]' : 'text-zinc-400 hover:text-white'}`}
          >
            {t === 'posts' ? 'Posts' : t === 'members' ? `Membros (${members.length})` : '🎮 Jogos'}
          </button>
        ))}
      </div>

      {tab === 'posts' && (
        <div className="space-y-4">
          {canPost && currentUserId && (
            <CommunityPostComposer communityId={community.id} currentUserId={currentUserId} onPost={handleNewPost} />
          )}
          {posts.length === 0 ? (
            <p className="text-zinc-500 text-sm text-center py-10">
              Nenhum post ainda. Seja a primeira a postar!
            </p>
          ) : (
            posts.map(p => (
              <CommunityPostCard
                key={p.id}
                post={p}
                currentUserId={currentUserId}
                isOwnerOrMod={viewerRole === 'owner' || viewerRole === 'moderator'}
              />
            ))
          )}
        </div>
      )}

      {tab === 'jogos' && (
        <div className="space-y-4">
          <Link
            href="/communities/musica/avaliar"
            className="flex items-center gap-4 rounded-xl bg-zinc-900/60 border border-zinc-800 p-4 hover:bg-zinc-800/60 transition-colors"
          >
            <div className="w-14 h-14 rounded-xl bg-[#D4537E]/20 flex items-center justify-center text-3xl shrink-0">
              🎵
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-zinc-100">Avaliar Álbum</p>
              <p className="text-sm text-zinc-400 mt-0.5">
                Dê nota para cada faixa, escolha seus favoritos e veja o ranking da comunidade
              </p>
            </div>
            <span className="text-zinc-600 shrink-0">→</span>
          </Link>

          <Link
            href="/communities/musica/survivor"
            className="flex items-center gap-4 rounded-xl bg-zinc-900/60 border border-zinc-800 p-4 hover:bg-zinc-800/60 transition-colors"
          >
            <div className="w-14 h-14 rounded-xl bg-[#7F77DD]/20 flex items-center justify-center text-3xl shrink-0">
              🏆
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-zinc-100">Survivor Musical</p>
              {activeSurvivorEvent ? (
                <p className="text-sm text-[#7F77DD] mt-0.5 truncate">
                  {activeSurvivorEvent.album_name} · Rodada {activeSurvivorEvent.current_round}
                </p>
              ) : (
                <p className="text-sm text-zinc-400 mt-0.5">
                  Nenhum evento ativo
                </p>
              )}
              <p className="text-xs text-zinc-500 mt-0.5">
                Vote para eliminar a pior faixa de cada rodada
              </p>
            </div>
            <span className="text-zinc-600 shrink-0">→</span>
          </Link>

          <Link
            href="/communities/musica/grammy"
            className="flex items-center gap-4 rounded-xl bg-zinc-900/60 border border-zinc-800 p-4 hover:bg-zinc-800/60 transition-colors"
          >
            <div className="w-14 h-14 rounded-xl bg-yellow-500/10 flex items-center justify-center text-3xl shrink-0">
              🎙️
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-zinc-100">Grammy Predictions</p>
              <p className="text-sm text-zinc-400 mt-0.5">
                Faça suas previsões e veja quem acertou mais
              </p>
            </div>
            <span className="text-zinc-600 shrink-0">→</span>
          </Link>
        </div>
      )}

      {tab === 'members' && (
        <MembersTab
          communityId={community.id}
          members={members}
          currentUserId={currentUserId}
          viewerRole={viewerRole}
          postPermission={community.post_permission}
        />
      )}

      {showAvatarModal && community.avatar_url && (
        <CommunityAvatarModal
          src={community.avatar_url}
          name={community.name}
          onClose={() => setShowAvatarModal(false)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 whitespace-nowrap rounded-xl bg-zinc-800 px-4 py-2 text-sm text-white shadow-xl">
          {toast}
        </div>
      )}
    </div>
  )
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  )
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function BellMutedIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      <path d="M18.63 13A17.9 17.9 0 0 1 18 8" />
      <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" />
      <path d="M18 8a6 6 0 0 0-9.33-5" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}
