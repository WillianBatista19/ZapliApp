'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/components/Avatar'
import ConfirmModal from '@/components/ui/ConfirmModal'
import MediaSearchModal, { BookIcon, MovieIcon } from '@/components/ui/MediaSearchModal'
import type { MediaResult } from '@/components/ui/MediaSearchModal'
import type { Profile, WatchingNow, ReadingNow } from '@/types'

export default function EditProfileForm({ profile }: { profile: Profile }) {
  const [displayName,        setDisplayName]        = useState(profile.display_name ?? '')
  const [username,           setUsername]           = useState(profile.username ?? '')
  const [bio,                setBio]                = useState(profile.bio ?? '')
  const [lastfmUsername,     setLastfmUsername]     = useState(profile.lastfm_username ?? '')
  const [avatarUrl,          setAvatarUrl]          = useState(profile.avatar_url)
  const [preview,            setPreview]            = useState<string | null>(null)
  const [avatarFile,         setAvatarFile]         = useState<File | null>(null)
  const [saving,             setSaving]             = useState(false)
  const [error,              setError]              = useState<string | null>(null)
  const [showDeleteModal,    setShowDeleteModal]    = useState(false)
  const [deleting,           setDeleting]           = useState(false)
  const [deleteError,        setDeleteError]        = useState<string | null>(null)
  const [watchingNow,        setWatchingNow]        = useState<WatchingNow | null>(profile.watching_now ?? null)
  const [readingNow,         setReadingNow]         = useState<ReadingNow  | null>(profile.reading_now  ?? null)
  const [showWatchingSearch, setShowWatchingSearch] = useState(false)
  const [showReadingSearch,  setShowReadingSearch]  = useState(false)

  const fileRef  = useRef<HTMLInputElement>(null)
  const supabase = useMemo(() => createClient(), [])
  const router   = useRouter()

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('A foto precisa ter no máximo 5 MB.')
      return
    }
    setAvatarFile(file)
    setPreview(URL.createObjectURL(file))
    setError(null)
  }

  function handleWatchingSelect(r: MediaResult) {
    setWatchingNow({ id: Number(r.id), title: r.title, year: r.subtitle, poster_url: r.imageUrl })
    setShowWatchingSearch(false)
  }

  function handleReadingSelect(r: MediaResult) {
    setReadingNow({ id: r.id, title: r.title, author: r.subtitle, cover_url: r.imageUrl })
    setShowReadingSearch(false)
  }

  function handleUsernameChange(e: React.ChangeEvent<HTMLInputElement>) {
    setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return

    const trimmedName     = displayName.trim()
    const trimmedUsername = username.trim()

    if (!trimmedName || !trimmedUsername) {
      setError('Nome e usuário são obrigatórios.')
      return
    }
    if (trimmedUsername.length < 3) {
      setError('O usuário precisa ter pelo menos 3 caracteres.')
      return
    }

    setSaving(true)
    setError(null)

    let finalAvatarUrl = avatarUrl

    if (avatarFile) {
      const ext  = avatarFile.name.split('.').pop() ?? 'jpg'
      const path = `${profile.id}/avatar.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type })

      if (uploadErr) {
        setError('Não foi possível fazer upload da foto. Verifique se o bucket "avatars" existe no Supabase Storage.')
        setSaving(false)
        return
      }

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(path)

      finalAvatarUrl = publicUrl
    }

    const { error: updateErr } = await supabase
      .from('profiles')
      .update({
        display_name:    trimmedName,
        username:        trimmedUsername,
        bio:             bio.trim() || null,
        avatar_url:      finalAvatarUrl,
        lastfm_username: lastfmUsername.trim() || null,
        watching_now:    watchingNow,
        reading_now:     readingNow,
      })
      .eq('id', profile.id)

    if (updateErr) {
      const isDupe = updateErr.message.toLowerCase().includes('unique') ||
                     updateErr.message.toLowerCase().includes('duplicate')
      setError(
        isDupe
          ? 'Esse nome de usuário já está em uso. Escolhe outro!'
          : 'Não foi possível salvar. Tenta de novo!',
      )
      setSaving(false)
      return
    }

    router.push(`/profile/${trimmedUsername}`)
    router.refresh()
  }

  async function handleDeleteAccount() {
    setDeleting(true)
    setDeleteError(null)

    const { error: deleteErr } = await supabase
      .from('profiles')
      .delete()
      .eq('id', profile.id)

    if (deleteErr) {
      setDeleteError('Não foi possível excluir a conta. Tenta de novo!')
      setDeleting(false)
      return
    }

    await supabase.auth.signOut()
    router.push('/login')
  }

  const previewSrc = preview ?? avatarUrl

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Avatar picker */}
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="group relative"
            aria-label="Trocar foto de perfil"
          >
            <Avatar
              src={previewSrc}
              name={displayName || username}
              size="lg"
              className="ring-4 ring-zinc-800 transition-all group-hover:ring-pink"
            />
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-black/60 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
              Trocar
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={onFileChange}
          />
          <p className="text-xs text-zinc-600">Clique na foto para trocar · máx. 5 MB</p>
        </div>

        {/* Fields */}
        <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">

          <FormField label="Nome">
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={50}
              required
              placeholder="Seu nome"
              className="input-base"
            />
          </FormField>

          <FormField label="Usuário">
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
                @
              </span>
              <input
                value={username}
                onChange={handleUsernameChange}
                maxLength={30}
                required
                placeholder="seuusuario"
                className="input-base pl-8"
              />
            </div>
            <p className="mt-1 text-xs text-zinc-600">
              Apenas letras minúsculas, números e _
            </p>
          </FormField>

          <FormField label="Bio">
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={160}
              rows={3}
              placeholder="Conta algo sobre você…"
              className="input-base resize-none"
            />
            <p className="mt-1 text-right text-xs text-zinc-600">
              {bio.length}/160
            </p>
          </FormField>

          <FormField label="Last.fm">
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
                🎵
              </span>
              <input
                value={lastfmUsername}
                onChange={(e) => setLastfmUsername(e.target.value.trim())}
                maxLength={50}
                placeholder="seu_usuario_lastfm"
                className="input-base pl-9"
              />
            </div>
            <p className="mt-1 text-xs text-zinc-600">
              Aparece seu histórico no perfil.{' '}
              <a
                href="https://www.last.fm"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#D4537E] hover:underline"
              >
                last.fm
              </a>
            </p>
          </FormField>

          <FormField label="Assistindo agora">
            {watchingNow ? (
              <div className="flex items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-800/50 p-3">
                {watchingNow.poster_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={watchingNow.poster_url}
                    alt=""
                    className="h-14 w-10 flex-shrink-0 rounded-lg object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-100">{watchingNow.title}</p>
                  {watchingNow.year && <p className="text-xs text-zinc-500">{watchingNow.year}</p>}
                </div>
                <div className="flex flex-shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setShowWatchingSearch(true)}
                    className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-400"
                  >
                    Trocar
                  </button>
                  <button
                    type="button"
                    onClick={() => setWatchingNow(null)}
                    className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-red-400 transition-colors hover:border-red-800/60"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowWatchingSearch(true)}
                className="flex w-full items-center gap-2 rounded-xl border border-dashed border-zinc-700 px-4 py-3 text-sm text-zinc-500 transition-colors hover:border-zinc-500 hover:text-zinc-300"
              >
                <MovieIcon className="h-4 w-4" />
                Buscar filme ou série
              </button>
            )}
          </FormField>

          <FormField label="Lendo agora">
            {readingNow ? (
              <div className="flex items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-800/50 p-3">
                {readingNow.cover_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={readingNow.cover_url}
                    alt=""
                    className="h-14 w-10 flex-shrink-0 rounded-lg object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-100">{readingNow.title}</p>
                  {readingNow.author && <p className="text-xs text-zinc-500">{readingNow.author}</p>}
                </div>
                <div className="flex flex-shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setShowReadingSearch(true)}
                    className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-400"
                  >
                    Trocar
                  </button>
                  <button
                    type="button"
                    onClick={() => setReadingNow(null)}
                    className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-red-400 transition-colors hover:border-red-800/60"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowReadingSearch(true)}
                className="flex w-full items-center gap-2 rounded-xl border border-dashed border-zinc-700 px-4 py-3 text-sm text-zinc-500 transition-colors hover:border-zinc-500 hover:text-zinc-300"
              >
                <BookIcon className="h-4 w-4" />
                Buscar livro
              </button>
            )}
          </FormField>

        </div>

        {error && (
          <div className="rounded-xl border border-red-800/40 bg-red-950/40 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="btn-primary"
        >
          {saving ? 'Salvando…' : 'Salvar alterações'}
        </button>

      </form>

      {/* ── Danger zone ── */}
      <div className="mt-10 rounded-2xl border border-red-900/40 bg-red-950/10 p-5">
        <h3 className="mb-1 text-sm font-semibold text-red-400">Zona de perigo</h3>
        <p className="mb-4 text-xs text-zinc-500">
          Excluir sua conta apaga permanentemente seus posts, comentários e todos os seus dados. Esta ação não pode ser desfeita.
        </p>
        {deleteError && (
          <p className="mb-3 text-xs text-red-400">{deleteError}</p>
        )}
        <button
          type="button"
          onClick={() => setShowDeleteModal(true)}
          className="rounded-xl border border-red-800/60 bg-transparent px-4 py-2 text-sm font-semibold text-red-400 transition-colors hover:bg-red-950/60 hover:text-red-300"
        >
          Excluir minha conta
        </button>
      </div>

      {showDeleteModal && (
        <ConfirmModal
          title="Tem certeza que quer excluir sua conta?"
          message="Esta ação é permanente e irá apagar todos os seus posts, comentários, stories, vibes e seguidores. Não tem como desfazer."
          confirmLabel="Excluir conta"
          loading={deleting}
          variant="danger"
          onConfirm={handleDeleteAccount}
          onCancel={() => { setShowDeleteModal(false); setDeleteError(null) }}
        />
      )}

      {showWatchingSearch && (
        <MediaSearchModal
          type="movie"
          onSelect={handleWatchingSelect}
          onClose={() => setShowWatchingSearch(false)}
        />
      )}

      {showReadingSearch && (
        <MediaSearchModal
          type="book"
          onSelect={handleReadingSelect}
          onClose={() => setShowReadingSearch(false)}
        />
      )}
    </>
  )
}

function FormField({
  label,
  children,
}: {
  label:    string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      {children}
    </div>
  )
}
