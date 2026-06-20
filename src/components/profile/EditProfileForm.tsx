'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/components/Avatar'
import type { Profile } from '@/types'

export default function EditProfileForm({ profile }: { profile: Profile }) {
  const [displayName,    setDisplayName]    = useState(profile.display_name ?? '')
  const [username,       setUsername]       = useState(profile.username ?? '')
  const [bio,            setBio]            = useState(profile.bio ?? '')
  const [lastfmUsername, setLastfmUsername] = useState(profile.lastfm_username ?? '')
  const [avatarUrl,      setAvatarUrl]      = useState(profile.avatar_url)
  const [preview,        setPreview]        = useState<string | null>(null)
  const [avatarFile,     setAvatarFile]     = useState<File | null>(null)
  const [saving,         setSaving]         = useState(false)
  const [error,          setError]          = useState<string | null>(null)

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

  function handleUsernameChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Allow only lowercase letters, numbers, and underscores
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

  const previewSrc = preview ?? avatarUrl

  return (
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
