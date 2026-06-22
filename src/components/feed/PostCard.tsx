'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/components/Avatar'
import CategoryBadge from '@/components/feed/CategoryBadge'
import MediaEmbed from '@/components/feed/MediaEmbed'
import VibeCheck from '@/components/feed/VibeCheck'
import VibeListModal from '@/components/feed/VibeListModal'
import CommentsSection from '@/components/feed/CommentsSection'
import IncelicarButton from '@/components/feed/IncelicarButton'
import ConfirmModal from '@/components/ui/ConfirmModal'
import VerifiedBadge from '@/components/VerifiedBadge'
import { relativeTime } from '@/lib/utils'
import { isVerified } from '@/lib/verified'
import type { OriginalPost, Post } from '@/types'

// ─── Media type helpers ───────────────────────────────────────────────────────

type MediaKind = 'image' | 'gif' | 'video'

function getMediaKind(url: string): MediaKind {
  const path = url.toLowerCase().split('?')[0]
  if (/\.(mp4|mov|webm|qt)$/.test(path)) return 'video'
  if (/\.gif$/.test(path))                return 'gif'
  return 'image'
}

// ─── Types ────────────────────────────────────────────────────────────────────

type CommentPreview = {
  id:       string
  content:  string
  profiles: { display_name: string | null; username: string; avatar_url: string | null }
}

type PreviewRow = CommentPreview & { created_at: string; comment_likes: { id: string }[] }

type Props = {
  post:                  Post
  currentUserId:         string | null
  currentUserUsername?:  string | null
  initialShowComments?:  boolean
  highlightCommentId?:   string | null
}

// ─── PostCard (memoized) ─────────────────────────────────────────────────────

