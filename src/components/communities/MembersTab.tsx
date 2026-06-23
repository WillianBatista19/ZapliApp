'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import type { CommunityMemberRow, CommunityRole } from '@/types'
import { updateMemberRole, updateMemberCanPost, removeMember } from '@/app/(app)/communities/actions'

interface Props {
  communityId:    string
  members:        CommunityMemberRow[]
  currentUserId:  string | null
  viewerRole:     CommunityRole | null
  postPermission: string
}

const ROLE_LABEL: Record<CommunityRole, string> = {
  owner:     '👑 Dono',
  moderator: '🛡️ Mod',
  member:    'Membro',
}

export default function MembersTab({ communityId, members: initial, currentUserId, viewerRole, postPermission }: Props) {
  const [members, setMembers] = useState<CommunityMemberRow[]>(initial)
  const canManage       = viewerRole === 'owner' || viewerRole === 'moderator'
  const isOwner         = viewerRole === 'owner'
  const showCanPostCtrl = isOwner && postPermission === 'allowed_users'

  async function handleRoleChange(userId: string, role: CommunityRole) {
    await updateMemberRole(communityId, userId, role)
    setMembers(prev => prev.map(m => m.user_id === userId ? { ...m, role } : m))
  }

  async function handleCanPostToggle(userId: string, canPost: boolean) {
    await updateMemberCanPost(communityId, userId, canPost)
    setMembers(prev => prev.map(m => m.user_id === userId ? { ...m, can_post: canPost } : m))
  }

  async function handleRemove(userId: string) {
    await removeMember(communityId, userId)
    setMembers(prev => prev.filter(m => m.user_id !== userId))
  }

  if (members.length === 0) {
    return <p className="text-zinc-500 text-sm text-center py-10">Nenhum membro ainda.</p>
  }

  return (
    <div className="space-y-2">
      {members.map(m => {
        const profile = m.profiles
        if (!profile) return null
        const isMe = m.user_id === currentUserId

        return (
          <div key={m.user_id} className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
            <Link href={`/profile/${profile.username}`}>
              {profile.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt={profile.display_name ?? profile.username}
                  width={36} height={36}
                  className="rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-[#7F77DD] flex items-center justify-center text-white text-sm shrink-0">
                  {(profile.display_name ?? profile.username)[0].toUpperCase()}
                </div>
              )}
            </Link>

            <div className="flex-1 min-w-0">
              <Link href={`/profile/${profile.username}`} className="text-sm font-semibold text-white hover:underline">
                {profile.display_name ?? profile.username}
              </Link>
              <p className="text-xs text-zinc-500">@{profile.username}</p>
            </div>

            <span className="text-xs text-zinc-400 shrink-0">{ROLE_LABEL[m.role]}</span>

            {/* Muted indicator — visible to owner only, informational */}
            {isOwner && m.notifications_muted && (
              <span title="Notificações silenciadas" className="shrink-0 text-zinc-600">
                <BellMutedIcon className="h-3.5 w-3.5" />
              </span>
            )}

            {canManage && !isMe && m.role !== 'owner' && (
              <div className="flex items-center gap-3 shrink-0">
                {/* Role selector — owner only */}
                {isOwner && (
                  <select
                    value={m.role}
                    onChange={e => handleRoleChange(m.user_id, e.target.value as CommunityRole)}
                    className="rounded bg-white/10 px-1 py-0.5 text-xs text-zinc-300"
                  >
                    <option value="member">Membro</option>
                    <option value="moderator">Moderador</option>
                  </select>
                )}

                {/* Can-post toggle — owner only, only in 'allowed_users' mode */}
                {showCanPostCtrl && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-zinc-500">Postar</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={m.can_post}
                      onClick={() => handleCanPostToggle(m.user_id, !m.can_post)}
                      className={[
                        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none',
                        m.can_post ? 'bg-[#D4537E]' : 'bg-zinc-700',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200',
                          m.can_post ? 'translate-x-4' : 'translate-x-0',
                        ].join(' ')}
                      />
                    </button>
                  </div>
                )}

                <button
                  onClick={() => handleRemove(m.user_id)}
                  className="text-xs text-zinc-600 hover:text-red-400"
                >
                  Remover
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function BellMutedIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      <path d="M18.63 13A17.9 17.9 0 0 1 18 8" />
      <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" />
      <path d="M18 8a6 6 0 0 0-9.33-5" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}
