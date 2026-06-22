import { createClient } from '@/lib/supabase/server'
import PostCard from '@/components/feed/PostCard'
import type { Post } from '@/types'

const POST_SELECT = `
  id, user_id, content, image_url, spotify_url, youtube_url, category, created_at,
  repost_comment, repost_count,
  profiles (id, username, display_name, avatar_url, bio, created_at),
  vibes    (id, post_id, user_id, type, created_at),
  original_post:repost_of (
    id, user_id, content, image_url, spotify_url, youtube_url, category, created_at,
    profiles (id, username, display_name, avatar_url, bio, created_at)
  )
`.trim()

type Props = {
  userId:        string
  displayName:   string
  currentUserId: string
}

export default async function PostGrid({ userId, displayName, currentUserId }: Props) {
  const supabase = await createClient()

  const [{ data }, { data: currentProfile }] = await Promise.all([
    supabase
      .from('posts')
      .select(POST_SELECT)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('profiles')
      .select('username')
      .eq('id', currentUserId)
      .single(),
  ])

  const posts = (data as unknown as Post[] | null) ?? []
  const currentUserUsername = (currentProfile as { username: string } | null)?.username ?? null

  if (posts.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 px-6 py-14 text-center">
        <p className="mb-2 text-2xl">📭</p>
        <p className="text-sm text-zinc-400">
          {displayName} ainda não postou nada. A fila tá esperando.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} currentUserId={currentUserId} currentUserUsername={currentUserUsername} />
      ))}
    </div>
  )
}
