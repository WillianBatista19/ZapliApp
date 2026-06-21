import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MessagesClient from '@/components/messages/MessagesClient'
import { fetchConversationList } from '@/lib/messages'
import type { ConversationMessage } from '@/types'

export const dynamic = 'force-dynamic'

export default async function ConversationPage({
  params,
}: {
  params: { conversationId: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { conversationId } = params

  // Verify current user is actually a participant in this conversation
  const { data: myPart } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!myPart) redirect('/messages')

  const [conversations, messagesResult] = await Promise.all([
    fetchConversationList(user.id),
    supabase
      .from('messages')
      .select('id, conversation_id, sender_id, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true }),
  ])

  // Mark conversation as read
  await supabase
    .from('conversation_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)

  return (
    <MessagesClient
      currentUserId={user.id}
      initialConversations={conversations}
      activeConversationId={conversationId}
      initialMessages={(messagesResult.data ?? []) as ConversationMessage[]}
    />
  )
}
