'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/components/Avatar'
import StoryViewer from '@/components/stories/StoryViewer'
import type { Story, StoryGroup, StoryProfile } from '@/types'

type Props = { currentUserId: string; currentUserUsername?: string | null }

export default function StoriesBar({ currentUserId, currentUserUsername }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const fileRef  = useRef<HTMLInputElement>(null)

  const [myProfile,         setMyProfile]         = useState<StoryProfile | null>(null)
  const [myStories,         setMyStories]         = useState<Story[]>([])
  const [others,            setOthers]            = useState<StoryGroup[]>([])
  const [viewedIds,         setViewedIds]         = useState<Set<string>>(new Set())
  const [activeGroupIndex,  setActiveGroupIndex]  = useState<number | null>(null)
  const [uploading,         setUploading]         = useState(false)
  const [loading,           setLoading]           = useState(true)

  const loadStories = useCallback(async () => {
    const now = new Date().toISOString()

    const [storiesRes, viewsRes, profileRes] = await Promise.all([
      supabase
        .from('stories')
        .select('id, user_id, media_url, created_at, expires_at, profiles!stories_user_id_fkey(id, username, display_name, avatar_url)')
        .gt('expires_at', now)
        .order('created_at', { ascending: true }),
      supabase
        .from('story_views')
        .select('story_id')
        .eq('user_id', currentUserId),
      supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .eq('id', currentUserId)
        .single(),
    ])

    console.log('[StoriesBar] loadStories results', {
      storiesError: storiesRes.error,
      storiesCount: storiesRes.data?.length ?? 0,
      stories: storiesRes.data,
      viewsError: viewsRes.error,
      profileError: profileRes.error,
      profile: profileRes.data,
    })

    const allStories = (storiesRes.data as unknown as Story[] | null) ?? []
    const viewed     = new Set((viewsRes.data ?? []).map(v => (v as { story_id: string }).story_id))
    const profile    = profileRes.data as StoryProfile | null

    setMyProfile(profile)
    setViewedIds(viewed)

    const mine: Story[]                        = []
    const groupMap: Record<string, StoryGroup> = {}

    for (const s of allStories) {
      if (s.user_id === currentUserId) {
        mine.push(s)
      } else {
        // profiles from PostgREST may come back as an array for some FK directions
        const rawProfiles = s.profiles as unknown as StoryProfile | StoryProfile[]
        const user = Array.isArray(rawProfiles) ? rawProfiles[0] : rawProfiles
        if (!user) continue  // skip if profile join failed (FK not yet pointing to profiles)
        if (!groupMap[s.user_id]) {
          groupMap[s.user_id] = { user, stories: [] }
        }
        groupMap[s.user_id].stories.push(s)
      }
    }

    setMyStories(mine)

    const sorted = Object.values(groupMap).sort((a, b) => {
      const aUnseen = a.stories.some(s => !viewed.has(s.id))
      const bUnseen = b.stories.some(s => !viewed.has(s.id))
      if (aUnseen !== bUnseen) return aUnseen ? -1 : 1
      const aLast = a.stories.at(-1)?.created_at ?? ''
      const bLast = b.stories.at(-1)?.created_at ?? ''
      return bLast.localeCompare(aLast)
    })

    setOthers(sorted)
    setLoading(false)
  }, [supabase, currentUserId])

  useEffect(() => { loadStories() }, [loadStories])

  // viewerGroups: current user's group first (if they have stories), then others.
  // Fall back to the profile embedded in the story itself if the separate fetch failed.
  const viewerGroups = useMemo<StoryGroup[]>(() => {
    if (myStories.length > 0) {
      const rawEmbedded = myStories[0].profiles as unknown as StoryProfile | StoryProfile[]
      const embedded    = Array.isArray(rawEmbedded) ? rawEmbedded[0] : rawEmbedded
      const groupUser   = myProfile ?? embedded ?? null
      if (groupUser) {
        return [{ user: groupUser, stories: myStories }, ...others]
      }
    }
    return others
  }, [myProfile, myStories, others])

  const handleMarkViewed = useCallback((storyId: string) => {
    setViewedIds(prev => {
      const next = new Set(prev)
      next.add(storyId)
      return next
    })
  }, [])

  const handleStoryDeleted = useCallback((storyId: string) => {
    setMyStories(prev => prev.filter(s => s.id !== storyId))
    // Background refresh to keep the bar accurate
    loadStories()
  }, [loadStories])

  const closeViewer = useCallback(() => setActiveGroupIndex(null), [])

  useEffect(() => {
    console.log('[StoriesBar] viewerGroups updated', {
      count: viewerGroups.length,
      groups: viewerGroups,
      myStories: myStories.length,
      myProfile,
    })
  }, [viewerGroups, myStories, myProfile])

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploading(true)

    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `${currentUserId}/${Date.now()}.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from('stories')
      .upload(path, file, { contentType: file.type })

    if (uploadErr) {
      console.error('[StoriesBar] storage upload error', uploadErr)
    } else {
      const { data: { publicUrl } } = supabase.storage.from('stories').getPublicUrl(path)
      console.log('[StoriesBar] uploading to stories table, publicUrl:', publicUrl)
      const { error: insertErr } = await supabase
        .from('stories')
        .insert({ user_id: currentUserId, media_url: publicUrl })
      if (insertErr) {
        console.error('[StoriesBar] stories insert error', insertErr)
      } else {
        console.log('[StoriesBar] story inserted successfully, reloading...')
        await loadStories()
      }
    }

    setUploading(false)
  }

  const myHasStories = myStories.length > 0
  const myHasUnseen  = myStories.some(s => !viewedIds.has(s.id))

  // Index of the current user's group in viewerGroups (0 if present, else -1)
  const myGroupIndex = myHasStories ? 0 : -1

  if (loading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex shrink-0 flex-col items-center gap-1.5">
            <div className="h-14 w-14 animate-pulse rounded-full bg-zinc-800" />
            <div className="h-2 w-12 animate-pulse rounded bg-zinc-800" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      <div
        className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="list"
        aria-label="Stories"
      >
        {/* ── Current user slot ─────────────────────────────────── */}
        <div className="flex shrink-0 flex-col items-center gap-1.5" role="listitem">
          <div className="relative">
            <button
              type="button"
              aria-label="Ver sua história"
              onClick={() => {
                console.log('[StoriesBar] my avatar click', { myHasStories, myGroupIndex, viewerGroups })
                if (myHasStories) setActiveGroupIndex(myGroupIndex)
              }}
            >
              {myHasStories ? (
                <RingWrapper seen={!myHasUnseen}>
                  <Avatar src={myProfile?.avatar_url} name={myProfile?.display_name ?? 'Eu'} size="lg" />
                </RingWrapper>
              ) : (
                <div className="rounded-full border-2 border-dashed border-zinc-700 p-[3px]">
                  <Avatar src={myProfile?.avatar_url} name={myProfile?.display_name ?? 'Eu'} size="lg" />
                </div>
              )}
            </button>

            {/* Add-story badge — always visible */}
            <button
              type="button"
              aria-label="Adicionar story"
              disabled={uploading}
              onClick={(e) => { e.stopPropagation(); fileRef.current?.click() }}
              className="absolute -bottom-0.5 -right-0.5 z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 border-zinc-950 bg-[#D4537E] text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {uploading
                ? <svg className="h-2.5 w-2.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" /></svg>
                : <span className="text-[10px] font-bold leading-none">+</span>
              }
            </button>
          </div>
          <span className="max-w-[60px] truncate text-[10px] text-zinc-500">Sua história</span>
        </div>

        {/* ── Other users ───────────────────────────────────────── */}
        {others.map((group, i) => {
          // In viewerGroups, others start at index 1 if myGroup exists, else at 0
          const viewerIndex = myHasStories ? i + 1 : i
          const unseen = group.stories.some(s => !viewedIds.has(s.id))
          const name   = group.user.display_name || group.user.username
          return (
            <div key={group.user.id} className="flex shrink-0 flex-col items-center gap-1.5" role="listitem">
              <button
                type="button"
                aria-label={`Ver história de ${name}`}
                onClick={() => {
                  console.log('[StoriesBar] other avatar click', { name, viewerIndex, viewerGroups })
                  setActiveGroupIndex(viewerIndex)
                }}
              >
                <RingWrapper seen={!unseen}>
                  <Avatar src={group.user.avatar_url} name={name} size="lg" />
                </RingWrapper>
              </button>
              <span className="max-w-[60px] truncate text-[10px] text-zinc-500">{name}</span>
            </div>
          )
        })}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {activeGroupIndex !== null && console.log('[StoriesBar] opening viewer', { activeGroupIndex, viewerGroupsLen: viewerGroups.length, viewerGroups }) as unknown as null}
      {activeGroupIndex !== null && (
        <StoryViewer
          groups={viewerGroups}
          initialGroupIndex={activeGroupIndex}
          currentUserId={currentUserId}
          currentUserUsername={currentUserUsername}
          viewedIds={viewedIds}
          onMarkViewed={handleMarkViewed}
          onStoryDeleted={handleStoryDeleted}
          onClose={closeViewer}
        />
      )}
    </>
  )
}

// ── Ring wrapper ───────────────────────────────────────────────────────────

function RingWrapper({ seen, children }: { seen: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`rounded-full p-[2.5px] ${
        seen
          ? 'bg-zinc-700 opacity-60'
          : 'bg-gradient-to-tr from-[#D4537E] to-[#7F77DD]'
      }`}
    >
      <div className="rounded-full bg-zinc-950 p-[2px]">
        {children}
      </div>
    </div>
  )
}
