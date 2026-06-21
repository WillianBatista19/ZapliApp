import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MessagesClient from '@/components/messages/MessagesClient'
import { fetchConversationList } from '@/lib/messages'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Mensagens — Incelicas' }

export default async function MessagesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const conversations = await fetchConversationList(user.id)

  return (
    <MessagesClient
      currentUserId={user.id}
      initialConversations={conversations}
      activeConversationId={null}
      initialMessages={[]}
    />
  )
}
