import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import NotificationItem from '@/components/notifications/NotificationItem'
import type { NotificationRow } from '@/types'

const NOTIF_SELECT = `
  id, type, post_id, comment_id, read, created_at,
  from_profile:from_user_id (display_name, username, avatar_url),
  post:post_id        (content),
  comment:comment_id  (content)
`.trim()

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch notifications with their current `read` state so we can render
  // unread indicators accurately, then immediately mark all as read.
  // The UPDATE fires a Realtime event that resets the bell badge on the client.
  const { data } = await supabase
    .from('notifications')
    .select(NOTIF_SELECT)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  const notifications = (data as unknown as NotificationRow[] | null) ?? []

  // Mark all unread as read in the background — don't block the render
  if (notifications.some((n) => !n.read)) {
    supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false)
      .then(() => {/* fire-and-forget; realtime UPDATE resets the bell badge */})
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-12">

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-100">Notificações</h1>
        {notifications.length > 0 && (
          <span className="text-xs text-zinc-600">
            {notifications.filter((n) => !n.read).length > 0
              ? `${notifications.filter((n) => !n.read).length} não lida${notifications.filter((n) => !n.read).length > 1 ? 's' : ''}`
              : 'Tudo lido ✓'}
          </span>
        )}
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
          {notifications.map((n) => (
            <NotificationItem key={n.id} notification={n} />
          ))}
        </div>
      )}

    </div>
  )
}
