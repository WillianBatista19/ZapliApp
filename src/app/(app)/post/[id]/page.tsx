import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PostCard from '@/components/feed/PostCard'
import type { Post } from '@/types'

const POST_SELECT = `
  id, user_id, content, image_url, spotify_url, youtube_url, category, created_at,
  repost_comment, repost_count,
  profiles (id, username, display_name, avatar_url, bio, created_at),
  vibes (id, post_id, user_id, type, created_at),
  original_post:repost_of (
    id, user_id, content, image_url, spotify_url, youtube_url, category, created_at,
    profiles (id, username, display_name, avatar_url, bio, created_at)
  )
`

type Props = {
  params:       { id: string }
  searchParams: { comment?: string }
}

export default async function PostPage({ params, searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .single()

  const { data: post } = await supabase
    .from('posts')
    .select(POST_SELECT)
    .eq('id', params.id)
    .single()

  if (!post) notFound()

  const highlightCommentId = searchParams.comment ?? null

  return (
    <div className="space-y-4 pb-12">
      <Link
        href="/feed"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
      >
        <BackIcon className="h-4 w-4" />
        Voltar ao feed
      </Link>

      <PostCard
        post={post as unknown as Post}
        currentUserId={user.id}
        currentUserUsername={currentProfile?.username ?? null}
        initialShowComments
        highlightCommentId={highlightCommentId}
      />
    </div>
  )
}

function BackIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  )
}
