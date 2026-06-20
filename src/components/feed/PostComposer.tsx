'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/components/Avatar'
import type { Category, Profile } from '@/types'

const MAX = 500

const IMAGE_LIMIT = 10 * 1024 * 1024
const VIDEO_LIMIT = 50 * 1024 * 1024

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'anime',  label: 'Anime'  },
  { value: 'bbb',    label: 'BBB'    },
  { value: 'musica', label: 'Música' },
  { value: 'serie',  label: 'Série'  },
  { value: 'filme',  label: 'Filme'  },
  { value: 'livro',  label: 'Livro'  },
]

export default function PostComposer({ profile }: { profile: Profile }) {
  const [content,        setContent]        = useState('')
  const [mediaUrl,       setMediaUrl]       = useState('')
  const [category,       setCategory]       = useState<Category | null>(null)
  const [error,          setError]          = useState<string | null>(null)
  const [submitting,     setSubmitting]     = useState(false)
  const [mediaFile,      setMediaFile]      = useState<File | null>(null)
  const [mediaPreview,   setMediaPreview]   = useState<string | null>(null)
  const [mediaType,      setMediaType]      = useState<'image' | 'video' | null>(null)
  const [mediaError,  setMediaError]  = useState<string | null>(null)
  const [albumArtUrl, setAlbumArtUrl] = useState<string | null>(null)
  const [lastfmLoading,  setLastfmLoading]  = useState(false)
  const [toast,          setToast]          = useState<string | null>(null)

  const textareaRef   = useRef<HTMLTextAreaElement>(null)
  const galleryRef    = useRef<HTMLInputElement>(null)
  const previewUrlRef = useRef<string | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const supabase      = useMemo(() => createClient(), [])

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  const trimmed   = content.trim()
  const remaining = MAX - content.length
  const overLimit = remaining < 0
  const canPost   = (trimmed.length > 0 || mediaFile !== null || albumArtUrl !== null) && !overLimit && !submitting

  function resize() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 300) + 'px'
  }

  function detectEmbed(url: string): 'spotify' | 'youtube' | null {
    if (url.includes('spotify.com'))                              return 'spotify'
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
    return null
  }

  function showToast(msg: string) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast(msg)
    toastTimerRef.current = setTimeout(() => setToast(null), 3000)
  }

  function handleMedia(file: File | null) {
    if (!file) return

    const isVideo = file.type.startsWith('video/')
    const limit   = isVideo ? VIDEO_LIMIT : IMAGE_LIMIT

    if (file.size > limit) {
      const mb = Math.round(limit / (1024 * 1024))
      setMediaError(`Arquivo muito grande. Limite: ${mb}MB para ${isVideo ? 'vídeos' : 'imagens/GIFs'}`)
      return
    }

    setMediaError(null)
    setAlbumArtUrl(null)

    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    const url = URL.createObjectURL(file)
    previewUrlRef.current = url

    setMediaFile(file)
    setMediaType(isVideo ? 'video' : 'image')
    setMediaPreview(url)
  }

  function removeMedia() {
    if (previewUrlRef.current) { URL.revokeObjectURL(previewUrlRef.current); previewUrlRef.current = null }
    setMediaFile(null)
    setMediaPreview(null)
    setMediaType(null)
    setMediaError(null)
    setAlbumArtUrl(null)
    if (galleryRef.current) galleryRef.current.value = ''
  }

  function openCamera() {
    const input    = document.createElement('input')
    input.type     = 'file'
    input.accept   = 'image/*'
    input.capture  = 'environment'
    input.onchange = (e) => handleMedia((e.target as HTMLInputElement).files?.[0] ?? null)
    input.click()
  }

  async function fetchNowPlaying() {
    if (!profile.lastfm_username || lastfmLoading) return
    setLastfmLoading(true)

    try {
      const qs   = new URLSearchParams({ method: 'user.getrecenttracks', user: profile.lastfm_username, limit: '1' })
      const res  = await fetch(`/api/lastfm?${qs}`)
      const json = await res.json()

      const raw   = json?.recenttracks?.track
      const track = Array.isArray(raw) ? raw[0] : (raw ?? null)

      if (!track || track['@attr']?.nowplaying !== 'true') {
        showToast('Nenhuma música tocando no momento')
        return
      }

      const trackName  = String(track.name  ?? '')
      const artistName = String(track.artist?.['#text'] ?? '')
      const trackUrl   = String(track.url   ?? '')

      const images = (track.image ?? []) as Array<{ '#text': string; size: string }>
      const artUrl =
        images.find(i => i.size === 'extralarge')?.['#text'] ||
        images.find(i => i.size === 'large')?.['#text'] ||
        ''

      setContent(`Ouvindo agora: ${trackName} — ${artistName}`)
      requestAnimationFrame(() => resize())

      if (trackUrl) setMediaUrl(trackUrl)

      if (artUrl) {
        // Clear any existing file upload; use the CDN URL directly
        if (previewUrlRef.current) { URL.revokeObjectURL(previewUrlRef.current); previewUrlRef.current = null }
        setMediaFile(null)
        setMediaError(null)
        setAlbumArtUrl(artUrl)
        setMediaPreview(artUrl)
        setMediaType('image')
      }
    } catch {
      showToast('Erro ao buscar música. Tenta de novo!')
    } finally {
      setLastfmLoading(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!canPost) return

    setError(null)
    setSubmitting(true)

    let mediaStorageUrl: string | null = null

    if (mediaFile) {
      const ext  = mediaFile.name.split('.').pop() || 'bin'
      const path = `${profile.id}/${Date.now()}.${ext}`
      console.log('[PostComposer] uploading:', path)

      const { error: uploadErr } = await supabase.storage
        .from('post-images')
        .upload(path, mediaFile, { contentType: mediaFile.type })

      if (uploadErr) {
        console.error('[PostComposer] upload error:', uploadErr)
        setError('Erro ao enviar o arquivo. Tenta de novo!')
        setSubmitting(false)
        return
      }

      const { data: { publicUrl } } = supabase.storage.from('post-images').getPublicUrl(path)
      mediaStorageUrl = publicUrl
      console.log('[PostComposer] uploaded, publicUrl:', mediaStorageUrl)
    } else if (albumArtUrl) {
      // Store Last.fm CDN URL directly — no upload needed
      mediaStorageUrl = albumArtUrl
    }

    const embedUrl = mediaUrl.trim()
    const eType    = embedUrl ? detectEmbed(embedUrl) : null

    console.log('[PostComposer] inserting with image_url:', mediaStorageUrl)
    const { error: dbErr } = await supabase.from('posts').insert({
      user_id:     profile.id,
      content:     trimmed,
      category:    category,
      spotify_url: eType === 'spotify' ? embedUrl : null,
      youtube_url: eType === 'youtube' ? embedUrl : null,
      image_url:   mediaStorageUrl,
    })

    if (dbErr) {
      console.error('[PostComposer] insert error:', dbErr)
      setError('Não foi possível publicar. Tenta de novo!')
    } else {
      setContent('')
      setMediaUrl('')
      setCategory(null)
      removeMedia()
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
    }

    setSubmitting(false)
  }

  const ringColour    = overLimit ? '#ef4444' : remaining <= 50 ? '#f97316' : '#D4537E'
  const circumference = 2 * Math.PI * 9
  const filled        = Math.min(circumference, (content.length / MAX) * circumference)

  return (
    <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-4 shadow-lg">
      {/* Hidden file inputs */}
      <input
        ref={galleryRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
        className="hidden"
        onChange={e => handleMedia(e.target.files?.[0] ?? null)}
      />

      <form onSubmit={submit} noValidate className="w-full">

        {/* ── Row 1: Avatar + Textarea ── */}
        <div className="flex gap-3">
          <Avatar
            src={profile.avatar_url}
            name={profile.display_name || profile.username || 'U'}
            size="md"
          />
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => { setContent(e.target.value); resize() }}
            placeholder="O que tá rolando, incelica?"
            rows={3}
            className={[
              'min-w-0 flex-1 resize-none bg-transparent text-sm leading-relaxed',
              'placeholder-zinc-500 outline-none',
              overLimit ? 'text-red-400' : 'text-zinc-100',
            ].join(' ')}
          />
        </div>

        {/* ── Media buttons ── */}
        <div className="mt-2 flex items-center gap-1">
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            title="Enviar foto, GIF ou vídeo"
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-[#D4537E] active:scale-95"
          >
            <PhotoIcon className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={openCamera}
            title="Tirar foto"
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-[#D4537E] active:scale-95"
          >
            <CameraIcon className="h-5 w-5" />
          </button>

          {/* Last.fm now playing — only visible when the user has lastfm_username */}
          {profile.lastfm_username && (
            <button
              type="button"
              onClick={fetchNowPlaying}
              disabled={lastfmLoading}
              title="Ouvindo agora no Last.fm"
              className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-[#D4537E] active:scale-95 disabled:opacity-50"
            >
              {lastfmLoading
                ? <SpinnerIcon className="h-5 w-5 animate-spin" />
                : <MusicNoteIcon className="h-5 w-5" />
              }
            </button>
          )}
        </div>

        {/* ── Toast (now playing feedback) ── */}
        {toast && (
          <p className="mt-1.5 text-xs text-zinc-400">{toast}</p>
        )}

        {/* ── File size error ── */}
        {mediaError && (
          <p className="mt-1 text-xs text-red-400">{mediaError}</p>
        )}

        {/* ── Media preview ── */}
        {mediaPreview && (
          <div className="relative mt-2 w-fit">
            {mediaType === 'video' ? (
              <video
                src={mediaPreview}
                controls
                muted
                playsInline
                className="max-h-48 rounded-xl"
              />
            ) : albumArtUrl ? (
              /* Album art: fixed square, contain so the full cover is visible */
              <div
                className="flex h-48 w-48 items-center justify-center overflow-hidden rounded-xl"
                style={{ background: '#0c0c0f' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mediaPreview!}
                  alt="Capa do álbum"
                  className="h-full w-full object-contain"
                />
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mediaPreview}
                alt="Prévia"
                className="max-h-48 rounded-xl object-cover"
              />
            )}
            <button
              type="button"
              onClick={removeMedia}
              aria-label="Remover mídia"
              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-700 text-zinc-300 shadow-md transition-colors hover:bg-red-950 hover:text-red-400"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* ── Spotify / YouTube embed URL ── */}
        <div className="mt-3">
          <input
            type="text"
            value={mediaUrl}
            onChange={e => setMediaUrl(e.target.value)}
            placeholder="🎵 Link do Spotify ou YouTube (opcional)"
            className="input-base py-2 text-xs"
          />
        </div>

        {/* ── Category pills ── */}
        <div className="mt-3 flex flex-wrap gap-2">
          {CATEGORIES.map(({ value, label }) => {
            const active = category === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => setCategory(active ? null : value)}
                className={[
                  'rounded-full border px-3 py-1 text-xs font-medium',
                  'transition-all duration-150 active:scale-95',
                  active
                    ? 'border-pink bg-pink/20 text-pink'
                    : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200',
                ].join(' ')}
              >
                #{label}
              </button>
            )
          })}
        </div>

        {/* ── Footer: ring + error + submit ── */}
        <div className="mt-3 flex items-center gap-3 border-t border-zinc-800 pt-3">
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <svg width="24" height="24" viewBox="0 0 24 24" className="-rotate-90">
              <circle cx="12" cy="12" r="9" fill="none" strokeWidth="2.5" stroke="#3f3f46" />
              {content.length > 0 && (
                <circle
                  cx="12" cy="12" r="9"
                  fill="none"
                  strokeWidth="2.5"
                  stroke={ringColour}
                  strokeDasharray={`${filled} ${circumference}`}
                  strokeLinecap="round"
                />
              )}
            </svg>
            <span className={`text-xs tabular-nums ${overLimit ? 'text-red-400' : 'text-zinc-500'}`}>
              {remaining}
            </span>
          </div>

          {error && <p className="flex-1 text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={!canPost}
            className={[
              'ml-auto rounded-xl bg-pink px-5 py-2 text-sm font-semibold text-white',
              'transition-all duration-150 active:scale-95',
              canPost
                ? 'hover:bg-pink-hover cursor-pointer'
                : 'cursor-not-allowed opacity-50',
            ].join(' ')}
          >
            {submitting ? 'Postando…' : 'Postar'}
          </button>
        </div>

      </form>
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function PhotoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M15 8h.01" />
      <path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12z" />
      <path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" />
      <path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3" />
    </svg>
  )
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M5 7h1a2 2 0 0 0 2 -2a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2" />
      <path d="M9 13a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />
    </svg>
  )
}

function MusicNoteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  )
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M18 6l-12 12" />
      <path d="M6 6l12 12" />
    </svg>
  )
}
