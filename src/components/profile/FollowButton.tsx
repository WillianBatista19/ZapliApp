'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Props = {
  targetUserId:    string
  currentUserId:   string
  onFollowChange?: (isNowFollowing: boolean) => void
}

export default function FollowButton({ targetUserId, currentUserId, onFollowChange }: Props) {
  const supabase = useMemo(() => createClient(), [])
  // null = still loading; boolean = settled
  const [isFollowing,    setIsFollowing]    = useState<boolean | null>(null)
  const [targetFollowsMe, setTargetFollowsMe] = useState(false)
  const [isPending,      setIsPending]      = useState(false)

  useEffect(() => {
    Promise.all([
      // Does the current user follow the target?
      supabase
        .from('follows')
        .select('follower_id')
        .eq('follower_id', currentUserId)
        .eq('following_id', targetUserId)
        .maybeSingle(),
      // Does the target follow the current user back?
      supabase
        .from('follows')
        .select('follower_id')
        .eq('follower_id', targetUserId)
        .eq('following_id', currentUserId)
        .maybeSingle(),
    ]).then(([{ data: iFollow }, { data: theyFollow }]) => {
      setIsFollowing(!!iFollow)
      setTargetFollowsMe(!!theyFollow)
    })
  }, [currentUserId, targetUserId])

  async function toggle() {
    if (isPending || isFollowing === null) return

    const currentlyFollowing = isFollowing   // snapshot at click time
    setIsFollowing(!currentlyFollowing)      // optimistic flip
    setIsPending(true)

    if (!currentlyFollowing) {
      // Not following → INSERT to follow
      await supabase
        .from('follows')
        .upsert(
          { follower_id: currentUserId, following_id: targetUserId },
          { onConflict: 'follower_id,following_id' },
        )
    } else {
      // Already following → DELETE to unfollow
      await supabase
        .from('follows')
        .delete()
        .eq('follower_id', currentUserId)
        .eq('following_id', targetUserId)
    }

    // Confirm actual DB state
    const { data } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('follower_id', currentUserId)
      .eq('following_id', targetUserId)
      .maybeSingle()

    const confirmed = !!data
    setIsFollowing(confirmed)
    onFollowChange?.(confirmed)
    setIsPending(false)
  }

  if (isFollowing === null) {
    return (
      <button disabled className="rounded-xl px-5 py-2 text-sm font-semibold bg-pink text-white opacity-40">
        Seguir
      </button>
    )
  }

  const label = isFollowing
    ? 'Seguindo'
    : targetFollowsMe
      ? 'Seguir de volta'
      : 'Seguir'

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
      {label}
    </button>
  )
}
