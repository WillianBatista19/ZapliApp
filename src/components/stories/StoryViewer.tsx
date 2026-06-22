'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/components/Avatar'
import StoryViewersModal from '@/components/stories/StoryViewersModal'
import StoryLikersModal from '@/components/stories/StoryLikersModal'
import { relativeTime } from '@/lib/utils'
import type { StoryGroup } from '@/types'
import { createStoryLikeNotification } from '@/app/(app)/stories/actions'

const DURATION_MS = 5000

type Props = {
  groups:               StoryGroup[]
  initialGroupIndex:    number
  currentUserId:        string
  currentUserUsername?: string | null
  viewedIds:            Set<string>
  onMarkViewed:         (storyId: string) => void
  onStoryDeleted:       (storyId: string) => void
  onClose:              () => void
}

export default function StoryViewer({
  groups: initialGroups,
  initialGroupIndex,
  currentUserId,
  currentUserUsername,
  viewedIds,
  onMarkViewed,
  onStoryDeleted,
  onClose,
}: Props) {
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
  }, [])

  const [groups,    setGroups]    = useState(initialGroups)
  const [groupIdx,  setGroupIdx]  = useState(() => Math.min(initialGroupIndex, initialGroups.length - 1))
  const [storyIdx,  setStoryIdx]  = useState(() => {
    const g = initialGroups[Math.min(initialGroupIndex, initialGroups.length - 1)]
    const first = g?.stories.findIndex(s => !viewedIds.has(s.id)) ?? -1
    return first >= 0 ? first : 0
  })
  const [animating,        setAnimating]        = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting,         setDeleting]         = useState(false)
  const [liked,            setLiked]            = useState(false)
  const [likeCount,        setLikeCount]        = useState(0)
  const [viewCount,        setViewCount]        = useState(0)
  const [likePending,      setLikePending]      = useState(false)
  const [likeBounce,       setLikeBounce]       = useState(false)
  const [showViewers,      setShowViewers]      = useState(false)
  const [showLikers,       setShowLikers]       = useState(false)

  const groupIdxRef = useRef(groupIdx)
  const storyIdxRef = useRef(storyIdx)
  const groupsRef   = useRef(groups)
  useEffect(() => { groupIdxRef.current = groupIdx }, [groupIdx])
  useEffect(() => { storyIdxRef.current = storyIdx }, [storyIdx])
  useEffect(() => { groupsRef.current = groups },     [groups])

  const group = groups[groupIdx]
  const story = group?.stories[storyIdx]

  // ── Navigation ─────────────────────────────────────────────────────────────

  const goNext = useCallback(() => {
    const gi = groupIdxRef.current
    const si = storyIdxRef.current
    const gs = groupsRef.current
    const g  = gs[gi]
    if (!g) { onClose(); return }

    if (si < g.stories.length - 1) {
      setStoryIdx(si + 1)
    } else if (gi < gs.length - 1) {
      setGroupIdx(gi + 1)
      setStoryIdx(0)
    } else {
      onClose()
    }
  }, [onClose])

  const goPrev = useCallback(() => {
    const gi = groupIdxRef.current
    const si = storyIdxRef.current
    const gs = groupsRef.current

    if (si > 0) {
      setStoryIdx(si - 1)
    } else if (gi > 0) {
      const prevGroup = gs[gi - 1]
      setGroupIdx(gi - 1)
      setStoryIdx(prevGroup.stories.length - 1)
    }
  }, [])

  // ── Progress bar animation + auto-advance ──────────────────────────────────

  useEffect(() => {
    setAnimating(false)
    setConfirmingDelete(false)
    const t1 = setTimeout(() => setAnimating(true), 50)
    const t2 = setTimeout(goNext, DURATION_MS)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [groupIdx, storyIdx, goNext])

  // ── Mark story as viewed ───────────────────────────────────────────────────

  useEffect(() => {
    if (!story) return
    const storyId = story.id
    onMarkViewed(storyId)

    async function saveView() {
      const { error } = await supabase
        .from('story_views')
        .upsert({ story_id: storyId, user_id: currentUserId }, { onConflict: 'story_id,user_id', ignoreDuplicates: true })
      if (error) console.error('[StoryViewer] failed to save view:', error)
    }
    void saveView()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIdx, storyIdx])

  // ── Keyboard navigation ────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape')     { if (confirmingDelete) setConfirmingDelete(false); else onClose() }
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft')  goPrev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, goNext, goPrev, confirmingDelete])

  // ── Fetch likes + view count (exclude owner's own view) ───────────────────

  useEffect(() => {
    if (!story) return
    let live = true
    const sid     = story.id
    const ownerId = story.user_id

    setLiked(false)
    setLikeCount(0)
    setViewCount(0)

    void Promise.all([
      supabase
        .from('story_likes')
        .select('user_id', { count: 'exact', head: true })
        .eq('story_id', sid)
        .eq('user_id', currentUserId),
      supabase
        .from('story_likes')
        .select('user_id', { count: 'exact', head: true })
        .eq('story_id', sid),
      supabase
        .from('story_views')
        .select('user_id', { count: 'exact', head: true })
        .eq('story_id', sid)
        .neq('user_id', ownerId),  // exclude owner's own view
    ]).then(([myLike, allLikes, views]) => {
      if (!live) return
      setLiked((myLike.count ?? 0) > 0)
      setLikeCount(allLikes.count ?? 0)
      setViewCount(views.count ?? 0)
    })

    return () => { live = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIdx, storyIdx])

  // ── Delete own story ───────────────────────────────────────────────────────

  async function handleDeleteStory() {
    if (!story) return
    setDeleting(true)

    const { error } = await supabase.from('stories').delete().eq('id', story.id)

    if (!error) {
      onStoryDeleted(story.id)

      const newStories = group.stories.filter(s => s.id !== story.id)

      if (newStories.length === 0) {
        const newGroups = groups.filter((_, gi) => gi !== groupIdx)
        if (newGroups.length === 0) { onClose(); return }
        setGroups(newGroups)
        const nextGi = Math.min(groupIdx, newGroups.length - 1)
        setGroupIdx(nextGi)
        setStoryIdx(0)
      } else {
        const newGroups = groups.map((g, gi) =>
          gi === groupIdx ? { ...g, stories: newStories } : g,
        )
        setGroups(newGroups)
        setStoryIdx(Math.min(storyIdx, newStories.length - 1))
      }
    }

    setDeleting(false)
    setConfirmingDelete(false)
  }

  async function handleLike() {
    if (likePending || !story) return
    const wasLiked  = liked
    const prevCount = likeCount

    setLiked(!wasLiked)
    setLikeCount(wasLiked ? prevCount - 1 : prevCount + 1)
    setLikePending(true)
    if (!wasLiked) {
      setLikeBounce(true)
      setTimeout(() => setLikeBounce(false), 300)
    }

    if (wasLiked) {
      const { error } = await supabase
        .from('story_likes')
        .delete()
        .eq('story_id', story.id)
        .eq('user_id', currentUserId)
      if (error) { setLiked(wasLiked); setLikeCount(prevCount) }
    } else {
      const { error } = await supabase
        .from('story_likes')
        .insert({ story_id: story.id, user_id: currentUserId })
      if (error && error.code !== '23505') {
        setLiked(wasLiked); setLikeCount(prevCount)
      } else if (!error && story.user_id !== currentUserId) {
        await createStoryLikeNotification(story.user_id, story.id)
      }
    }

    setLikePending(false)
  }

  if (!story || !group) return null

  const profile        = story.profiles
  const name           = profile.display_name || profile.username
  const isOwnStory     = story.user_id === currentUserId
  const isModerator    = currentUserUsername === 'incelicasappoficial'
  const groupStories   = group.stories

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex h-screen w-screen items-center justify-center bg-black"
      role="dialog"
      aria-modal
      aria-label={`História de ${name}`}
    >
      <div className="relative h-full w-full max-w-[420px] overflow-hidden">

        <img
          key={story.id}
          src={story.media_url}
          alt={`História de ${name}`}
          className="h-full w-full object-contain"
          draggable={false}
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-black/80 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/50 to-transparent" />

        {/* ── Progress bars ─────────────────────────────────────────── */}
        <div key={`${groupIdx}-${storyIdx}`} className="absolute inset-x-0 top-0 z-30 flex gap-[3px] px-2 pt-2">
          {groupStories.map((_, i) => (
            <div key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
              <div
                className="h-full rounded-full bg-white"
                style={{
                  width: i < storyIdx ? '100%' : '0%',
                  ...(i === storyIdx && {
                    width:      animating ? '100%' : '0%',
                    transition: animating ? `width ${DURATION_MS}ms linear` : 'none',
                  }),
                }}
              />
            </div>
          ))}
        </div>

        {/* ── Author info + close ──────────────────────────────────── */}
        <div className="absolute inset-x-0 top-6 z-30 flex items-center gap-2 px-3 pt-1">
          <Avatar src={profile.avatar_url} name={name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight text-white">{name}</p>
            <p className="text-[10px] text-white/60">{relativeTime(story.created_at)}</p>
          </div>

          {(isOwnStory || isModerator) && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setConfirmingDelete(true) }}
              aria-label="Deletar história"
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-8 w-8 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* ── Tap zones ─────────────────────────────────────────────── */}
        <div className="absolute inset-x-0 top-0 bottom-14 z-20 flex" aria-hidden>
          <div className="flex-1 cursor-pointer" onClick={goPrev} />
          <div className="flex-1 cursor-pointer" onClick={goNext} />
        </div>

        {/* ── Delete confirmation ────────────────────────────────────── */}
        {confirmingDelete && (
          <div
            className="absolute inset-0 z-40 flex items-end justify-center pb-12"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-4 w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900/95 p-5 text-center shadow-2xl backdrop-blur-sm">
              <p className="mb-4 text-sm text-zinc-200">Deletar esta história?</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={deleting}
                  className="flex-1 rounded-xl bg-zinc-800 py-2 text-sm font-semibold text-zinc-300 transition-colors hover:bg-zinc-700 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDeleteStory}
                  disabled={deleting}
                  className="flex-1 rounded-xl bg-[#D4537E] py-2 text-sm font-semibold text-white transition-colors hover:bg-[#c0446e] disabled:opacity-50"
                >
                  {deleting ? '…' : 'Deletar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Engagement stats (z-40) ──────────────────────────────── */}
        <div className="absolute inset-x-0 bottom-0 z-40 flex items-center px-4 py-4 pointer-events-auto">
          {isOwnStory ? (
            <>
              {/* Views — clickable, opens viewers list */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowViewers(true) }}
                className="flex items-center gap-1 rounded-full px-2 py-1 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white/90"
              >
                👁 {viewCount} {viewCount === 1 ? 'visualização' : 'visualizações'}
              </button>

              {/* Likes — clickable if count > 0, opens likers list */}
              {likeCount > 0 ? (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setShowLikers(true) }}
                  className="ml-3 flex items-center gap-1 rounded-full px-2 py-1 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white/90"
                >
                  ❤️ {likeCount} {likeCount === 1 ? 'curtida' : 'curtidas'}
                </button>
              ) : (
                <span className="pointer-events-none ml-3 text-xs text-white/60">
                  ❤️ 0 curtidas
                </span>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); void handleLike() }}
              disabled={likePending}
              aria-label={liked ? 'Descurtir história' : 'Curtir história'}
              className="ml-auto flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors hover:bg-white/10"
            >
              <HeartIcon
                filled={liked}
                className={`h-6 w-6 transition-transform duration-150 ${likeBounce ? 'scale-125' : 'scale-100'}`}
              />
              {likeCount > 0 && (
                <span className="min-w-[1rem] text-xs font-semibold text-white tabular-nums">
                  {likeCount}
                </span>
              )}
            </button>
          )}
        </div>

      </div>

      <div className="pointer-events-none absolute inset-y-0 left-0 right-0 -z-10 bg-black" />

      {showViewers && story && (
        <StoryViewersModal
          storyId={story.id}
          storyOwnerId={story.user_id}
          onClose={() => setShowViewers(false)}
        />
      )}

      {showLikers && story && (
        <StoryLikersModal
          storyId={story.id}
          onClose={() => setShowLikers(false)}
        />
      )}
    </div>,
    document.body,
  )
}

// ── Icons ──────────────────────────────────────────────────────────────────

function HeartIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={filled ? '#D4537E' : 'none'}
      stroke={filled ? '#D4537E' : 'white'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}
