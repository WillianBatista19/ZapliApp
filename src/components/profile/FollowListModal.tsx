'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/components/Avatar'
import FollowButton from '@/components/profile/FollowButton'

type UserRow = {
  id:           string
  username:     string
  display_name: string | null
  avatar_url:   string | null
}

type Props = {
  type:          'followers' | 'following'
  profileId:     string
  currentUserId: string
  onClose:       () => void
}

export default function FollowListModal({ type, profileId, currentUserId, onClose }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [users, setUsers] = useState<UserRow[] | null>(null)

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Lock body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // Fetch the list
  useEffect(() => {
    async function load() {
      setUsers(null)

      if (type === 'followers') {
        // People who follow this profile — join via follower_id
        const { data } = await supabase
          .from('follows')
          .select('profile:profiles!follower_id(id, username, display_name, avatar_url)')
          .eq('following_id', profileId)
          .order('created_at', { ascending: false })

        setUsers(
          ((data ?? []) as unknown as { profile: UserRow | null }[])
            .map(r => r.profile)
            .filter((p): p is UserRow => p !== null),
        )
      } else {
        // People this profile follows — join via following_id
        const { data } = await supabase
          .from('follows')
          .select('profile:profiles!following_id(id, username, display_name, avatar_url)')
          .eq('follower_id', profileId)
          .order('created_at', { ascending: false })

        setUsers(
          ((data ?? []) as unknown as { profile: UserRow | null }[])
            .map(r => r.profile)
            .filter((p): p is UserRow => p !== null),
        )
      }
    }
    load()
  }, [supabase, type, profileId])

  const title = type === 'followers' ? 'Seguidores' : 'Seguindo'
  const emptyText = type === 'followers'
    ? 'Ainda não tem incelicas seguindo.'
    : 'Ainda não segue ninguém.'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h2 className="text-base font-bold text-zinc-100">{title}</h2>
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

        {/* List */}
        <div className="max-h-[60vh] overflow-y-auto">
          {users === null ? (
            <p className="py-10 text-center text-sm text-zinc-500">Carregando...</p>
          ) : users.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-500">{emptyText}</p>
          ) : (
            <ul className="divide-y divide-zinc-800/60">
              {users.map(user => {
                const name = user.display_name || user.username
                return (
                  <li key={user.id} className="flex items-center gap-3 px-5 py-3">
                    <Link href={`/profile/${user.username}`} onClick={onClose} className="shrink-0">
                      <Avatar src={user.avatar_url} name={name} size="md" />
                    </Link>

                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/profile/${user.username}`}
                        onClick={onClose}
                        className="block truncate text-sm font-semibold text-zinc-100 hover:underline"
                      >
                        {name}
                      </Link>
                      <p className="truncate text-xs text-zinc-500">@{user.username}</p>
                    </div>

                    {user.id !== currentUserId && (
                      <FollowButton
                        targetUserId={user.id}
                        currentUserId={currentUserId}
                      />
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
