'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { CommunityPost } from '@/types'
import CommunityVibeCheck from './CommunityVibeCheck'
import CommunityComments from './CommunityComments'
import { deleteCommunityPost } from '@/app/(app)/communities/actions'

interface Props {
  post:          CommunityPost
  currentUserId: string | null
  isOwnerOrMod?: boolean
}

export default function CommunityPostCard({ post, currentUserId, isOwnerOrMod }: Props) {
  const supabase = useMemo(() => createClient(), [])

  const [showComments,  setShowComments]  = useState(false)
  const [deleted,       setDeleted]       = useState(false)
  const [showMenu,      setShowMenu]      = useState(false)
  const [editing,       setEditing]       = useState(false)
  const [editContent,   setEditContent]   = useState(post.content)
  const [localContent,  setLocalContent]  = useState(post.content)
  const [editSaving,    setEditSaving]    = useState(false)

  if (deleted) return null

  const isAuthor  = currentUserId === post.user_id
  const canEdit   = isAuthor
  const canDelete = isAuthor || !!isOwnerOrMod
  const profile   = post.profiles

  async function handleDelete() {
    setShowMenu(false)
    await deleteCommunityPost(post.id)
    setDeleted(true)
  }

  async function saveEdit() {
    if (!editContent.trim() || editSaving) return
    setEditSaving(true)
    const { error } = await supabase
      .from('community_posts')
      .update({ content: editContent.trim() })
      .eq('id', post.id)
    if (!error) {
      setLocalContent(editContent.trim())
      setEditing(false)
    }
    setEditSaving(false)
  }

  return (
    <article className="rounded-xl bg-white/5 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link href={`/profile/${profile.username}`}>
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={profile.display_name ?? profile.username}
                width={36} height={36}
                className="rounded-full object-cover"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-[#7F77DD] flex items-center justify-center text-white text-sm">
                {(profile.display_name ?? profile.username)[0].toUpperCase()}
              </div>
            )}
          </Link>
          <div>
            <Link href={`/profile/${profile.username}`} className="text-sm font-semibold text-white hover:underline">
              {profile.display_name ?? profile.username}
            </Link>
            <p className="text-xs text-zinc-500">@{profile.username} · {formatTimeAgo(post.created_at)}</p>
          </div>
        </div>

        {(canEdit || canDelete) && (
          <div className="relative shrink-0">
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
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => { setShowMenu(false); setEditing(true) }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
                    >
                      <PencilIcon className="h-3.5 w-3.5 shrink-0" />
                      Editar
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-400 transition-colors hover:bg-red-950/50"
                    >
                      <TrashIcon className="h-3.5 w-3.5 shrink-0" />
                      Excluir
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {editing ? (
        <div>
          <textarea
            value={editContent}
            onChange={e => setEditContent(e.target.value)}
            rows={3}
            autoFocus
            className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[#D4537E]"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={saveEdit}
              disabled={editSaving || !editContent.trim()}
              className="rounded-xl bg-[#D4537E] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 hover:opacity-90"
            >
              {editSaving ? '…' : 'Salvar'}
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setEditContent(localContent) }}
              className="rounded-xl px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-zinc-200 whitespace-pre-wrap break-words">{localContent}</p>
      )}

      {post.image_url && (
        <Image
          src={post.image_url}
          alt="post image"
          width={600} height={400}
          className="rounded-xl object-cover w-full max-h-80"
        />
      )}

      <div className="flex items-center gap-4">
        <CommunityVibeCheck
          postId={post.id}
          initialVibes={post.community_post_vibes}
          currentUserId={currentUserId}
        />
        <button
          onClick={() => setShowComments(v => !v)}
          className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1"
        >
          💬 {post.community_comments.length}
        </button>
      </div>

      {showComments && (
        <CommunityComments
          postId={post.id}
          currentUserId={currentUserId}
        />
      )}
    </article>
  )
}

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
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  )
}

function formatTimeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'agora'
  if (mins < 60) return `${mins}min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}
