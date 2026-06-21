import { createClient } from '@/lib/supabase/server'
import type { ConversationMessage, ConversationSummary } from '@/types'

export async function fetchConversationList(userId: string): Promise<ConversationSummary[]> {
  const supabase = await createClient()

  console.log('[fetchConversationList] start — userId:', userId)

  // Step 1: get my conversation IDs (own rows, always works with any RLS)
  const { data: myParts, error: myPartsErr } = await supabase
    .from('conversation_participants')
    .select('conversation_id, last_read_at')
    .eq('user_id', userId)

  console.log('[fetchConversationList] myParts:', JSON.stringify(myParts))
  if (myPartsErr) console.error('[fetchConversationList] myParts error:', myPartsErr.message, myPartsErr.code)

  const convIds = (myParts ?? []).map(p => p.conversation_id)
  console.log('[fetchConversationList] convIds:', convIds)
  if (!convIds.length) return []

  // Step 2: fetch conversations with all participants + profiles
  // Requires conversations RLS: USING (id IN (SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid()))
  const { data: convRows, error: convErr } = await supabase
    .from('conversations')
    .select(`
      id,
      conversation_participants (
        user_id,
        last_read_at,
        profiles ( id, username, display_name, avatar_url )
      )
    `)
    .in('id', convIds)

  console.log('[fetchConversationList] convRows:', JSON.stringify(convRows, null, 2))
  if (convErr) console.error('[fetchConversationList] convRows error:', convErr.message, convErr.code)

  if (!convRows?.length) return []

  // Step 3: last message per conversation
  const { data: msgs, error: msgsErr } = await supabase
    .from('messages')
    .select('id, conversation_id, sender_id, content, created_at')
    .in('conversation_id', convIds)
    .order('created_at', { ascending: false })

  console.log('[fetchConversationList] msgs count:', msgs?.length ?? 0, '| error:', msgsErr?.message)

  const lastMsgByConv: Record<string, ConversationMessage> = {}
  for (const msg of msgs ?? []) {
    if (!lastMsgByConv[msg.conversation_id]) {
      lastMsgByConv[msg.conversation_id] = msg as ConversationMessage
    }
  }

  type RawParticipant = {
    user_id:      string
    last_read_at: string | null
    profiles: {
      id: string; username: string; display_name: string | null; avatar_url: string | null
    } | {
      id: string; username: string; display_name: string | null; avatar_url: string | null
    }[] | null
  }

  const result = convRows.flatMap(conv => {
    const parts     = (conv.conversation_participants ?? []) as unknown as RawParticipant[]
    const myPart    = parts.find(p => p.user_id === userId)
    const otherPart = parts.find(p => p.user_id !== userId)
    const rawProf   = otherPart?.profiles
    const prof      = Array.isArray(rawProf) ? rawProf[0] : rawProf

    console.log(
      `[fetchConversationList] conv ${conv.id} — participants: [${parts.map(p => p.user_id).join(', ')}]`,
      '| otherPart:', !!otherPart, '| prof:', !!prof,
    )

    if (!myPart || !prof) return []
    return [{
      id:         conv.id,
      lastReadAt: myPart.last_read_at ?? null,
      otherUser: {
        id:           prof.id,
        username:     prof.username,
        display_name: prof.display_name,
        avatar_url:   prof.avatar_url,
      },
      lastMessage: lastMsgByConv[conv.id] ?? null,
    } satisfies ConversationSummary]
  }).sort((a, b) => {
    const at = a.lastMessage?.created_at ?? ''
    const bt = b.lastMessage?.created_at ?? ''
    return bt.localeCompare(at)
  })

  console.log('[fetchConversationList] returning', result.length, 'conversations')
  return result
}
