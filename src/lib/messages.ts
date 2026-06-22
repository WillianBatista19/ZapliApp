import { createClient } from '@/lib/supabase/server'
import type { ConversationMessage, ConversationParticipant, ConversationSummary } from '@/types'

export async function fetchConversationList(userId: string): Promise<ConversationSummary[]> {
  const supabase = await createClient()

  // Step 1: get my conversation IDs
  const { data: myParts, error: myPartsErr } = await supabase
    .from('conversation_participants')
    .select('conversation_id, last_read_at')
    .eq('user_id', userId)

  if (myPartsErr) console.error('[fetchConversationList] myParts error:', myPartsErr.message)

  const convIds = (myParts ?? []).map(p => p.conversation_id)
  if (!convIds.length) return []

  // Step 2: fetch conversations with all participants + profiles + group fields
  const { data: convRows, error: convErr } = await supabase
    .from('conversations')
    .select(`
      id, is_group, group_name, group_avatar_url, group_description, created_by,
      conversation_participants (
        user_id,
        last_read_at,
        profiles ( id, username, display_name, avatar_url )
      )
    `)
    .in('id', convIds)

  if (convErr) console.error('[fetchConversationList] convRows error:', convErr.message)
  if (!convRows?.length) return []

  // Step 3: last message per conversation
  const { data: msgs } = await supabase
    .from('messages')
    .select('id, conversation_id, sender_id, content, created_at')
    .in('conversation_id', convIds)
    .order('created_at', { ascending: false })

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

  type RawConv = {
    id:               string
    is_group:         boolean | null
    group_name:       string | null
    group_avatar_url: string | null
    group_description: string | null
    created_by:       string | null
    conversation_participants: unknown
  }

  const result = (convRows as unknown as RawConv[]).flatMap(conv => {
    const parts  = (conv.conversation_participants ?? []) as unknown as RawParticipant[]
    const myPart = parts.find(p => p.user_id === userId)
    if (!myPart) return []

    const isGroup = conv.is_group ?? false

    const participants: ConversationParticipant[] = parts.flatMap(p => {
      const rawProf = p.profiles
      const prof    = Array.isArray(rawProf) ? rawProf[0] : rawProf
      if (!prof) return []
      return [{ id: prof.id, username: prof.username, display_name: prof.display_name, avatar_url: prof.avatar_url }]
    })

    let otherUser: ConversationParticipant | null = null
    if (!isGroup) {
      const otherPart = parts.find(p => p.user_id !== userId)
      const rawProf   = otherPart?.profiles
      const prof      = Array.isArray(rawProf) ? rawProf[0] : rawProf
      if (!prof) return []
      otherUser = { id: prof.id, username: prof.username, display_name: prof.display_name, avatar_url: prof.avatar_url }
    }

    return [{
      id:               conv.id,
      lastReadAt:       myPart.last_read_at ?? null,
      isGroup,
      groupName:        conv.group_name,
      groupAvatarUrl:   conv.group_avatar_url,
      groupDescription: conv.group_description,
      createdBy:        conv.created_by,
      participants,
      otherUser,
      lastMessage:      lastMsgByConv[conv.id] ?? null,
    } satisfies ConversationSummary]
  }).sort((a, b) => {
    const at = a.lastMessage?.created_at ?? ''
    const bt = b.lastMessage?.created_at ?? ''
    return bt.localeCompare(at)
  })

  return result
}
