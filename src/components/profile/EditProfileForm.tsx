'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/components/Avatar'
import ConfirmModal from '@/components/ui/ConfirmModal'
import MediaSearchModal, { BookIcon, MovieIcon } from '@/components/ui/MediaSearchModal'
import AniListSearchModal, { TvIcon } from '@/components/ui/AniListSearchModal'
import type { MediaResult } from '@/components/ui/MediaSearchModal'
import type { AniListResult } from '@/components/ui/AniListSearchModal'
import type { Profile, WatchingNow, ReadingNow } from '@/types'

function parseJsonField<T>(raw: unknown): T | null {
  if (!raw) return null
  if (typeof raw === 'string') { try { return JSON.parse(raw) as T } catch { return null } }
  return raw as T
}

type GoodreadsData = {
  cover_url: string | null
  title:     string | null
  author:    string | null
  rating:    number | null
}

function parseGoodreadsWidget(html: string): GoodreadsData {
  const empty: GoodreadsData = { cover_url: null, title: null, author: null, rating: null }
  if (typeof window === 'undefined' || !html.trim()) return empty

  const doc = new DOMParser().parseFromString(html, 'text/html')

  // Split book links into ones wrapping an image (cover) vs. text-only (title)
  const bookLinks = Array.from(doc.querySelectorAll('a[href*="/book/show/"]'))
  const coverLink = bookLinks.find(a => a.querySelector('img') !== null)
  const titleLink = bookLinks.find(a => !a.querySelector('img') && a.textContent?.trim())

  const cover_url = coverLink?.querySelector('img')?.getAttribute('src') ?? null
  const title     = titleLink?.textContent?.trim() ?? null

  const authorLink = doc.querySelector('a[href*="/author/show/"]')
  const author     = authorLink?.textContent?.trim() ?? null

  const bodyText   = doc.body.textContent ?? ''
  const ratingMatch = bodyText.match(/[Mm]y\s+rating[:\s]+(\d)\s+of\s+5/)
  const ratingNum  = ratingMatch ? parseInt(ratingMatch[1], 10) : null
  const rating     = ratingNum !== null ? Math.min(5, Math.max(1, ratingNum)) : null

  return { cover_url, title, author, rating }
}

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
  const [watchingNow,        setWatchingNow]        = useState<WatchingNow | null>(parseJsonField<WatchingNow>(profile.watching_now))
  const [readingNow,         setReadingNow]         = useState<ReadingNow  | null>(parseJsonField<ReadingNow>(profile.reading_now))
  const [showWatchingSearch, setShowWatchingSearch] = useState(false)
  const [showReadingSearch,  setShowReadingSearch]  = useState(false)
  const [animeTitle,         setAnimeTitle]         = useState<string | null>(profile.anime_title ?? null)
  const [animeCoverUrl,      setAnimeCoverUrl]      = useState<string | null>(profile.anime_cover_url ?? null)
  const [showAnimeSearch,    setShowAnimeSearch]    = useState(false)
  const [steamId,            setSteamId]            = useState(profile.steam_id ?? '')
  const [goodreadsHtml,   setGoodreadsHtml]   = useState('')
  const [goodreadsTitle,  setGoodreadsTitle]  = useState<string | null>(profile.goodreads_book_title  ?? null)
  const [goodreadsAuthor, setGoodreadsAuthor] = useState<string | null>(profile.goodreads_book_author ?? null)
  const [goodreadsCover,  setGoodreadsCover]  = useState<string | null>(profile.goodreads_cover_url   ?? null)
  const [goodreadsRating, setGoodreadsRating] = useState<number | null>(profile.goodreads_rating      ?? null)
  const [favoriteFilm,    setFavoriteFilm]    = useState<WatchingNow | null>(parseJsonField<WatchingNow>(profile.favorite_film))
  const [favoriteBook,    setFavoriteBook]    = useState<ReadingNow  | null>(parseJsonField<ReadingNow>(profile.favorite_book))
  const [showFavoriteFilmSearch, setShowFavoriteFilmSearch] = useState(false)
  const [showFavoriteBookSearch, setShowFavoriteBookSearch] = useState(false)

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

  function handleAnimeSelect(r: AniListResult) {
    setAnimeTitle(r.title)
    setAnimeCoverUrl(r.coverUrl)
    setShowAnimeSearch(false)
  }

  function handleFavoriteFilmSelect(r: MediaResult) {
    setFavoriteFilm({ id: Number(r.id), title: r.title, year: r.subtitle, poster_url: r.imageUrl })
    setShowFavoriteFilmSearch(false)
  }

  function handleFavoriteBookSelect(r: MediaResult) {
    setFavoriteBook({ id: r.id, title: r.title, author: r.subtitle, cover_url: r.imageUrl })
    setShowFavoriteBookSearch(false)
  }

  function handleGoodreadsHtmlChange(html: string) {
    setGoodreadsHtml(html)
    if (!html.trim()) return
    const parsed = parseGoodreadsWidget(html)
    if (parsed.title) {
      setGoodreadsTitle(parsed.title)
      setGoodreadsAuthor(parsed.author)
      setGoodreadsCover(parsed.cover_url)
      setGoodreadsRating(parsed.rating)
    }
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
        anime_title:     animeTitle     || null,
        anime_cover_url: animeCoverUrl  || null,
        steam_id:        steamId.trim() || null,
        goodreads_book_title:  goodreadsTitle  || null,
        goodreads_book_author: goodreadsAuthor || null,
        goodreads_cover_url:   goodreadsCover  || null,
        goodreads_rating:      goodreadsRating ?? null,
        favorite_film:         favoriteFilm,
        favorite_book:         favoriteBook,
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

          <FormField label="Steam ID">
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
                🎮
              </span>
              <input
                value={steamId}
                onChange={(e) => setSteamId(e.target.value.replace(/\D/g, ''))}
                maxLength={17}
                placeholder="76561198000000000"
                className="input-base pl-9"
                inputMode="numeric"
              />
            </div>
            <p className="mt-1 text-xs text-zinc-600">
              Seu Steam ID numérico de 64 bits. Encontre em:{' '}
              <span className="text-zinc-500">steamcommunity.com/id/SEU_USUARIO</span>
              {' '}→ copie o número na URL.
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

          <FormField label="Filme favorito ⭐">
            {favoriteFilm ? (
              <div className="flex items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-800/50 p-3">
                {favoriteFilm.poster_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={favoriteFilm.poster_url}
                    alt=""
                    className="h-14 w-10 flex-shrink-0 rounded-lg object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-100">{favoriteFilm.title}</p>
                  {favoriteFilm.year && <p className="text-xs text-zinc-500">{favoriteFilm.year}</p>}
                </div>
                <div className="flex flex-shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setShowFavoriteFilmSearch(true)}
                    className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-400"
                  >
                    Trocar
                  </button>
                  <button
                    type="button"
                    onClick={() => setFavoriteFilm(null)}
                    className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-red-400 transition-colors hover:border-red-800/60"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowFavoriteFilmSearch(true)}
                className="flex w-full items-center gap-2 rounded-xl border border-dashed border-zinc-700 px-4 py-3 text-sm text-zinc-500 transition-colors hover:border-zinc-500 hover:text-zinc-300"
              >
                <MovieIcon className="h-4 w-4" />
                Buscar filme favorito
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

          <FormField label="Livro favorito ⭐">
            {favoriteBook ? (
              <div className="flex items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-800/50 p-3">
                {favoriteBook.cover_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={favoriteBook.cover_url}
                    alt=""
                    className="h-14 w-10 flex-shrink-0 rounded-lg object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-100">{favoriteBook.title}</p>
                  {favoriteBook.author && <p className="text-xs text-zinc-500">{favoriteBook.author}</p>}
                </div>
                <div className="flex flex-shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setShowFavoriteBookSearch(true)}
                    className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-400"
                  >
                    Trocar
                  </button>
                  <button
                    type="button"
                    onClick={() => setFavoriteBook(null)}
                    className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-red-400 transition-colors hover:border-red-800/60"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowFavoriteBookSearch(true)}
                className="flex w-full items-center gap-2 rounded-xl border border-dashed border-zinc-700 px-4 py-3 text-sm text-zinc-500 transition-colors hover:border-zinc-500 hover:text-zinc-300"
              >
                <BookIcon className="h-4 w-4" />
                Buscar livro favorito
              </button>
            )}
          </FormField>

          <FormField label="Goodreads">
            {/* Preview of current saved data */}
            {goodreadsTitle && (
              <div className="mb-3 flex items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-800/50 p-3">
                {goodreadsCover && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={goodreadsCover} alt="" className="h-14 w-10 flex-shrink-0 rounded-lg object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-100">{goodreadsTitle}</p>
                  {goodreadsAuthor && <p className="text-xs text-zinc-500">{goodreadsAuthor}</p>}
                  {goodreadsRating !== null && (
                    <div className="mt-0.5 flex gap-0.5">
                      {Array.from({ length: 5 }, (_, i) => (
                        <span key={i} className={`text-xs ${i < goodreadsRating ? 'text-[#D4537E]' : 'text-zinc-700'}`}>★</span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => { setGoodreadsTitle(null); setGoodreadsAuthor(null); setGoodreadsCover(null); setGoodreadsRating(null); setGoodreadsHtml('') }}
                  className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-red-400 transition-colors hover:border-red-800/60"
                >
                  Remover
                </button>
              </div>
            )}
            <textarea
              value={goodreadsHtml}
              onChange={e => handleGoodreadsHtmlChange(e.target.value)}
              rows={4}
              placeholder={'Cole o código do widget do Goodreads aqui...'}
              className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-xs text-zinc-400 placeholder-zinc-600 outline-none focus:border-[#1D9E75]"
            />
            <p className="mt-1 text-xs text-zinc-600">
              Acesse goodreads.com → seu perfil → widget de livros → copie o código HTML e cole aqui.
            </p>
            {goodreadsHtml.trim() !== '' && !goodreadsTitle && (
              <p className="mt-1 text-xs text-amber-500">
                Não foi possível extrair informações do widget. Verifique se o código está correto.
              </p>
            )}
            {goodreadsHtml.trim() !== '' && goodreadsTitle && (
              <p className="mt-1 text-xs text-[#1D9E75]">
                ✓ Livro extraído: &quot;{goodreadsTitle}&quot;
              </p>
            )}
          </FormField>

          <FormField label="Anime favorito">
            {animeTitle ? (
              <div className="flex items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-800/50 p-3">
                {animeCoverUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={animeCoverUrl}
                    alt=""
                    className="h-14 w-10 flex-shrink-0 rounded-lg object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-100">{animeTitle}</p>
                </div>
                <div className="flex flex-shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAnimeSearch(true)}
                    className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-400"
                  >
                    Trocar
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAnimeTitle(null); setAnimeCoverUrl(null) }}
                    className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-red-400 transition-colors hover:border-red-800/60"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAnimeSearch(true)}
                className="flex w-full items-center gap-2 rounded-xl border border-dashed border-zinc-700 px-4 py-3 text-sm text-zinc-500 transition-colors hover:border-zinc-500 hover:text-zinc-300"
              >
                <TvIcon className="h-4 w-4" />
                Buscar anime ou manga
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

      {showAnimeSearch && (
        <AniListSearchModal
          onSelect={handleAnimeSelect}
          onClose={() => setShowAnimeSearch(false)}
        />
      )}

      {showFavoriteFilmSearch && (
        <MediaSearchModal
          type="movie"
          onSelect={handleFavoriteFilmSelect}
          onClose={() => setShowFavoriteFilmSearch(false)}
        />
      )}

      {showFavoriteBookSearch && (
        <MediaSearchModal
          type="book"
          onSelect={handleFavoriteBookSelect}
          onClose={() => setShowFavoriteBookSearch(false)}
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
