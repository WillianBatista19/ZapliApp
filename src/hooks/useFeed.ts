'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Category, Post, Vibe } from '@/types'

const POST_SELECT = `
  id, user_id, content, image_url, spotify_url, youtube_url, category, created_at,
  repost_comment, repost_count,
  profiles (id, username, display_name, avatar_url, bio, created_at),
  vibes (id, post_id, user_id, type, created_at),
  original_post:repost_of (
    id, user_id, content, image_url, spotify_url, youtube_url, category, created_at,
    profiles (id, username, display_name, avatar_url, bio, created_at)
  )
` as const

export function useFeed(category: Category | null = null) {
  const [posts,   setPosts]   = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const supabase              = useMemo(() => createClient(), [])

  const fetchFull = useCallback(
    async (postId: string): Promise<Post | null> => {
      const { data } = await supabase
        .from('posts')
        .select(POST_SELECT)
        .eq('id', postId)
        .single()
      return data as unknown as Post | null
    },
    [supabase],
  )

  // loadFeed captures the current category so the effect re-runs whenever
  // the category changes (because loadFeed gets a new reference).
  const loadFeed = useCallback(async () => {
    setLoading(true)

    let query = supabase
      .from('posts')
      .select(POST_SELECT)
      .order('created_at', { ascending: false })
      .limit(50)

    if (category) query = query.eq('category', category)

    const { data } = await query
    setPosts((data as unknown as Post[]) ?? [])
    setLoading(false)
  }, [supabase, category])

  useEffect(() => {
    loadFeed()

    // Use a unique channel name per filter so Supabase doesn't reuse a
    // stale channel when the category changes mid-session.
    const channel = supabase
      .channel(`incelicas-feed-${category ?? 'all'}`)
      // New post → fetch with full joins, then prepend if it passes the filter
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts' },
        async (payload) => {
          if (category && (payload.new as Post).category !== category) return
          const post = await fetchFull(payload.new.id as string)
          if (post) setPosts((prev) => [post, ...prev])
        },
      )
      // Deleted post → remove
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'posts' },
        (payload) => {
          setPosts((prev) => prev.filter((p) => p.id !== (payload.old as Post).id))
        },
      )
      // Vibe INSERT → patch the vibes array (enforces one-vibe-per-user client-side)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'vibes' },
        (payload) => {
          const v = payload.new as Vibe
          setPosts((prev) =>
            prev.map((p) =>
              p.id === v.post_id
                ? { ...p, vibes: [...p.vibes.filter((x) => x.user_id !== v.user_id), v] }
                : p,
            ),
          )
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'vibes' },
        (payload) => {
          const v = payload.new as Vibe
          setPosts((prev) =>
            prev.map((p) =>
              p.id === v.post_id
                ? { ...p, vibes: p.vibes.map((x) => (x.id === v.id ? v : x)) }
                : p,
            ),
          )
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'vibes' },
        (payload) => {
          const v = payload.old as Vibe
          setPosts((prev) =>
            prev.map((p) =>
              p.id === v.post_id
                ? { ...p, vibes: p.vibes.filter((x) => x.id !== v.id) }
                : p,
            ),
          )
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, loadFeed, fetchFull, category])

  return { posts, loading }
}
