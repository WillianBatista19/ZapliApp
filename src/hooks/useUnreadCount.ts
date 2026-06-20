import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useUnreadCount(userId: string | null) {
  const [count, setCount] = useState(0)

  const fetchCount = useCallback(async () => {
    if (!userId) return
    const supabase = createClient()
    const { count: c } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false)
    setCount(c ?? 0)
  }, [userId])

  useEffect(() => {
    if (!userId) return
    fetchCount()
    const interval = setInterval(fetchCount, 15000)
    window.addEventListener('notifications:read', fetchCount)
    return () => {
      clearInterval(interval)
      window.removeEventListener('notifications:read', fetchCount)
    }
  }, [userId, fetchCount])

  return count
}
