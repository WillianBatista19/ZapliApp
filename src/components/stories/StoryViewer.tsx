'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/components/Avatar'
import { relativeTime } from '@/lib/utils'
import type { Story } from '@/types'

type Props = {
  stories:       Story[]
  viewedIds:     Set<string>
  currentUserId: string
  onMarkViewed:  (storyId: string) => void
  onClose:       () => void
}

export default function StoryViewer({ stories, viewedIds, currentUserId, onMarkViewed, onClose }: Props) {
  const supabase = useMemo(() => createClient(), [])

  const [index,     setIndex]     = useState(() => {
    const i = stories.findIndex(s => !viewedIds.has(s.id))
    return i >= 0 ? i : 0
  })
  const [animating, setAnimating] = useState(false)

  const indexRef = useRef(index)
  useEffect(() => { indexRef.current = index }, [index])

  const story = stories[index]

  // ── Progress animation + auto-advance timer ──────────────────────────────

  useEffect(() => {
    setAnimating(false)
    const t1 = setTimeout(() => setAnimating(true), 50)
    const t2 = setTimeout(() => {
      if (indexRef.current < stories.length - 1) setIndex(i => i + 1)
      else onClose()
    }, 3000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [index, stories.length, onClose])

  // ── Mark current story viewed ────────────────────────────────────────────

  useEffect(() => {
    if (!story) return
    onMarkViewed(story.id)
    void supabase
      .from('story_views')
      .upsert({ story_id: story.id, user_id: currentUserId }, { onConflict: 'story_id,user_id', ignoreDuplicates: true })
  }, [story?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Navigation helpers ───────────────────────────────────────────────────

  const goPrev = useCallback(() => {
    setIndex(i => Math.max(0, i - 1))
  }, [])

  const goNext = useCallback(() => {
    if (indexRef.current < stories.length - 1) setIndex(i => i + 1)
    else onClose()
  }, [stories.length, onClose])

  // ── Keyboard navigation ──────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape')     onClose()
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft')  goPrev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, goNext, goPrev])

  if (!story) return null

  const profile = story.profiles
  const name    = profile.display_name || profile.username

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black"
      role="dialog"
      aria-modal
      aria-label={`História de ${name}`}
    >
      <div className="relative h-full w-full max-w-sm overflow-hidden">

        {/* Story image */}
        <img
          key={story.id}
          src={story.media_url}
          alt={`História de ${name}`}
          className="h-full w-full object-cover"
          draggable={false}
        />

        {/* Shadow gradients for UI legibility */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/70 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/30 to-transparent" />

        {/* ── Progress bars (z-30 so click zones below don't block) ── */}
        <div className="absolute inset-x-0 top-0 z-30 flex gap-1 px-2 pt-2">
          {stories.map((_, i) => (
            <div key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
              <div
                className="h-full rounded-full bg-white"
                style={{
                  width: i < index ? '100%' : '0%',
                  ...(i === index && {
                    width: animating ? '100%' : '0%',
                    transition: animating ? 'width 3s linear' : 'none',
                  }),
                }}
              />
            </div>
          ))}
        </div>

        {/* ── Author + close (z-30) ────────────────────────────── */}
        <div className="absolute inset-x-0 top-5 z-30 flex items-center gap-2 px-3 pt-2">
          <Avatar src={profile.avatar_url} name={name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight text-white">{name}</p>
            <p className="text-[10px] text-white/60">{relativeTime(story.created_at)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-8 w-8 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="h-5 w-5" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ── Tap zones: left = prev, right = next (z-20, below UI) ── */}
        <div className="absolute inset-0 z-20 flex" aria-hidden>
          <div className="flex-1 cursor-pointer" onClick={goPrev} />
          <div className="flex-1 cursor-pointer" onClick={goNext} />
        </div>

      </div>
    </div>
  )
}
