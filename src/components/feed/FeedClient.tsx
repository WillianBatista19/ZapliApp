'use client'

import { useEffect, useRef, useState } from 'react'
import { useFeed } from '@/hooks/useFeed'
import PostCard from '@/components/feed/PostCard'

type Props = { currentUserId: string; currentUserUsername?: string | null }

// ─── VirtualPost — collapses posts far outside the viewport ──────────────────
// Keeps the same ref div always in DOM (always observed) so scroll position
// is preserved when the post is collapsed to a height placeholder.

function VirtualPost({ children }: { children: React.ReactNode }) {
  const ref       = useRef<HTMLDivElement>(null)
  const heightRef = useRef(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
        } else {
          // Capture height before hiding so the placeholder holds scroll position
          heightRef.current = entry.boundingClientRect.height || el.offsetHeight
          setVisible(false)
        }
      },
      // Large margin so posts only collapse when truly far from view
      { rootMargin: '1000px 0px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={visible ? undefined : { height: heightRef.current, contain: 'strict' }}
    >
      {visible ? children : null}
    </div>
  )
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex gap-3">
        <div className="h-10 w-10 shrink-0 rounded-full bg-zinc-800" />
        <div className="flex-1 space-y-2 py-1">
          <div className="h-3 w-1/3 rounded bg-zinc-800" />
          <div className="h-3 w-2/3 rounded bg-zinc-800" />
          <div className="h-3 w-1/2 rounded bg-zinc-800" />
        </div>
      </div>
    </div>
  )
}

// ─── FeedClient ───────────────────────────────────────────────────────────────

export default function FeedClient({ currentUserId, currentUserUsername }: Props) {
  const { posts, loading, loadMore, hasMore, loadingMore } = useFeed()
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Trigger loadMore when the sentinel div enters the viewport
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore() },
      { rootMargin: '400px' },
    )
    obs.observe(sentinel)
    return () => obs.disconnect()
  }, [loadMore])

  if (loading) {
    return (
      <div className="space-y-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 px-6 py-12 text-center">
        <p className="mb-2 text-2xl">✨</p>
        <p className="text-sm text-zinc-400">
          Nenhuma vibe por aqui ainda. Seja a primeira a postar, incelica!
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {posts.map(post => (
        <VirtualPost key={post.id}>
          <PostCard post={post} currentUserId={currentUserId} currentUserUsername={currentUserUsername} />
        </VirtualPost>
      ))}

      {/* Infinite-scroll sentinel — loadMore fires when this enters view */}
      <div ref={sentinelRef} />

      {loadingMore && (
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {!hasMore && posts.length > 0 && (
        <p className="py-6 text-center text-xs text-zinc-600">
          Você chegou ao fim do feed, incelica! 🎉
        </p>
      )}
    </div>
  )
}
