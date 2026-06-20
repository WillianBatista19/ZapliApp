'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Post, Vibe } from '@/types'

const PAGE_SIZE = 20

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

export function useFeed() {
  const [posts,       setPosts]       = useState<Post[]>([])
  const [loading,     setLoading]     = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore,     setHasMore]     = useState(true)

  const supabase       = useMemo(() => createClient(), [])
  const cursorRef      = useRef<string | null>(null)  // created_at of the oldest loaded post
  const hasMoreRef     = useRef(true)
  const loadingMoreRef = useRef(false)

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

  const loadFeed = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('posts')
      .select(POST_SELECT)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)

    const rows = (data as unknown as Post[]) ?? []
    setPosts(rows)
    if (rows.length > 0) cursorRef.current = rows[rows.length - 1].created_at
    const more = rows.length === PAGE_SIZE
    hasMoreRef.current = more
    setHasMore(more)
    setLoading(false)
  }, [supabase])

  // Stable loadMore — checks refs internally so no stale closure issues
  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMoreRef.current || !cursorRef.current) return
    loadingMoreRef.current = true
    setLoadingMore(true)

    const { data } = await supabase
      .from('posts')
      .select(POST_SELECT)
      .order('created_at', { ascending: false })
      .lt('created_at', cursorRef.current)
      .limit(PAGE_SIZE)

    const rows = (data as unknown as Post[]) ?? []
    if (rows.length > 0) {
      setPosts(prev => [...prev, ...rows])
      cursorRef.current = rows[rows.length - 1].created_at
    }
    const more = rows.length === PAGE_SIZE
    hasMoreRef.current = more
    setHasMore(more)

    loadingMoreRef.current = false
    setLoadingMore(false)
  }, [supabase])

  useEffect(() => {
    loadFeed()

    // Batch rapid realtime inserts into a single state update
    const batch:   Post[]                            = []
    let   timer:   ReturnType<typeof setTimeout> | null = null

    function flush() {
      const toAdd = batch.splice(0)
      if (toAdd.length > 0) setPosts(prev => [...toAdd, ...prev])
      timer = null
    }

    function queuePost(post: Post) {
      batch.push(post)
      if (timer) clearTimeout(timer)
      timer = setTimeout(flush, 300)
    }

    const channel = supabase
      .channel('incelicas-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts' },
        async (payload) => {
          const post = await fetchFull(payload.new.id as string)
          if (post) queuePost(post)
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'posts' },
        (payload) => {
          setPosts(prev => prev.filter(p => p.id !== (payload.old as Post).id))
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'vibes' },
        (payload) => {
          const v = payload.new as Vibe
          setPosts(prev =>
            prev.map(p =>
              p.id === v.post_id
                ? { ...p, vibes: [...p.vibes.filter(x => x.user_id !== v.user_id), v] }
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
          setPosts(prev =>
            prev.map(p =>
              p.id === v.post_id
                ? { ...p, vibes: p.vibes.map(x => (x.id === v.id ? v : x)) }
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
          setPosts(prev =>
            prev.map(p =>
              p.id === v.post_id
                ? { ...p, vibes: p.vibes.filter(x => x.id !== v.id) }
                : p,
            ),
          )
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      if (timer) clearTimeout(timer)
    }
  }, [supabase, loadFeed, fetchFull])

  return { posts, loading, loadMore, hasMore, loadingMore }
}
