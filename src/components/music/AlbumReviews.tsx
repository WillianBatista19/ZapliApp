'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

export interface AlbumReview {
  id: string
  review_text: string
  overall_score: number | null
  created_at: string
  username: string
  display_name: string | null
  avatar_url: string | null
}

const PAGE_SIZE = 10

export default function AlbumReviews({ reviews }: { reviews: AlbumReview[] }) {
  const [showAll, setShowAll] = useState(false)

  const visible = showAll ? reviews : reviews.slice(0, PAGE_SIZE)
  const hasMore = reviews.length > PAGE_SIZE

  if (reviews.length === 0) {
    return (
      <p className="text-sm text-zinc-500 text-center py-4">
        Nenhum review ainda. Seja o primeiro a escrever!
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {visible.map(r => {
        const name = r.display_name ?? r.username
        return (
          <div key={r.id} className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-4 space-y-2">
            <div className="flex items-center gap-3">
              <Link href={`/profile/${r.username}`} className="shrink-0">
                {r.avatar_url ? (
                  <Image src={r.avatar_url} alt={name} width={32} height={32}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#7F77DD]/40 flex items-center justify-center text-sm">
                    {name[0].toUpperCase()}
                  </div>
                )}
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/profile/${r.username}`} className="text-sm font-semibold text-zinc-100 hover:underline">
                  {name}
                </Link>
                <p className="text-xs text-zinc-500">@{r.username}</p>
              </div>
              <div className="shrink-0 text-right">
                {r.overall_score != null && (
                  <p className="text-sm font-bold text-[#D4537E]">⭐ {r.overall_score.toFixed(1)}</p>
                )}
                <p className="text-xs text-zinc-600">
                  {new Date(r.created_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{r.review_text}</p>
          </div>
        )
      })}

      {hasMore && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full rounded-xl bg-white/5 border border-zinc-800 py-2.5 text-sm text-zinc-400 hover:bg-white/10 transition-colors"
        >
          Ver mais ({reviews.length - PAGE_SIZE} restantes)
        </button>
      )}
    </div>
  )
}
