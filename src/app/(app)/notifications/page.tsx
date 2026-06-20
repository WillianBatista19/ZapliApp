import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import NotificationsClient from '@/components/notifications/NotificationsClient'
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

  const { data } = await supabase
    .from('notifications')
    .select(NOTIF_SELECT)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  const notifications = (data as unknown as NotificationRow[] | null) ?? []

  return (
    <div className="mx-auto max-w-2xl px-4 pb-12">
      <NotificationsClient initialNotifications={notifications} userId={user.id} />
    </div>
  )
}
