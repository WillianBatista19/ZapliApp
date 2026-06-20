'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useUnreadCount(userId: string | null) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!userId) return
    const supabase = createClient()

    const fetchCount = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false)
      setCount(count ?? 0)
    }

    fetchCount()
    const interval = setInterval(fetchCount, 15000)
    return () => clearInterval(interval)
  }, [userId])

  return count
}
