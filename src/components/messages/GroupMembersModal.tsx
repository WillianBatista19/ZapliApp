'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/components/Avatar'
import {
  addGroupMember,
  removeGroupMember,
  updateGroupName,
  updateGroupAvatar,
  updateGroupDescription,
} from '@/app/(app)/messages/actions'
import type { ConversationParticipant } from '@/types'

type Profile = {
  id:           string
  username:     string
  display_name: string | null
  avatar_url:   string | null
}

type Props = {
  conversationId:             string
  groupName:                  string
  groupAvatarUrl:             string | null
  groupDescription:           string | null
  participants:               ConversationParticipant[]
  createdBy:                  string | null
  currentUserId:              string
  onGroupNameChanged:         (name: string) => void
  onGroupAvatarChanged:       (url: string) => void
  onGroupDescriptionChanged:  (desc: string) => void
  onParticipantsChanged:      (participants: ConversationParticipant[]) => void
  onClose: () => void
}

export default function GroupMembersModal({
  conversationId,
  groupName,
  groupAvatarUrl,
  groupDescription,
  participants,
  createdBy,
  currentUserId,
  onGroupNameChanged,
  onGroupAvatarChanged,
  onGroupDescriptionChanged,
  onParticipantsChanged,
  onClose,
}: Props) {
  const supabase  = createClient()
  const isCreator = createdBy === currentUserId

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // avatar
  const fileRef        = useRef<HTMLInputElement>(null)
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(groupAvatarUrl)
  const [uploading,      setUploading]      = useState(false)

  // group name
  const [editingName, setEditingName] = useState(false)
  const [nameInput,   setNameInput]   = useState(groupName)
  const [savingName,  setSavingName]  = useState(false)

  // description
  const [descInput,   setDescInput]   = useState(groupDescription ?? '')
  const [savingDesc,  setSavingDesc]  = useState(false)

  // members / search
  const [query,         setQuery]         = useState('')
  const [results,       setResults]       = useState<Profile[]>([])
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [removingId,    setRemovingId]    = useState<string | null>(null)
  const [addingId,      setAddingId]      = useState<string | null>(null)
  const [errorMsg,      setErrorMsg]      = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Avatar upload ───────────────────────────────────────────────────────────
  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setErrorMsg(null)

    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `${conversationId}/avatar.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from('group-avatars')
      .upload(path, file, { contentType: file.type, upsert: true })

    if (uploadErr) {
      setErrorMsg('Erro ao enviar a imagem')
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('group-avatars')
      .getPublicUrl(path)

    const { error: saveErr } = await updateGroupAvatar(conversationId, publicUrl)
    if (saveErr) {
      setErrorMsg(saveErr)
    } else {
      setLocalAvatarUrl(publicUrl)
      onGroupAvatarChanged(publicUrl)
    }
    setUploading(false)
    // reset so the same file can be re-selected
    e.target.value = ''
  }

  // ── Group name ──────────────────────────────────────────────────────────────
  async function saveName() {
    if (!nameInput.trim() || nameInput.trim() === groupName) { setEditingName(false); return }
    setSavingName(true)
    const { error } = await updateGroupName(conversationId, nameInput.trim())
    setSavingName(false)
    if (error) { setErrorMsg(error); return }
    onGroupNameChanged(nameInput.trim())
    setEditingName(false)
  }

  // ── Description ─────────────────────────────────────────────────────────────
  async function saveDescription() {
    setSavingDesc(true)
    const { error } = await updateGroupDescription(conversationId, descInput)
    setSavingDesc(false)
    if (error) { setErrorMsg(error); return }
    onGroupDescriptionChanged(descInput.trim())
  }

  // ── Search ──────────────────────────────────────────────────────────────────
  async function search(q: string) {
    if (!q.trim()) { setResults([]); return }
    setLoadingSearch(true)
    const existingIds = participants.map(p => p.id)
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .or(`username.ilike.%${q.trim()}%,display_name.ilike.%${q.trim()}%`)
      .not('id', 'in', `(${existingIds.join(',')})`)
      .limit(6)
    setResults((data as Profile[] | null) ?? [])
    setLoadingSearch(false)
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value
    setQuery(q)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => void search(q), 300)
  }

  async function handleRemove(memberId: string) {
    setRemovingId(memberId)
    setErrorMsg(null)
    const { error } = await removeGroupMember(conversationId, memberId)
    setRemovingId(null)
    if (error) { setErrorMsg(error); return }
    onParticipantsChanged(participants.filter(p => p.id !== memberId))
  }

  async function handleAdd(profile: Profile) {
    setAddingId(profile.id)
    setErrorMsg(null)
    const { error } = await addGroupMember(conversationId, profile.id)
    setAddingId(null)
    if (error) { setErrorMsg(error); return }
    const newMember: ConversationParticipant = {
      id: profile.id, username: profile.username,
      display_name: profile.display_name, avatar_url: profile.avatar_url,
    }
    onParticipantsChanged([...participants, newMember])
    setResults(prev => prev.filter(p => p.id !== profile.id))
    setQuery('')
  }

  const letters = groupName.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3.5">
          <h2 className="text-sm font-bold text-zinc-100">Configurações do grupo</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
            aria-label="Fechar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="h-4 w-4" aria-hidden>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto p-4 space-y-4">

          {/* Group avatar */}
          <div className="flex justify-center">
            <div className="relative">
              {localAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={localAvatarUrl}
                  alt="Foto do grupo"
                  className="h-20 w-20 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#7F77DD] text-2xl font-bold text-white">
                  {letters}
                </div>
              )}
              {isCreator && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  aria-label="Trocar foto do grupo"
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity hover:opacity-100 focus:opacity-100 disabled:opacity-50"
                >
                  {uploading ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="h-6 w-6 animate-spin text-white" aria-hidden>
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-white" aria-hidden>
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  )}
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={e => void handleAvatarChange(e)}
            />
          </div>

          {/* Group name */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-zinc-400">Nome do grupo</p>
            {editingName ? (
              <div className="flex gap-2">
                <input
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                  type="text"
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') void saveName()
                    if (e.key === 'Escape') { setEditingName(false); setNameInput(groupName) }
                  }}
                  maxLength={60}
                  className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[#D4537E]"
                />
                <button
                  type="button"
                  onClick={() => void saveName()}
                  disabled={savingName || !nameInput.trim()}
                  className="rounded-xl bg-[#D4537E] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {savingName ? '…' : 'Salvar'}
                </button>
                <button
                  type="button"
                  onClick={() => { setEditingName(false); setNameInput(groupName) }}
                  className="rounded-xl border border-zinc-700 px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-zinc-100">{groupName}</p>
                {isCreator && (
                  <button
                    type="button"
                    onClick={() => setEditingName(true)}
                    className="shrink-0 rounded-lg px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
                  >
                    Editar
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Group description */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-zinc-400">Descrição</p>
            {isCreator ? (
              <>
                <textarea
                  value={descInput}
                  onChange={e => setDescInput(e.target.value.slice(0, 500))}
                  maxLength={500}
                  rows={3}
                  placeholder="Sobre esse grupo…"
                  className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-[#D4537E]"
                />
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[10px] text-zinc-600">{descInput.length}/500</span>
                  {descInput.trim() !== (groupDescription ?? '').trim() && (
                    <button
                      type="button"
                      onClick={() => void saveDescription()}
                      disabled={savingDesc}
                      className="rounded-lg px-2.5 py-1 text-xs font-semibold text-[#D4537E] transition-colors hover:bg-zinc-800 disabled:opacity-50"
                    >
                      {savingDesc ? '…' : 'Salvar'}
                    </button>
                  )}
                </div>
              </>
            ) : (
              groupDescription
                ? <p className="text-sm leading-relaxed text-zinc-400">{groupDescription}</p>
                : <p className="text-sm text-zinc-600 italic">Sem descrição</p>
            )}
          </div>

          {/* Members list */}
          <div>
            <p className="mb-2 text-xs font-medium text-zinc-400">{participants.length} membro{participants.length !== 1 ? 's' : ''}</p>
            <div className="space-y-1">
              {participants.map(p => {
                const isMe     = p.id === currentUserId
                const isOwner  = p.id === createdBy
                const removing = removingId === p.id
                return (
                  <div key={p.id} className="flex items-center gap-3 rounded-xl px-3 py-2">
                    <Avatar src={p.avatar_url} name={p.display_name || p.username} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-200">
                        {p.display_name || p.username}
                        {isMe    && <span className="ml-1.5 text-xs text-zinc-500">(você)</span>}
                        {isOwner && <span className="ml-1.5 text-[10px] font-semibold text-[#7F77DD]">criador</span>}
                      </p>
                      <p className="truncate text-xs text-zinc-500">@{p.username}</p>
                    </div>
                    {isCreator && !isMe && (
                      <button
                        type="button"
                        onClick={() => void handleRemove(p.id)}
                        disabled={!!removingId}
                        className="shrink-0 rounded-lg px-2 py-1 text-xs text-zinc-600 transition-colors hover:bg-red-950/40 hover:text-red-400 disabled:opacity-50"
                      >
                        {removing ? '…' : 'Remover'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Add member (creator only) */}
          {isCreator && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-zinc-400">Adicionar membro</p>
              <div className="relative mb-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 pointer-events-none" aria-hidden>
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="search"
                  value={query}
                  onChange={handleSearchChange}
                  placeholder="Buscar pelo nome ou @username…"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 py-2.5 pl-9 pr-4 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-[#D4537E]"
                />
              </div>
              {loadingSearch && <p className="px-2 text-xs text-zinc-500">Buscando…</p>}
              {results.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => void handleAdd(p)}
                  disabled={!!addingId}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-zinc-800 disabled:opacity-60"
                >
                  <Avatar src={p.avatar_url} name={p.display_name || p.username} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-200">{p.display_name || p.username}</p>
                    <p className="truncate text-xs text-zinc-500">@{p.username}</p>
                  </div>
                  {addingId === p.id ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="h-4 w-4 shrink-0 animate-spin text-zinc-400" aria-hidden>
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden>
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}

          {errorMsg && <p className="text-xs text-red-400">{errorMsg}</p>}
        </div>
      </div>
    </div>
  )
}
