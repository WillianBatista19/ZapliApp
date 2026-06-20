'use client'

import type { WatchingNow, ReadingNow } from '@/types'

function toHttps(url: string | null | undefined): string | null {
  if (!url) return null
  return url.replace(/^http:\/\//i, 'https://')
}

type CoverProps = {
  src:   string | null
  alt:   string
  emoji: string
}

function CoverImage({ src, alt, emoji }: CoverProps) {
  const safeSrc = toHttps(src)
  if (safeSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={safeSrc}
        alt={alt}
        className="h-16 w-11 flex-shrink-0 rounded-lg object-cover"
        onError={(e) => {
          const el = e.currentTarget
          el.style.display = 'none'
          const placeholder = el.nextElementSibling as HTMLElement | null
          if (placeholder) placeholder.style.display = 'flex'
        }}
      />
    )
  }
  return null
}

function CoverPlaceholder({ emoji }: { emoji: string }) {
  return (
    <div
      className="hidden h-16 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-xl"
      aria-hidden
    >
      {emoji}
    </div>
  )
}

type Props = {
  watching:      WatchingNow | null
  reading:       ReadingNow  | null
  animeTitle:    string | null
  animeCoverUrl: string | null
}

export default function MediaNowWidgets({ watching, reading, animeTitle, animeCoverUrl }: Props) {
  if (!watching && !reading && !animeTitle) return null

  return (
    <div className="space-y-2">
      {watching && (
        <div className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <CoverImage src={watching.poster_url} alt={watching.title} emoji="🎬" />
          <CoverPlaceholder emoji="🎬" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#D4537E]">
              Assistindo agora 🎬
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-zinc-100">{watching.title}</p>
            {watching.year && <p className="text-xs text-zinc-500">{watching.year}</p>}
          </div>
        </div>
      )}

      {reading && (
        <div className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <CoverImage src={reading.cover_url} alt={reading.title} emoji="📖" />
          <CoverPlaceholder emoji="📖" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#7F77DD]">
              Lendo agora 📖
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-zinc-100">{reading.title}</p>
            {reading.author && <p className="text-xs text-zinc-500">{reading.author}</p>}
          </div>
        </div>
      )}

      {animeTitle && (
        <div className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <CoverImage src={animeCoverUrl} alt={animeTitle} emoji="✨" />
          <CoverPlaceholder emoji="✨" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#1D9E75]">
              Anime favorito ✨
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-zinc-100">{animeTitle}</p>
          </div>
        </div>
      )}
    </div>
  )
}
