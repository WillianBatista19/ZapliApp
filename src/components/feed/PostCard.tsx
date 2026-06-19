'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/components/Avatar'
import CategoryBadge from '@/components/feed/CategoryBadge'
import MediaEmbed from '@/components/feed/MediaEmbed'
import VibeCheck from '@/components/feed/VibeCheck'
import CommentsSection from '@/components/feed/CommentsSection'
import { relativeTime } from '@/lib/utils'
import type { Post } from '@/types'

type Props = {
  post:          Post
  currentUserId: string | null
}

export default function PostCard({ post, currentUserId }: Props) {
  const [showComments, setShowComments] = useState(false)
  const [deleted,      setDeleted]      = useState(false)
  const [deleting,     setDeleting]     = useState(false)
  const supabase = useMemo(() => createClient(), [])
  const profile  = post.profiles
  const isOwner  = Boolean(currentUserId && currentUserId === post.user_id)

  async function handleDelete() {
    if (!window.confirm('Tem certeza que quer deletar esse post?')) return
    setDeleting(true)
    const { error } = await supabase.from('posts').delete().eq('id', post.id)
    if (error) {
      setDeleting(false)
    } else {
      setDeleted(true)   // hide immediately; realtime DELETE will also fire
    }
  }

  if (deleted) return null

  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 transition-colors hover:border-zinc-700">

      {/* Header */}
      <div className="flex items-start gap-3">
        <Avatar src={profile.avatar_url} name={profile.display_name} size="md" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-semibold leading-tight text-zinc-100 truncate">
              {profile.display_name}
            </span>
            <span className="text-xs text-zinc-500 truncate">
              @{profile.username}
            </span>
            <span className="text-xs text-zinc-700">·</span>
            <time dateTime={post.created_at} className="shrink-0 text-xs text-zinc-500">
              {relativeTime(post.created_at)}
            </time>
          </div>

          {post.category && (
            <div className="mt-1">
              <CategoryBadge category={post.category} />
            </div>
          )}
        </div>

        {/* Delete button — owner only */}
        {isOwner && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            aria-label="Deletar post"
            title="Deletar post"
            className="ml-1 shrink-0 rounded-lg p-1.5 text-zinc-600 transition-colors hover:bg-red-950/50 hover:text-red-400 disabled:opacity-40"
          >
            {deleting ? (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
              </svg>
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* Content */}
      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-200">
        {post.content}
      </p>

      {/* Media */}
      <MediaEmbed spotifyUrl={post.spotify_url} youtubeUrl={post.youtube_url} />

      {/* Vibe Check + Comments toggle */}
      <div className="mt-3 flex items-center justify-between border-t border-zinc-800 pt-3">
        <VibeCheck
          postId={post.id}
          initialVibes={post.vibes}
          currentUserId={currentUserId}
        />

        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          className="ml-3 shrink-0 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
        >
          💬 {showComments ? 'Fechar' : 'Comentários'}
        </button>
      </div>

      {/* Expandable comments */}
      {showComments && (
        <CommentsSection postId={post.id} currentUserId={currentUserId} />
      )}

    </article>
  )
}
