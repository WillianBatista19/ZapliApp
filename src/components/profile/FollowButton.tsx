'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Props = {
  targetUserId:       string
  initialIsFollowing: boolean
  currentUserId:      string
}

export default function FollowButton({
  targetUserId,
  initialIsFollowing,
  currentUserId,
}: Props) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing)
  const [isPending,   setIsPending]   = useState(false)
  const supabase = useMemo(() => createClient(), [])
  const router   = useRouter()

  async function toggle() {
    if (isPending) return
    const next = !isFollowing
    setIsFollowing(next)   // optimistic
    setIsPending(true)

    try {
      if (next) {
        const { error } = await supabase
          .from('follows')
          .upsert(
            { follower_id: currentUserId, following_id: targetUserId },
            { onConflict: 'follower_id,following_id', ignoreDuplicates: true },
          )
        if (error) { setIsFollowing(false); return }
      } else {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', targetUserId)
        if (error) { setIsFollowing(true); return }
      }
      // Re-fetch server-rendered counts (follower / following stats)
      router.refresh()
    } finally {
      setIsPending(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      className={[
        'rounded-xl px-5 py-2 text-sm font-semibold transition-all active:scale-95 disabled:opacity-60',
        isFollowing
          ? 'border border-zinc-600 bg-transparent text-zinc-300 hover:border-red-500 hover:text-red-400'
          : 'bg-pink text-white hover:bg-pink-hover',
      ].join(' ')}
    >
      {isFollowing ? 'Seguindo' : 'Seguir'}
    </button>
  )
}
