'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/components/Avatar'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { relativeTime } from '@/lib/utils'
import MentionInput from '@/components/feed/MentionInput'
import VerifiedBadge from '@/components/VerifiedBadge'
import { isVerified } from '@/lib/verified'

type CommentLike = { id: string; user_id: string }

type CommentRow = {
  id:            string
  user_id:       string
  parent_id:     string | null
  content:       string
  created_at:    string
  profiles:      { display_name: string | null; username: string; avatar_url: string | null }
  comment_likes: CommentLike[]
}

type Props = {
  postId:              string
  currentUserId:       string | null
  highlightCommentId?: string | null
}

const SELECT = 'id, user_id, parent_id, content, created_at, profiles (display_name, username, avatar_url), comment_likes (id, user_id)'

const BLANK_PROFILE = { display_name: null, username: '', avatar_url: null } as const

export default function CommentsSection({ postId, currentUserId, highlightCommentId }: Props) {
  const supabase = useMemo(() => createClient(), [])

  const [all,             setAll]             = useState<CommentRow[]>([])
  const [loading,         setLoading]         = useState(true)
  const [text,            setText]            = useState('')
  const [submitting,      setSubmitting]      = useState(false)
  const [replyingTo,      setReplyingTo]      = useState<string | null>(null)
  const [replyText,       setReplyText]       = useState('')
  const [replySubmitting, setReplySubmitting] = useState(false)
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set())
  const [deleteId,        setDeleteId]        = useState<string | null>(null)
  const [deleting,        setDeleting]        = useState(false)
  const [highlightedId,   setHighlightedId]   = useState<string | null>(highlightCommentId ?? null)

  useEffect(() => {
    supabase
      .from('comments')
      .select(SELECT)
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setAll((data as unknown as CommentRow[]) ?? [])
        setLoading(false)
      })
  }, [supabase, postId])

  // Scroll to and briefly highlight a specific comment after load
  useEffect(() => {
    if (!highlightCommentId || loading) return
    const target = all.find(c => c.id === highlightCommentId)
    if (!target) return

    // If it's a reply, auto-expand the parent's reply list so the element is in the DOM
    if (target.parent_id) {
      setExpandedReplies(prev => { const n = new Set(prev); n.add(target.parent_id!); return n })
    }

    const t1 = setTimeout(() => {
      document.getElementById(`comment-${highlightCommentId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 150)

    const t2 = setTimeout(() => setHighlightedId(null), 2500)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, highlightCommentId])

  const topLevel = useMemo(() => all.filter(c => c.parent_id === null), [all])
  const byParent = useMemo(
    () => all.reduce<Record<string, CommentRow[]>>((acc, c) => {
      if (c.parent_id) acc[c.parent_id] = [...(acc[c.parent_id] ?? []), c]
      return acc
    }, {}),
    [all],
  )

  // ── top-level comment ───────────────────────────────────────────────────────
  async function submitComment() {
    const trimmed = text.trim()
    if (!trimmed || !currentUserId || submitting) return
    setSubmitting(true)
    setText('')

    const optimistic: CommentRow = {
      id: `opt-${Date.now()}`, user_id: currentUserId, parent_id: null,
      content: trimmed, created_at: new Date().toISOString(),
      profiles: { ...BLANK_PROFILE }, comment_likes: [],
    }
    setAll(prev => [...prev, optimistic])

    const { data, error } = await supabase
      .from('comments')
      .insert({ post_id: postId, user_id: currentUserId, content: trimmed })
      .select(SELECT)
      .single()

    setAll(prev =>
      error
        ? prev.filter(c => c.id !== optimistic.id)
        : prev.map(c => c.id === optimistic.id ? (data as unknown as CommentRow) : c)
    )
    if (error) setText(trimmed)
    setSubmitting(false)
  }

  // ── reply ───────────────────────────────────────────────────────────────────
  async function submitReply(parentId: string) {
    const trimmed = replyText.trim()
    if (!trimmed || !currentUserId || replySubmitting) return
    setReplySubmitting(true)
    setReplyText('')
    setReplyingTo(null)
    setExpandedReplies(prev => { const n = new Set(prev); n.add(parentId); return n })

    const optimistic: CommentRow = {
      id: `opt-${Date.now()}`, user_id: currentUserId, parent_id: parentId,
      content: trimmed, created_at: new Date().toISOString(),
      profiles: { ...BLANK_PROFILE }, comment_likes: [],
    }
    setAll(prev => [...prev, optimistic])

    const { data, error } = await supabase
      .from('comments')
      .insert({ post_id: postId, user_id: currentUserId, content: trimmed, parent_id: parentId })
      .select(SELECT)
      .single()

    setAll(prev =>
      error
        ? prev.filter(c => c.id !== optimistic.id)
        : prev.map(c => c.id === optimistic.id ? (data as unknown as CommentRow) : c)
    )
    if (error) { setReplyingTo(parentId); setReplyText(trimmed) }
    setReplySubmitting(false)
  }

  // ── like / unlike ───────────────────────────────────────────────────────────
  async function toggleLike(commentId: string) {
    if (!currentUserId) return
    const comment = all.find(c => c.id === commentId)
    if (!comment) return
    const liked = comment.comment_likes.some(l => l.user_id === currentUserId)

    if (liked) {
      // Optimistic unlike
      setAll(prev => prev.map(c => c.id !== commentId ? c : {
        ...c, comment_likes: c.comment_likes.filter(l => l.user_id !== currentUserId),
      }))
      const { error } = await supabase
        .from('comment_likes')
        .delete()
        .eq('comment_id', commentId)
        .eq('user_id', currentUserId)
      if (error) {
        setAll(prev => prev.map(c => c.id !== commentId ? c : {
          ...c, comment_likes: [...c.comment_likes, { id: 'rb', user_id: currentUserId }],
        }))
      }
    } else {
      // Optimistic like
      const optId = `opt-${Date.now()}`
      setAll(prev => prev.map(c => c.id !== commentId ? c : {
        ...c, comment_likes: [...c.comment_likes, { id: optId, user_id: currentUserId }],
      }))
      const { data, error } = await supabase
        .from('comment_likes')
        .insert({ comment_id: commentId, user_id: currentUserId })
        .select('id, user_id')
        .single()
      if (error) {
        setAll(prev => prev.map(c => c.id !== commentId ? c : {
          ...c, comment_likes: c.comment_likes.filter(l => l.id !== optId),
        }))
      } else if (data) {
        setAll(prev => prev.map(c => c.id !== commentId ? c : {
          ...c, comment_likes: c.comment_likes.map(l => l.id === optId ? (data as CommentLike) : l),
        }))
      }
    }
  }

  function startReply(comment: CommentRow) {
    if (replyingTo === comment.id) { setReplyingTo(null); return }
    setReplyingTo(comment.id)
    setReplyText(`@${comment.profiles.username} `)
  }

  function toggleReplies(commentId: string) {
    setExpandedReplies(prev => {
      const next = new Set(prev)
      next.has(commentId) ? next.delete(commentId) : next.add(commentId)
      return next
    })
  }

  async function deleteComment() {
    if (!deleteId) return
    setDeleting(true)
    const { error } = await supabase.from('comments').delete().eq('id', deleteId)
    if (!error) {
      // Remove the comment and any direct replies (CASCADE handles DB side)
      setAll(prev => prev.filter(c => c.id !== deleteId && c.parent_id !== deleteId))
    }
    setDeleteId(null)
    setDeleting(false)
  }

  return (
    <>
    <div className="mt-3 space-y-3 border-t border-zinc-800 pt-3">

      {loading ? (
        <p className="text-xs text-zinc-600">Carregando comentários…</p>
      ) : topLevel.length === 0 ? (
        <p className="text-xs text-zinc-600">Nenhum comentário ainda. Seja o primeiro!</p>
      ) : (
        <ul className="space-y-4">
          {topLevel.map(comment => {
            const replies     = byParent[comment.id] ?? []
            const showReplies = expandedReplies.has(comment.id)
            const isReplying  = replyingTo === comment.id
            const authorName  = comment.profiles.display_name || comment.profiles.username || 'Incelica'
            const liked       = currentUserId
              ? comment.comment_likes.some(l => l.user_id === currentUserId)
              : false

            return (
              <li
                key={comment.id}
                id={`comment-${comment.id}`}
                className={`rounded-xl transition-colors duration-500 ${highlightedId === comment.id ? 'bg-[#D4537E]/5 ring-1 ring-[#D4537E]/30' : ''}`}
              >
                {/* Comment */}
                <div className="flex gap-2">
                  <Avatar src={comment.profiles.avatar_url} name={authorName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-x-1.5">
                      <span className="text-xs font-semibold text-zinc-300">{authorName}</span>
                      {isVerified(comment.profiles.username) && <VerifiedBadge />}
                      <span className="text-[10px] text-zinc-600">{relativeTime(comment.created_at)}</span>
                      {currentUserId === comment.user_id && (
                        <button
                          type="button"
                          onClick={() => setDeleteId(comment.id)}
                          aria-label="Deletar comentário"
                          className="ml-auto text-zinc-700 transition-colors hover:text-red-400"
                        >
                          <MiniTrashIcon />
                        </button>
                      )}
                    </div>
                    <CommentText text={comment.content} />
                    <div className="mt-1 flex items-center gap-3">
                      {currentUserId && (
                        <button
                          type="button"
                          onClick={() => startReply(comment)}
                          className="text-[10px] font-medium text-zinc-600 transition-colors hover:text-[#D4537E]"
                        >
                          {isReplying ? 'Cancelar' : 'Responder'}
                        </button>
                      )}
                      <LikeButton
                        liked={liked}
                        count={comment.comment_likes.length}
                        disabled={!currentUserId}
                        onClick={() => toggleLike(comment.id)}
                      />
                    </div>
                  </div>
                </div>

                {/* "ver X respostas" toggle */}
                {replies.length > 0 && (
                  <button
                    type="button"
                    onClick={() => toggleReplies(comment.id)}
                    className="ml-8 mt-1.5 text-[10px] font-medium text-[#7F77DD] transition-colors hover:text-[#9f99ee]"
                  >
                    {showReplies
                      ? 'Ocultar respostas'
                      : `Ver ${replies.length} ${replies.length === 1 ? 'resposta' : 'respostas'}`}
                  </button>
                )}

                {/* Replies */}
                {showReplies && (
                  <ul className="ml-8 mt-2 space-y-3 border-l border-zinc-800 pl-3">
                    {replies.map(reply => {
                      const replyAuthor = reply.profiles.display_name || reply.profiles.username || 'Incelica'
                      const replyLiked  = currentUserId
                        ? reply.comment_likes.some(l => l.user_id === currentUserId)
                        : false
                      return (
                        <li
                          key={reply.id}
                          id={`comment-${reply.id}`}
                          className={`flex gap-2 rounded-xl transition-colors duration-500 ${highlightedId === reply.id ? 'bg-[#D4537E]/5 ring-1 ring-[#D4537E]/30' : ''}`}
                        >
                          <Avatar src={reply.profiles.avatar_url} name={replyAuthor} size="sm" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-x-1.5">
                              <span className="text-xs font-semibold text-zinc-300">{replyAuthor}</span>
                              {isVerified(reply.profiles.username) && <VerifiedBadge />}
                              <span className="text-[10px] text-zinc-600">{relativeTime(reply.created_at)}</span>
                              {currentUserId === reply.user_id && (
                                <button
                                  type="button"
                                  onClick={() => setDeleteId(reply.id)}
                                  aria-label="Deletar resposta"
                                  className="ml-auto text-zinc-700 transition-colors hover:text-red-400"
                                >
                                  <MiniTrashIcon />
                                </button>
                              )}
                            </div>
                            <CommentText text={reply.content} />
                            <div className="mt-1">
                              <LikeButton
                                liked={replyLiked}
                                count={reply.comment_likes.length}
                                disabled={!currentUserId}
                                onClick={() => toggleLike(reply.id)}
                              />
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}

                {/* Inline reply input */}
                {isReplying && (
                  <div className="ml-8 mt-2 flex gap-2">
                    <MentionInput
                      value={replyText}
                      onChange={setReplyText}
                      onSubmit={() => submitReply(comment.id)}
                      placeholder={`Responder para @${comment.profiles.username}…`}
                      disabled={replySubmitting}
                      autoFocus
                      rows={1}
                    />
                    <button
                      type="button"
                      onClick={() => submitReply(comment.id)}
                      disabled={!replyText.trim() || replySubmitting}
                      className="shrink-0 self-end rounded-xl bg-[#D4537E] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#c0446e] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {replySubmitting ? '…' : 'Enviar'}
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* Top-level input */}
      {currentUserId && (
        <form onSubmit={(e) => { e.preventDefault(); submitComment() }} className="flex gap-2">
          <MentionInput
            value={text}
            onChange={setText}
            onSubmit={submitComment}
            placeholder="Adicionar comentário…"
            disabled={submitting}
            rows={1}
          />
          <button
            type="submit"
            disabled={!text.trim() || submitting}
            className="shrink-0 self-end rounded-xl bg-[#D4537E] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#c0446e] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? '…' : 'Enviar'}
          </button>
        </form>
      )}
    </div>

    {deleteId && (
      <ConfirmModal
        message="Tem certeza que quer deletar esse comentário?"
        confirmLabel="Deletar"
        loading={deleting}
        onConfirm={deleteComment}
        onCancel={() => setDeleteId(null)}
      />
    )}
    </>
  )
}

// ── Inline helpers ────────────────────────────────────────────────────────────

function LikeButton({ liked, count, disabled, onClick }: {
  liked:    boolean
  count:    number
  disabled: boolean
  onClick:  () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'flex items-center gap-1 text-[10px] font-medium transition-colors disabled:opacity-40',
        liked ? 'text-[#D4537E]' : 'text-zinc-600 hover:text-[#D4537E]',
      ].join(' ')}
    >
      <HeartIcon filled={liked} className="h-3 w-3" />
      {count > 0 && <span>{count}</span>}
    </button>
  )
}

function CommentText({ text }: { text: string }) {
  const parts = text.split(/(@[A-Za-z0-9_]+)/g)
  return (
    <p className="text-xs leading-relaxed text-zinc-400">
      {parts.map((part, i) =>
        /^@[A-Za-z0-9_]+$/.test(part)
          ? <span key={i} className="font-medium text-[#D4537E]">{part}</span>
          : part,
      )}
    </p>
  )
}

function HeartIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

function MiniTrashIcon() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}
