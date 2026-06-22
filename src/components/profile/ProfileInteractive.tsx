'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getOrCreateConversation } from '@/app/(app)/messages/actions'
import Avatar from '@/components/Avatar'
import FollowButton from '@/components/profile/FollowButton'
import FollowListModal from '@/components/profile/FollowListModal'
import StoryViewer from '@/components/stories/StoryViewer'
import VerifiedBadge from '@/components/VerifiedBadge'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/context/UserContext'
import { isVerified } from '@/lib/verified'
import type { Story, StoryGroup } from '@/types'

type Profile = {
  id:           string
  username:     string
  display_name: string | null
  avatar_url:   string | null
  bio:          string | null
}

type Props = {
  profile:               Profile
  currentUserId:         string
  currentUserUsername?:  string | null
  isOwnProfile:          boolean
  postCount:             number
  initialFollowerCount:  number
  followingCount:        number
  openStory?:            boolean
}

export default function ProfileInteractive({
  profile,
  currentUserId,
  currentUserUsername,
  isOwnProfile,
  postCount,
  initialFollowerCount,
  followingCount,
  openStory = false,
}: Props) {
  const router = useRouter()
  const { signOut } = useUser()
  const [msgLoading, setMsgLoading] = useState(false)
  const [followerCount, setFollowerCount] = useState(initialFollowerCount)
  const [activeModal,   setActiveModal]   = useState<'followers' | 'following' | null>(null)
  const [storyGroup,    setStoryGroup]    = useState<StoryGroup | null>(null)
  const [viewerOpen,    setViewerOpen]    = useState(false)
  const [viewedIds,     setViewedIds]     = useState<Set<string>>(new Set())

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('stories')
      .select('id, user_id, media_url, created_at, expires_at, profiles!stories_user_id_fkey(id, username, display_name, avatar_url)')
      .eq('user_id', profile.id)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setStoryGroup({
            user: {
              id:           profile.id,
              username:     profile.username,
              display_name: profile.display_name ?? null,
              avatar_url:   profile.avatar_url   ?? null,
            },
            stories: data as unknown as Story[],
          })
        }
      })
  }, [profile.id, profile.username, profile.display_name, profile.avatar_url])

  useEffect(() => {
    if (openStory && storyGroup) setViewerOpen(true)
  }, [openStory, storyGroup])

  async function handleSignOut() {
    await signOut()
    router.push('/login')
    router.refresh()
  }

  function handleFollowChange(isNowFollowing: boolean) {
    setFollowerCount(c => (isNowFollowing ? c + 1 : c - 1))
  }

  const name = profile.display_name || profile.username

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-6">

      {/* Avatar row */}
      <div className="flex items-start justify-between gap-4">
        {storyGroup ? (
          <button
            type="button"
            onClick={() => setViewerOpen(true)}
            aria-label={`Ver história de ${name}`}
            className="shrink-0 rounded-full bg-gradient-to-tr from-[#D4537E] to-[#7F77DD] p-[3px]"
          >
            <div className="rounded-full bg-zinc-900 p-[2px]">
              <Avatar src={profile.avatar_url} name={name} size="lg" />
            </div>
          </button>
        ) : (
          <div className="shrink-0">
            <Avatar src={profile.avatar_url} name={name} size="lg" />
          </div>
        )}

        {isOwnProfile ? (
          <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
            <Link
              href="/profile/edit"
              className="rounded-xl border border-zinc-600 px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-400 hover:text-zinc-100"
            >
              Editar perfil
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Sair"
              className="xl:hidden rounded-xl border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-500 transition-colors hover:border-red-800 hover:bg-red-950/40 hover:text-red-400"
            >
              Sair
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
            <FollowButton
              targetUserId={profile.id}
              currentUserId={currentUserId}
              onFollowChange={handleFollowChange}
            />
            <button
              type="button"
              disabled={msgLoading}
              onClick={async () => {
                setMsgLoading(true)
                try {
                  const result = await getOrCreateConversation(profile.id)
                  console.log('[Mensagem] result:', result)
                  if ('conversationId' in result) {
                    router.push(`/messages/${result.conversationId}`)
                  }
                } finally {
                  setMsgLoading(false)
                }
              }}
              className="rounded-xl border border-zinc-600 px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-400 hover:text-zinc-100 disabled:opacity-50"
            >
              {msgLoading ? '…' : '💬 Mensagem'}
            </button>
          </div>
        )}
      </div>

      {/* Name + username */}
      <div className="mt-4">
        <h1 className="flex items-center gap-2 text-xl font-bold text-zinc-100">
          {name}
          {isVerified(profile.username) && <VerifiedBadge className="h-5 w-5" />}
        </h1>
        <p className="text-sm text-zinc-500">@{profile.username}</p>
      </div>

      {/* Bio */}
      {profile.bio && (
        <p className="mt-3 text-sm leading-relaxed text-zinc-300">{profile.bio}</p>
      )}

      {/* Stats — followers and following are clickable to open the list modal */}
      <div className="mt-5 flex gap-6 border-t border-zinc-800 pt-4">
        <Stat value={postCount} label="Posts" />

        <button
          type="button"
          onClick={() => setActiveModal('followers')}
          className="text-left transition-opacity hover:opacity-70"
        >
          <Stat value={followerCount} label="Seguidores" />
        </button>

        <button
          type="button"
          onClick={() => setActiveModal('following')}
          className="text-left transition-opacity hover:opacity-70"
        >
          <Stat value={followingCount} label="Seguindo" />
        </button>
      </div>

      {activeModal && (
        <FollowListModal
          type={activeModal}
          profileId={profile.id}
          currentUserId={currentUserId}
          onClose={() => setActiveModal(null)}
        />
      )}

      {viewerOpen && storyGroup && (
        <StoryViewer
          groups={[storyGroup]}
          initialGroupIndex={0}
          currentUserId={currentUserId}
          currentUserUsername={currentUserUsername}
          viewedIds={viewedIds}
          onMarkViewed={(storyId) => {
            setViewedIds(prev => { const n = new Set(prev); n.add(storyId); return n })
          }}
          onStoryDeleted={(storyId) => {
            setStoryGroup(prev => {
              if (!prev) return null
              const remaining = prev.stories.filter(s => s.id !== storyId)
              return remaining.length > 0 ? { ...prev, stories: remaining } : null
            })
            setViewerOpen(false)
          }}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </div>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="text-lg font-bold text-zinc-100">{value.toLocaleString('pt-BR')}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  )
}