const PostCard = memo(function PostCard({ post, currentUserId, currentUserUsername, initialShowComments = false, highlightCommentId }: Props) {
  const [showComments,    setShowComments]    = useState(initialShowComments)
  const [deleted,         setDeleted]         = useState(false)
  const [deleting,        setDeleting]        = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [commentCount,    setCommentCount]    = useState(0)
  const [previewComment,  setPreviewComment]  = useState<CommentPreview | null>(null)
  const [fullscreenImg,   setFullscreenImg]   = useState<string | null>(null)
  const [showMenu,        setShowMenu]        = useState(false)
  const [editing,         setEditing]         = useState(false)
  const [editContent,     setEditContent]     = useState(post.content)
  const [localContent,    setLocalContent]    = useState(post.content)
  const [editSaving,      setEditSaving]      = useState(false)
  const [showVibesModal,  setShowVibesModal]  = useState(false)

  const supabase    = useMemo(() => createClient(), [])
  const profile     = post.profiles
  const isOwner     = Boolean(currentUserId && currentUserId === post.user_id)
  const isModerator = currentUserUsername === 'incelicasappoficial'

  console.log('[PostCard]', post.id, '| image_url:', post.image_url)

  const closeFullscreen = useCallback(() => setFullscreenImg(null), [])

  useEffect(() => {
    if (!fullscreenImg) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') closeFullscreen() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullscreenImg, closeFullscreen])

  // ── Load comment count + preview; subscribe to realtime ──────────────────
  useEffect(() => {
    let live = true

    supabase
      .from('comments')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', post.id)
      .then(({ count }) => { if (live) setCommentCount(count ?? 0) })

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
        const best = (data as unknown as PreviewRow[]).reduce((a, b) =>
          (b.comment_likes?.length ?? 0) > (a.comment_likes?.length ?? 0) ? b : a
        )
        if (live) setPreviewComment({ id: best.id, content: best.content, profiles: best.profiles })
      })

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

  async function confirmDelete() {
    setDeleting(true)
    const { error } = await supabase.from('posts').delete().eq('id', post.id)
    if (error) { setDeleting(false); setShowDeleteModal(false) }
    else        setDeleted(true)
  }

  function startPostEdit() {
    setEditContent(localContent)
    setEditing(true)
    setShowMenu(false)
  }

  async function savePostEdit() {
    const trimmed = editContent.trim()
    if (!trimmed || editSaving) return
    setEditSaving(true)
    const { error } = await supabase
      .from('posts')
      .update({ content: trimmed })
      .eq('id', post.id)
    if (!error) {
      setLocalContent(trimmed)
      setEditing(false)
    }
    setEditSaving(false)
  }

  if (deleted) return null

  const commentLabel = showComments
    ? 'Fechar'
    : `Comentários${commentCount > 0 ? ` · ${commentCount}` : ''}`

  // ── Repost layout ─────────────────────────────────────────────────────────
  if (post.original_post) {
    return (
      <>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 transition-colors hover:border-zinc-700">

          <div className="mb-3 flex items-center gap-2 text-xs text-zinc-500">
            <RepeatIcon className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
            <Link href={`/profile/${profile.username}`} className="inline-flex items-center gap-1 font-semibold text-zinc-400 transition-colors hover:text-zinc-200">
              {profile.display_name}
              {isVerified(profile.username) && <VerifiedBadge />}
            </Link>
            <span>incelicou</span>
            <span className="text-zinc-700">·</span>
            <time dateTime={post.created_at}>{relativeTime(post.created_at)}</time>

            {(isOwner || isModerator) && (
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                disabled={deleting}
                aria-label="Deletar incelicada"
                className="ml-auto rounded-lg p-1 text-zinc-700 transition-colors hover:bg-red-950/50 hover:text-red-400 disabled:opacity-40"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {post.repost_comment && (
            <p className="mb-3 text-sm leading-relaxed text-zinc-200">{post.repost_comment}</p>
          )}

          <OriginalPostCard original={post.original_post} />

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-3">
            <VibeCheck postId={post.id} initialVibes={post.vibes} currentUserId={currentUserId} onShowVibes={() => setShowVibesModal(true)} />
            <button
              type="button"
              onClick={() => setShowComments(v => !v)}
              className="ml-auto shrink-0 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
            >
              💬 {commentLabel}
            </button>
          </div>

          {!showComments && previewComment && (
            <CommentPreviewBanner preview={previewComment} onClick={() => setShowComments(true)} />
          )}
          {showComments && <CommentsSection postId={post.id} currentUserId={currentUserId} currentUserUsername={currentUserUsername} highlightCommentId={highlightCommentId} />}
        </article>

        {showDeleteModal && (
          <ConfirmModal
            message="Tem certeza que quer deletar esse post?"
            confirmLabel="Deletar"
            loading={deleting}
            onConfirm={confirmDelete}
            onCancel={() => setShowDeleteModal(false)}
          />
        )}

        {showVibesModal && <VibeListModal postId={post.id} onClose={() => setShowVibesModal(false)} />}
        {fullscreenImg && <FullscreenImage src={fullscreenImg} onClose={closeFullscreen} />}
      </>
    )
  }

  // ── Original post layout ──────────────────────────────────────────────────
  return (
    <>
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
                className="inline-flex items-center gap-1 font-semibold leading-tight text-zinc-100 hover:underline"
              >
                <span className="truncate">{profile.display_name}</span>
                {isVerified(profile.username) && <VerifiedBadge />}
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

          {(isOwner || isModerator) && (
            <div className="relative ml-1 shrink-0">
              <button
                type="button"
                onClick={() => setShowMenu(v => !v)}
                aria-label="Opções do post"
                className="rounded-lg p-1.5 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
              >
                <DotsIcon className="h-4 w-4" />
              </button>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl">
                    {isOwner && (
                      <button
                        type="button"
                        onClick={startPostEdit}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
                      >
                        <PencilIcon className="h-3.5 w-3.5 shrink-0" />
                        Editar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => { setShowMenu(false); setShowDeleteModal(true) }}
                      disabled={deleting}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-400 transition-colors hover:bg-red-950/50 disabled:opacity-40"
                    >
                      <TrashIcon className="h-3.5 w-3.5 shrink-0" />
                      Deletar
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {editing ? (
          <div className="mt-3">
            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              rows={4}
              className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm leading-relaxed text-zinc-200 outline-none focus:border-[#D4537E]"
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={savePostEdit}
                disabled={editSaving || !editContent.trim()}
                className="rounded-xl bg-[#D4537E] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#c0446e] disabled:opacity-40"
              >
                {editSaving ? '…' : 'Salvar'}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-xl px-3 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-300"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          localContent && <PostText text={localContent} />
        )}

        <PostMedia url={post.image_url} onImageClick={setFullscreenImg} />

        <MediaEmbed spotifyUrl={post.spotify_url} youtubeUrl={post.youtube_url} />

        {/* Action bar */}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-3">
          <VibeCheck postId={post.id} initialVibes={post.vibes} currentUserId={currentUserId} onShowVibes={() => setShowVibesModal(true)} />

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
          <CommentPreviewBanner preview={previewComment} onClick={() => setShowComments(true)} />
        )}
        {showComments && <CommentsSection postId={post.id} currentUserId={currentUserId} currentUserUsername={currentUserUsername} />}
      </article>

      {showDeleteModal && (
        <ConfirmModal
          message="Tem certeza que quer deletar esse post?"
          confirmLabel="Deletar"
          loading={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}

      {showVibesModal && <VibeListModal postId={post.id} onClose={() => setShowVibesModal(false)} />}
      {fullscreenImg && <FullscreenImage src={fullscreenImg} onClose={closeFullscreen} />}
    </>
  )
})

export default PostCard

// ─── PostMedia — renders image / GIF / video from image_url ──────────────────

function PostMedia({
  url,
  onImageClick,
  maxHeight = 400,
}: {
  url:          string | null | undefined
  onImageClick: (url: string) => void
  maxHeight?:   number
}) {
  if (!url) return null
  const kind = getMediaKind(url)

  if (kind === 'video') {
    return <LazyVideo src={url} maxHeight={maxHeight} />
  }

  if (kind === 'gif') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt="GIF do post"
        loading="lazy"
        onClick={() => onImageClick(url)}
        className="mt-3 w-full cursor-zoom-in rounded-xl object-cover"
        style={{ maxHeight }}
      />
    )
  }

  // Static image — use next/image for automatic optimisation
  return (
    <div
      className="relative mt-3 w-full cursor-zoom-in overflow-hidden rounded-xl"
      style={{ height: Math.min(maxHeight, 300), background: '#0c0c0f' }}
      onClick={() => onImageClick(url)}
    >
      <Image
        src={url}
        alt="Imagem do post"
        fill
        sizes="(max-width: 640px) 100vw, 600px"
        className="object-contain"
        loading="lazy"
      />
    </div>
  )
}

// ─── LazyVideo — defers src until the element enters the viewport ─────────────

function LazyVideo({ src, maxHeight = 400 }: { src: string; maxHeight?: number }) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.src = src
          obs.disconnect()
        }
      },
      { rootMargin: '200px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [src])

  return (
    <video
      ref={ref}
      controls
      muted
      loop
      playsInline
      className="mt-3 w-full rounded-xl object-cover"
      style={{ maxHeight }}
    />
  )
}

// ─── Comment preview banner ───────────────────────────────────────────────────

function CommentPreviewBanner({ preview, onClick }: { preview: CommentPreview; onClick: () => void }) {
  const name    = preview.profiles.display_name || preview.profiles.username || 'Incelica'
  const excerpt = preview.content.length > 100 ? `${preview.content.slice(0, 100)}…` : preview.content

  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-zinc-800/60"
    >
      <Avatar src={preview.profiles.avatar_url} name={name} size="sm" />
      <p className="min-w-0 flex-1 truncate text-xs text-zinc-500">
        <span className="font-semibold text-zinc-400">{name}</span>{' '}{excerpt}
      </p>
    </button>
  )
}

// ─── Original post preview inside a repost card ───────────────────────────────

function OriginalPostCard({ original }: { original: OriginalPost }) {
  const rawProfiles = (original as unknown as Record<string, unknown>).profiles
  const profiles    = Array.isArray(rawProfiles)
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
              className="inline-flex items-center gap-1 text-sm font-semibold text-zinc-200 hover:underline"
            >
              <span className="truncate">{author}</span>
              {isVerified(profiles.username) && <VerifiedBadge />}
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

      {original.content && <PostText text={original.content} className="text-zinc-300" />}

      <PostMedia url={original.image_url} onImageClick={() => {}} maxHeight={300} />

      {(original.spotify_url || original.youtube_url) && (
        <MediaEmbed spotifyUrl={original.spotify_url} youtubeUrl={original.youtube_url} />
      )}
    </div>
  )
}

// ─── Inline text renderer ─────────────────────────────────────────────────────

function PostText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/([@#][A-Za-z0-9_]+)/g)
  return (
    <p className={`mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-200 ${className ?? ''}`}>
      {parts.map((part, i) => {
        if (/^#[A-Za-z0-9_]+$/.test(part)) {
          return (
            <Link key={i} href={`/hashtag/${part.slice(1).toLowerCase()}`} className="font-medium text-[#D4537E] hover:underline" onClick={e => e.stopPropagation()}>
              {part}
            </Link>
          )
        }
        if (/^@[A-Za-z0-9_]+$/.test(part)) {
          return (
            <Link key={i} href={`/profile/${part.slice(1)}`} className="font-medium text-[#7F77DD] hover:underline" onClick={e => e.stopPropagation()}>
              {part}
            </Link>
          )
        }
        return part
      })}
    </p>
  )
}

// ─── Fullscreen image viewer ──────────────────────────────────────────────────

function FullscreenImage({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Imagem em tela cheia"
        className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
        onClick={e => e.stopPropagation()}
      />
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar"
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800/80 text-zinc-300 backdrop-blur hover:bg-zinc-700 hover:text-white"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="h-5 w-5" aria-hidden>
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function DotsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </svg>
  )
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

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
