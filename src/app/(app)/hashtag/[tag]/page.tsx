import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PostCard from '@/components/feed/PostCard'
import HashtagFilter from '@/components/feed/HashtagFilter'
import TrendingSidebar from '@/components/sidebar/TrendingSidebar'
import WhoToFollow from '@/components/sidebar/WhoToFollow'
import type { Post } from '@/types'

// Keep in sync with useFeed.ts
const POST_SELECT = `
  id, user_id, content, image_url, spotify_url, youtube_url, category, created_at,
  repost_comment, repost_count,
  profiles (id, username, display_name, avatar_url, bio, created_at),
  vibes (id, post_id, user_id, type, created_at),
  original_post:repost_of (
    id, user_id, content, image_url, spotify_url, youtube_url, category, created_at,
    profiles (id, username, display_name, avatar_url, bio, created_at)
  )
`.trim()

export default async function HashtagPage({
  params,
}: {
  params: Promise<{ tag: string }>
}) {
  const { tag: rawTag } = await params
  const tag = rawTag.toLowerCase()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .single()

  // Get post IDs that carry this hashtag, newest first
  const { data: hashRows } = await supabase
    .from('hashtags')
    .select('post_id, created_at')
    .eq('tag', tag)
    .order('created_at', { ascending: false })
    .limit(50)

  const postIds = (hashRows ?? []).map(r => (r as { post_id: string }).post_id)

  let posts: Post[] = []
  if (postIds.length > 0) {
    const { data } = await supabase
      .from('posts')
      .select(POST_SELECT)
      .in('id', postIds)
      .order('created_at', { ascending: false })
    posts = (data as unknown as Post[]) ?? []
  }

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">

      {/* ── Main column ── */}
      <div className="space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            href="/feed"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
            aria-label="Voltar ao feed"
          >
            ←
          </Link>
          <div>
            <h1 className="text-lg font-bold text-zinc-100">#{tag}</h1>
            <p className="text-xs text-zinc-600">
              {posts.length === 0
                ? 'Nenhum post ainda'
                : `${posts.length} post${posts.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        {/* Dynamic hashtag tabs */}
        <HashtagFilter activeTag={tag} />

        {/* Posts */}
        {posts.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 px-6 py-14 text-center">
            <p className="mb-2 text-2xl">🔍</p>
            <p className="text-sm text-zinc-400">
              Nenhum post com <span className="font-semibold text-[#D4537E]">#{tag}</span> ainda.
              Seja a primeira, incelica!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map(post => (
              <PostCard key={post.id} post={post} currentUserId={user.id} currentUserUsername={currentProfile?.username ?? null} />
            ))}
          </div>
        )}
      </div>

      {/* ── Right sidebar ── */}
      <aside className="hidden lg:flex lg:flex-col lg:gap-4 lg:sticky lg:top-[72px]">
        <TrendingSidebar />
        <WhoToFollow currentUserId={user.id} />
      </aside>
    </div>
  )
}
