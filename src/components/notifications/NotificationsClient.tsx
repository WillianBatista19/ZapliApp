'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import NotificationItem from '@/components/notifications/NotificationItem'
import type { NotificationRow } from '@/types'

type Props = {
  initialNotifications: NotificationRow[]
  userId:               string
}

export default function NotificationsClient({ initialNotifications, userId }: Props) {
  const [notifications, setNotifications] = useState(initialNotifications)
  const [marking,       setMarking]       = useState(false)

  const supabase  = useMemo(() => createClient(), [])
  const hasUnread = notifications.some(n => !n.read)

  async function markAllRead() {
    if (!hasUnread || marking) return
    setMarking(true)

    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false)

    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    window.dispatchEvent(new Event('notifications:read'))
    setMarking(false)
  }

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-100">Notificações</h1>

        {hasUnread ? (
          <button
            type="button"
            onClick={markAllRead}
            disabled={marking}
            className="text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-100 disabled:opacity-50"
          >
            {marking ? 'Marcando…' : 'Marcar todas como lidas'}
          </button>
        ) : notifications.length > 0 ? (
          <span className="text-xs text-zinc-600">Tudo lido ✓</span>
        ) : null}
      </div>

      {/* Empty state */}
      {notifications.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 px-6 py-16 text-center">
          <p className="mb-2 text-3xl">🔔</p>
          <p className="text-sm text-zinc-400">
            Nada por aqui. Que tal postar algo e agitar as incelicas?
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <NotificationItem key={n.id} notification={n} />
          ))}
        </div>
      )}
    </>
  )
}
