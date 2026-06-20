import type { WatchingNow, ReadingNow } from '@/types'

type Props = {
  watching:      WatchingNow | null
  reading:       ReadingNow  | null
  animeTitle:    string | null
  animeCoverUrl: string | null
}

export default function MediaNowWidgets({ watching, reading, animeTitle, animeCoverUrl }: Props) {
  if (!watching && !reading && !animeTitle) return null

  return (
    <div className="mb-4 space-y-2">
      {watching && (
        <div className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          {watching.poster_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={watching.poster_url}
              alt={watching.title}
              className="h-16 w-11 flex-shrink-0 rounded-lg object-cover"
            />
          )}
          <div className="min-w-0">
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
          {reading.cover_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={reading.cover_url}
              alt={reading.title}
              className="h-16 w-11 flex-shrink-0 rounded-lg object-cover"
            />
          )}
          <div className="min-w-0">
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
          {animeCoverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={animeCoverUrl}
              alt={animeTitle}
              className="h-16 w-11 flex-shrink-0 rounded-lg object-cover"
            />
          )}
          <div className="min-w-0">
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
