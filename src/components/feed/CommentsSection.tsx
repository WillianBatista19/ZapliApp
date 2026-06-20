'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/components/Avatar'
import { relativeTime } from '@/lib/utils'

type CommentRow = {
  id:         string
  content:    string
  created_at: string
  profiles: {
    display_name: string | null
    username:     string
    avatar_url:   string | null
  }
}

type Props = {
  postId:        string
  currentUserId: string | null
}

export default function CommentsSection({ postId, currentUserId }: Props) {
  const [comments,   setComments]   = useState<CommentRow[]>([])
  const [text,       setText]       = useState('')
  const [loading,    setLoading]    = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    supabase
      .from('comments')
      .select('id, content, created_at, profiles(display_name, username, avatar_url)')
      .eq('post_id', postId)
      .is('parent_id', null)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setComments((data as unknown as CommentRow[]) ?? [])
        setLoading(false)
      })
  }, [supabase, postId])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || !currentUserId || submitting) return

    setSubmitting(true)
    setText('')

    // Optimistic entry while the insert is in-flight
    const optimistic: CommentRow = {
      id:         `opt-${Date.now()}`,
      content:    trimmed,
      created_at: new Date().toISOString(),
      profiles:   { display_name: null, username: '', avatar_url: null },
    }
    setComments((prev) => [...prev, optimistic])

    const { data, error } = await supabase
      .from('comments')
      .insert({ post_id: postId, user_id: currentUserId, content: trimmed })
      .select('id, content, created_at, profiles(display_name, username, avatar_url)')
      .single()

    if (error) {
      setComments((prev) => prev.filter((c) => c.id !== optimistic.id))
      setText(trimmed)                      // restore text so user can retry
    } else {
      setComments((prev) =>
        prev.map((c) => (c.id === optimistic.id ? (data as unknown as CommentRow) : c)),
      )
    }

    setSubmitting(false)
  }

  return (
    <div className="mt-3 space-y-3 border-t border-zinc-800 pt-3">

      {loading ? (
        <p className="text-xs text-zinc-600">Carregando comentários…</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-zinc-600">
          Nenhum comentário ainda. Seja o primeiro!
        </p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-2">
              <Avatar
                src={c.profiles.avatar_url}
                name={c.profiles.display_name || c.profiles.username}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-xs font-semibold text-zinc-300">
                    {c.profiles.display_name || c.profiles.username || 'Incelica'}
                  </span>
                  <span className="text-[10px] text-zinc-600">
                    {relativeTime(c.created_at)}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-zinc-400">{c.content}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {currentUserId && (
        <form onSubmit={submit} className="flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Adicionar comentário…"
            disabled={submitting}
            className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-[#D4537E]/50 focus:ring-1 focus:ring-[#D4537E] disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!text.trim() || submitting}
            className="shrink-0 rounded-xl bg-[#D4537E] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#c0446e] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? '…' : 'Enviar'}
          </button>
        </form>
      )}

    </div>
  )
}
