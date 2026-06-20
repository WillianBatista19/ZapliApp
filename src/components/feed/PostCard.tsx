'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/components/Avatar'
import CategoryBadge from '@/components/feed/CategoryBadge'
import MediaEmbed from '@/components/feed/MediaEmbed'
import VibeCheck from '@/components/feed/VibeCheck'
import CommentsSection from '@/components/feed/CommentsSection'
import IncelicarButton from '@/components/feed/IncelicarButton'
import { relativeTime } from '@/lib/utils'
import type { OriginalPost, Post } from '@/types'

// Preview type is only needed in PostCard — no need to export
type CommentPreview = {
  id:       string
  content:  string
  profiles: { display_name: string | null; username: string; avatar_url: string | null }
}

type PreviewRow = CommentPreview & { created_at: string; comment_likes: { id: string }[] }

type Props = {
  post:          Post
  currentUserId: string | null
}

export default function PostCard({ post, currentUserId }: Props) {
  const [showComments,   setShowComments]   = useState(false)
  const [deleted,        setDeleted]        = useState(false)
  const [deleting,       setDeleting]       = useState(false)
  const [commentCount,   setCommentCount]   = useState(0)
  const [previewComment, setPreviewComment] = useState<CommentPreview | null>(null)

  const supabase = useMemo(() => createClient(), [])
  const profile  = post.profiles
  const isOwner  = Boolean(currentUserId && currentUserId === post.user_id)

  // ── Load comment count + preview; subscribe to realtime count updates ─────────
  useEffect(() => {
    let live = true

    // Total count (top-level + replies)
    supabase
      .from('comments')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', post.id)
      .then(({ count }) => { if (live) setCommentCount(count ?? 0) })

    // Preview: most-liked top-level comment, falling back to most recent
    supabase
      .from('comments')
      .select('id, content, created_at, profiles(display_name, username, avatar_url), comment_likes(id)')
      .eq('post_id', post.id)
      .is('parent_id', null)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (!live) return
        if (!data || data.length === 0) { setPreviewComment(null); return }
        // data[0] is already the most recent; only swap if a later row has more likes
        const best = (data as PreviewRow[]).reduce((a, b) =>
          (b.comment_likes?.length ?? 0) > (a.comment_likes?.length ?? 0) ? b : a
        )
        if (live) setPreviewComment({ id: best.id, content: best.content, profiles: best.profiles })
      })

    // Realtime: keep count in sync as other users post
    const ch = supabase
      .channel(`cmt-count-${post.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments', filter: `post_id=eq.${post.id}` },
        () => { if (live) setCommentCount(c => c + 1) },
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'comments', filter: `post_id=eq.${post.id}` },
        () => { if (live) setCommentCount(c => Math.max(0, c - 1)) },
      )
      .subscribe()

    return () => { live = false; supabase.removeChannel(ch) }
  }, [supabase, post.id])

  async function handleDelete() {
    if (!window.confirm('Tem certeza que quer deletar esse post?')) return
    setDeleting(true)
    const { error } = await supabase.from('posts').delete().eq('id', post.id)
    if (error) setDeleting(false)
    else       setDeleted(true)
  }

  if (deleted) return null

  const commentLabel = showComments
    ? 'Fechar'
    : `Comentários${commentCount > 0 ? ` · ${commentCount}` : ''}`

  // ── Repost layout ────────────────────────────────────────────────────────────
  if (post.original_post) {
    return (
      <article className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 transition-colors hover:border-zinc-700">

        {/* "X incelicou" banner */}
        <div className="mb-3 flex items-center gap-2 text-xs text-zinc-500">
          <RepeatIcon className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
          <Link href={`/profile/${profile.username}`} className="font-semibold text-zinc-400 transition-colors hover:text-zinc-200">
            {profile.display_name}
          </Link>
          <span>incelicou</span>
          <span className="text-zinc-700">·</span>
          <time dateTime={post.created_at}>{relativeTime(post.created_at)}</time>

          {isOwner && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              aria-label="Deletar incelicada"
              className="ml-auto rounded-lg p-1 text-zinc-700 transition-colors hover:bg-red-950/50 hover:text-red-400 disabled:opacity-40"
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Reposter's comment */}
        {post.repost_comment && (
          <p className="mb-3 text-sm leading-relaxed text-zinc-200">{post.repost_comment}</p>
        )}

        <OriginalPostCard original={post.original_post} />

        {/* Action bar */}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-3">
          <VibeCheck postId={post.id} initialVibes={post.vibes} currentUserId={currentUserId} />
          <button
            type="button"
            onClick={() => setShowComments(v => !v)}
            className="ml-auto shrink-0 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
          >
            💬 {commentLabel}
          </button>
        </div>

        {!showComments && previewComment && (
          <CommentPreviewBanner
            preview={previewComment}
            onClick={() => setShowComments(true)}
          />
        )}

        {showComments && (
          <CommentsSection postId={post.id} currentUserId={currentUserId} />
        )}
      </article>
    )
  }

  // ── Original post layout ─────────────────────────────────────────────────────
  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 transition-colors hover:border-zinc-700">

      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href={`/profile/${profile.username}`} className="shrink-0">
          <Avatar src={profile.avatar_url} name={profile.display_name} size="md" />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <Link
              href={`/profile/${profile.username}`}
              className="truncate font-semibold leading-tight text-zinc-100 hover:underline"
            >
              {profile.display_name}
            </Link>
            <span className="truncate text-xs text-zinc-500">@{profile.username}</span>
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

        {isOwner && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            aria-label="Deletar post"
            title="Deletar post"
            className="ml-1 shrink-0 rounded-lg p-1.5 text-zinc-600 transition-colors hover:bg-red-950/50 hover:text-red-400 disabled:opacity-40"
          >
            {deleting
              ? <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" /></svg>
              : <TrashIcon className="h-4 w-4" />
            }
          </button>
        )}
      </div>

      {post.content && (
        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-200">
          {post.content}
        </p>
      )}

      <MediaEmbed spotifyUrl={post.spotify_url} youtubeUrl={post.youtube_url} />

      {/* Action bar */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-3">
        <VibeCheck postId={post.id} initialVibes={post.vibes} currentUserId={currentUserId} />

        {currentUserId !== post.user_id && (
          <IncelicarButton
            postId={post.id}
            postOwnerId={post.user_id}
            currentUserId={currentUserId}
            initialRepostCount={post.repost_count}
            original={post as unknown as OriginalPost}
          />
        )}

        <button
          type="button"
          onClick={() => setShowComments(v => !v)}
          className="ml-auto shrink-0 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
        >
          💬 {commentLabel}
        </button>
      </div>

      {!showComments && previewComment && (
        <CommentPreviewBanner
          preview={previewComment}
          onClick={() => setShowComments(true)}
        />
      )}

      {showComments && (
        <CommentsSection postId={post.id} currentUserId={currentUserId} />
      )}
    </article>
  )
}

// ─── Comment preview banner ───────────────────────────────────────────────────

function CommentPreviewBanner({ preview, onClick }: { preview: CommentPreview; onClick: () => void }) {
  const name    = preview.profiles.display_name || preview.profiles.username || 'Incelica'
  const excerpt = preview.content.length > 100
    ? `${preview.content.slice(0, 100)}…`
    : preview.content

  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-zinc-800/60"
    >
      <Avatar src={preview.profiles.avatar_url} name={name} size="sm" />
      <p className="min-w-0 flex-1 truncate text-xs text-zinc-500">
        <span className="font-semibold text-zinc-400">{name}</span>
        {' '}
        {excerpt}
      </p>
    </button>
  )
}

// ─── Original post preview inside a repost card ───────────────────────────────

function OriginalPostCard({ original }: { original: OriginalPost }) {
  const rawProfiles = (original as unknown as Record<string, unknown>).profiles
  const profiles = Array.isArray(rawProfiles)
    ? (rawProfiles[0] as OriginalPost['profiles'] | undefined)
    : (rawProfiles as OriginalPost['profiles'] | undefined)

  const author = profiles?.display_name || profiles?.username || 'usuário'

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-950/60 p-4">
      <div className="mb-2 flex items-center gap-2">
        {profiles ? (
          <>
            <Link href={`/profile/${profiles.username}`} className="shrink-0">
              <Avatar src={profiles.avatar_url} name={author} size="sm" />
            </Link>
            <Link
              href={`/profile/${profiles.username}`}
              className="truncate text-sm font-semibold text-zinc-200 hover:underline"
            >
              {author}
            </Link>
            <span className="shrink-0 text-xs text-zinc-600">@{profiles.username}</span>
          </>
        ) : (
          <span className="text-xs text-zinc-500">usuário</span>
        )}
        {original.category && (
          <span className="ml-auto shrink-0">
            <CategoryBadge category={original.category} />
          </span>
        )}
      </div>
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-300">
        {original.content}
      </p>
      {(original.spotify_url || original.youtube_url) && (
        <MediaEmbed spotifyUrl={original.spotify_url} youtubeUrl={original.youtube_url} />
      )}
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

function RepeatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17 1l4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="M7 23l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  )
}
