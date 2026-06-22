'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { updateGroupAvatar } from '@/app/(app)/messages/actions'

type Props = {
  src:             string | null
  groupName:       string
  conversationId:  string
  isCreator:       boolean
  onAvatarChanged: (url: string) => void
  onClose:         () => void
}

export default function GroupAvatarViewerModal({
  src,
  groupName,
  conversationId,
  isCreator,
  onAvatarChanged,
  onClose,
}: Props) {
  const supabase = createClient()
  const fileRef  = useRef<HTMLInputElement>(null)

  const [uploading, setUploading] = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [localSrc,  setLocalSrc]  = useState(src)

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Escape to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)

    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `${conversationId}/avatar.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from('group-avatars')
      .upload(path, file, { contentType: file.type, upsert: true })

    if (uploadErr) {
      setError('Erro ao enviar a imagem')
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('group-avatars')
      .getPublicUrl(path)

    const { error: saveErr } = await updateGroupAvatar(conversationId, publicUrl)
    if (saveErr) {
      setError(saveErr)
    } else {
      setLocalSrc(publicUrl)
      onAvatarChanged(publicUrl)
    }
    setUploading(false)
    e.target.value = ''
  }

  const letters = groupName.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar"
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800/80 text-zinc-300 backdrop-blur transition-colors hover:bg-zinc-700 hover:text-white"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="h-5 w-5" aria-hidden>
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>

      {/* Image or letter avatar */}
      <div className="flex items-center justify-center" onClick={e => e.stopPropagation()}>
        {localSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={localSrc}
            alt={`Foto do grupo ${groupName}`}
            className="max-h-[70vh] max-w-[85vw] rounded-2xl object-contain shadow-2xl sm:max-w-[400px]"
          />
        ) : (
          <div className="flex h-48 w-48 items-center justify-center rounded-full bg-[#7F77DD] text-6xl font-bold text-white shadow-2xl">
            {letters}
          </div>
        )}
      </div>

      {/* Creator: change photo */}
      {isCreator && (
        <div className="mt-6 flex flex-col items-center gap-2" onClick={e => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 rounded-xl border border-zinc-600 bg-zinc-900/80 px-4 py-2 text-sm font-medium text-zinc-200 backdrop-blur transition-colors hover:border-zinc-400 hover:text-white disabled:opacity-50"
          >
            {uploading ? (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="h-4 w-4 animate-spin" aria-hidden>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Enviando…
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                Alterar foto
              </>
            )}
          </button>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={e => void handleFileChange(e)}
          />
        </div>
      )}
    </div>
  )
}
