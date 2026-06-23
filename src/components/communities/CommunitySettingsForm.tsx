'use client'

import { useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Community } from '@/types'
import { updateCommunitySettings, deleteCommunity } from '@/app/(app)/communities/actions'

interface Props {
  community: Community
}

export default function CommunitySettingsForm({ community }: Props) {
  const router   = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const fileRef  = useRef<HTMLInputElement>(null)

  const [name, setName]               = useState(community.name)
  const [description, setDescription] = useState(community.description ?? '')
  const [permission, setPermission]   = useState(community.post_permission)
  const [avatarUrl, setAvatarUrl]     = useState<string | null>(community.avatar_url)
  const [avatarFile, setAvatarFile]   = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(community.avatar_url)
  const [saving, setSaving]           = useState(false)
  const [deleting, setDeleting]       = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [success, setSuccess]         = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)

    let finalAvatarUrl = avatarUrl

    if (avatarFile) {
      const ext  = avatarFile.name.split('.').pop() ?? 'jpg'
      const path = `${community.id}/avatar.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('community-avatars')
        .upload(path, avatarFile, { contentType: avatarFile.type, upsert: true })

      if (uploadErr) {
        setError('Não foi possível fazer upload da foto. Verifique o bucket "community-avatars" no Supabase Storage.')
        setSaving(false)
        return
      }

      const { data: { publicUrl } } = supabase.storage
        .from('community-avatars')
        .getPublicUrl(path)

      finalAvatarUrl = publicUrl
      setAvatarUrl(publicUrl)
      setAvatarFile(null)
    }

    try {
      await updateCommunitySettings(community.id, {
        name:            name.trim(),
        description:     description.trim() || null,
        post_permission: permission,
        avatar_url:      finalAvatarUrl,
      })
      setSuccess(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteCommunity(community.id)
      router.push('/communities')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir')
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={handleSave} className="space-y-4">
        <h2 className="text-base font-semibold text-white">Configurações</h2>

        {/* Avatar upload */}
        <div>
          <label className="block text-sm text-zinc-400 mb-2">Foto da comunidade</label>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="relative group shrink-0 focus:outline-none"
              aria-label="Alterar foto da comunidade"
            >
              {avatarPreview ? (
                <Image
                  src={avatarPreview}
                  alt={community.name}
                  width={64} height={64}
                  className="w-16 h-16 rounded-xl object-cover"
                  unoptimized={avatarPreview.startsWith('blob:')}
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-[#7F77DD]/30 flex items-center justify-center text-2xl">
                  🏘️
                </div>
              )}
              <div className="absolute inset-0 rounded-xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white text-xs font-medium">Alterar</span>
              </div>
            </button>
            <div className="text-xs text-zinc-500 space-y-0.5">
              <p>Clique para alterar a foto</p>
              <p>JPG, PNG ou WebP · Recomendado 256×256px</p>
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-1">Nome</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={60}
            className="w-full rounded-xl bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#D4537E]"
          />
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-1">Descrição</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-xl bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#D4537E]"
          />
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-1">Quem pode postar?</label>
          <select
            value={permission}
            onChange={e => setPermission(e.target.value as Community['post_permission'])}
            className="w-full rounded-xl bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#D4537E]"
          >
            <option value="all">Todos os membros</option>
            <option value="owner_only">Só o dono</option>
            <option value="allowed_users">Membros autorizados</option>
          </select>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}
        {success && <p className="text-xs text-green-400">Salvo!</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-[#D4537E] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90 transition"
        >
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
      </form>

      <div className="border-t border-white/10 pt-6">
        <h3 className="text-sm font-semibold text-red-400 mb-2">Zona de perigo</h3>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="rounded-xl bg-red-700/20 px-4 py-2 text-sm text-red-400 hover:bg-red-700/40 transition"
          >
            Excluir comunidade
          </button>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-sm text-red-400">Tem certeza? Isso não pode ser desfeito.</p>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {deleting ? '…' : 'Excluir'}
            </button>
            <button onClick={() => setConfirmDelete(false)} className="text-sm text-zinc-400 hover:text-white">
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
