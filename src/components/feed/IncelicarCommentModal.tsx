'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/components/Avatar'
import CategoryBadge from '@/components/feed/CategoryBadge'
import type { OriginalPost } from '@/types'

const MAX = 300

type Props = {
  postId:        string
  currentUserId: string
  original:      OriginalPost
  onSuccess:     (repostId: string) => void
  onClose:       () => void
}

export default function IncelicarCommentModal({
  postId,
  currentUserId,
  original,
  onSuccess,
  onClose,
}: Props) {
  const supabase    = useMemo(() => createClient(), [])
  const [comment,   setComment]   = useState('')
  const [isPending, setIsPending] = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  const remaining = MAX - comment.length
  const canSubmit = comment.trim().length > 0 && remaining >= 0 && !isPending

  const origAuthor = original.profiles.display_name || original.profiles.username

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  async function submit() {
    if (!canSubmit) return
    setIsPending(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('posts')
      .insert({
        user_id:        currentUserId,
        content:        '',
        repost_of:      postId,
        repost_comment: comment.trim(),
      })
      .select('id')
      .single()

    if (err || !data) {
      setError('Não foi possível incelicar. Tente de novo.')
      setIsPending(false)
      return
    }

    onSuccess(data.id)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Incelicar com comentário"
        className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h2 className="text-base font-bold text-zinc-100">Incelicar com comentário</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Textarea */}
          <div className="relative">
            <textarea
              autoFocus
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="O que você acha desse post?"
              maxLength={MAX + 20}
              rows={3}
              className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors focus:border-pink"
            />
            <span className={[
              'absolute bottom-3 right-3 text-xs tabular-nums',
              remaining < 0 ? 'text-red-400' : remaining <= 20 ? 'text-yellow-400' : 'text-zinc-600',
            ].join(' ')}>
              {remaining}
            </span>
          </div>

          {/* Original post preview */}
          <div className="rounded-xl border border-zinc-700 bg-zinc-900/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Avatar src={original.profiles.avatar_url} name={origAuthor} size="sm" />
              <span className="text-sm font-semibold text-zinc-200">{origAuthor}</span>
              <span className="text-xs text-zinc-600">@{original.profiles.username}</span>
              {original.category && (
                <span className="ml-auto">
                  <CategoryBadge category={original.category} />
                </span>
              )}
            </div>
            <p className="text-sm leading-relaxed text-zinc-400 line-clamp-4">
              {original.content}
            </p>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="rounded-xl bg-pink px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-pink-hover active:scale-95 disabled:opacity-50"
            >
              {isPending ? 'Incelicando…' : 'Incelicar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
