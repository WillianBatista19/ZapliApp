'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/components/Avatar'
import StoryViewer from '@/components/stories/StoryViewer'
import type { Story, StoryProfile } from '@/types'

type StoryGroup = {
  user:    StoryProfile
  stories: Story[]
}

type Props = { currentUserId: string }

export default function StoriesBar({ currentUserId }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const fileRef  = useRef<HTMLInputElement>(null)

  const [myProfile,    setMyProfile]    = useState<StoryProfile | null>(null)
  const [myStories,    setMyStories]    = useState<Story[]>([])
  const [others,       setOthers]       = useState<StoryGroup[]>([])
  const [viewedIds,    setViewedIds]    = useState<Set<string>>(new Set())
  const [activeUserId, setActiveUserId] = useState<string | null>(null)
  const [uploading,    setUploading]    = useState(false)
  const [loading,      setLoading]      = useState(true)

  const loadStories = useCallback(async () => {
    const now = new Date().toISOString()

    const [storiesRes, viewsRes, profileRes] = await Promise.all([
      supabase
        .from('stories')
        .select('id, user_id, media_url, created_at, expires_at, profiles(id, username, display_name, avatar_url)')
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
        if (!groupMap[s.user_id]) {
          groupMap[s.user_id] = { user: s.profiles, stories: [] }
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

  const handleMarkViewed = useCallback((storyId: string) => {
    setViewedIds(prev => {
      const next = new Set(prev)
      next.add(storyId)
      return next
    })
  }, [])

  const closeViewer = useCallback(() => setActiveUserId(null), [])

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

    if (!uploadErr) {
      const { data: { publicUrl } } = supabase.storage.from('stories').getPublicUrl(path)
      await supabase.from('stories').insert({ user_id: currentUserId, media_url: publicUrl })
      await loadStories()
    }

    setUploading(false)
  }

  // Build the flat list used by the viewer (current user first, then others)
  const viewerGroups = useMemo<StoryGroup[]>(() => {
    const myGroup: StoryGroup | null =
      myProfile && myStories.length > 0
        ? { user: myProfile, stories: myStories }
        : null
    return myGroup ? [myGroup, ...others] : others
  }, [myProfile, myStories, others])

  const activeGroup = viewerGroups.find(g => g.user.id === activeUserId) ?? null

  const myHasStories = myStories.length > 0
  const myHasUnseen  = myStories.some(s => !viewedIds.has(s.id))

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
              aria-label={myHasStories ? 'Ver sua história' : 'Adicionar história'}
              onClick={() => {
                if (myHasStories) setActiveUserId(currentUserId)
                else fileRef.current?.click()
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

            {/* Add-story badge */}
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
        {others.map(group => {
          const unseen = group.stories.some(s => !viewedIds.has(s.id))
          const name   = group.user.display_name || group.user.username
          return (
            <div key={group.user.id} className="flex shrink-0 flex-col items-center gap-1.5" role="listitem">
              <button
                type="button"
                aria-label={`Ver história de ${name}`}
                onClick={() => setActiveUserId(group.user.id)}
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

      {activeGroup && (
        <StoryViewer
          stories={activeGroup.stories}
          viewedIds={viewedIds}
          currentUserId={currentUserId}
          onMarkViewed={handleMarkViewed}
          onClose={closeViewer}
        />
      )}
    </>
  )
}

// ── Ring wrapper (gradient = unseen, gray = seen) ──────────────────────────

function RingWrapper({ seen, children }: { seen: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`rounded-full p-[2.5px] ${
        seen
          ? 'bg-zinc-700 opacity-60'
          : 'bg-gradient-to-tr from-[#D4537E] to-[#7F77DD]'
      }`}
    >
      <div className="rounded-full p-[2px] bg-zinc-950">
        {children}
      </div>
    </div>
  )
}
