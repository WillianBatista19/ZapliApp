'use server'

import { randomUUID } from 'crypto'
import { createHash } from 'crypto'
import { createClient } from '@/lib/supabase/server'

// Deterministic UUID from sorted user-ID pair — same two users always get same conversation.
function pairConversationId(uid1: string, uid2: string): string {
  const [a, b] = [uid1, uid2].sort()
  const h = createHash('sha256').update(`${a}:${b}`).digest('hex')
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`
}

export async function getOrCreateConversation(
  otherUserId: string,
): Promise<{ conversationId: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  if (user.id === otherUserId) return { error: 'Você não pode conversar consigo mesmo' }

  const conversationId = pairConversationId(user.id, otherUserId)

  const { error: convErr } = await supabase
    .from('conversations')
    .insert({ id: conversationId })

  if (convErr && convErr.code !== '23505') return { error: convErr.message }

  const { error: partErr } = await supabase
    .from('conversation_participants')
    .insert([
      { conversation_id: conversationId, user_id: user.id },
      { conversation_id: conversationId, user_id: otherUserId },
    ])

  if (partErr && partErr.code !== '23505') return { error: partErr.message }

  return { conversationId }
}

export async function createGroupConversation(
  groupName: string,
  memberIds: string[],
): Promise<{ conversationId: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  if (!groupName.trim()) return { error: 'Nome do grupo é obrigatório' }

  const conversationId = randomUUID()

  // Plain insert — no .select() to avoid SELECT RLS before participants are added
  const { error: convErr } = await supabase
    .from('conversations')
    .insert({ id: conversationId, is_group: true, group_name: groupName.trim(), created_by: user.id })

  if (convErr) return { error: convErr.message }

  // Creator + all selected members
  const allIds = Array.from(new Set([user.id, ...memberIds]))
  const { error: partErr } = await supabase
    .from('conversation_participants')
    .insert(allIds.map(uid => ({ conversation_id: conversationId, user_id: uid })))

  if (partErr) return { error: partErr.message }

  return { conversationId }
}

export async function updateGroupName(
  conversationId: string,
  newName: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { data: conv } = await supabase
    .from('conversations')
    .select('created_by')
    .eq('id', conversationId)
    .single()

  if ((conv as { created_by: string } | null)?.created_by !== user.id)
    return { error: 'Apenas o criador pode alterar o nome' }

  const { error } = await supabase
    .from('conversations')
    .update({ group_name: newName.trim() })
    .eq('id', conversationId)

  return { error: error?.message }
}

export async function updateGroupAvatar(
  conversationId: string,
  avatarUrl: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { data: conv } = await supabase
    .from('conversations')
    .select('created_by')
    .eq('id', conversationId)
    .single()

  if ((conv as { created_by: string } | null)?.created_by !== user.id)
    return { error: 'Apenas o criador pode alterar a foto do grupo' }

  const { error } = await supabase
    .from('conversations')
    .update({ group_avatar_url: avatarUrl })
    .eq('id', conversationId)

  return { error: error?.message }
}

export async function updateGroupDescription(
  conversationId: string,
  description: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { data: conv } = await supabase
    .from('conversations')
    .select('created_by')
    .eq('id', conversationId)
    .single()

  if ((conv as { created_by: string } | null)?.created_by !== user.id)
    return { error: 'Apenas o criador pode alterar a descrição' }

  const { error } = await supabase
    .from('conversations')
    .update({ group_description: description.trim() })
    .eq('id', conversationId)

  return { error: error?.message }
}

export async function addGroupMember(
  conversationId: string,
  memberId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { data: conv } = await supabase
    .from('conversations')
    .select('created_by')
    .eq('id', conversationId)
    .single()

  if ((conv as { created_by: string } | null)?.created_by !== user.id)
    return { error: 'Apenas o criador pode adicionar membros' }

  const { error } = await supabase
    .from('conversation_participants')
    .insert({ conversation_id: conversationId, user_id: memberId })

  return { error: error?.message }
}

export async function removeGroupMember(
  conversationId: string,
  memberId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { data: conv } = await supabase
    .from('conversations')
    .select('created_by')
    .eq('id', conversationId)
    .single()

  if ((conv as { created_by: string } | null)?.created_by !== user.id)
    return { error: 'Apenas o criador pode remover membros' }

  const { error } = await supabase
    .from('conversation_participants')
    .delete()
    .eq('conversation_id', conversationId)
    .eq('user_id', memberId)

  return { error: error?.message }
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('conversation_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
}

export async function createMessageNotification(
  recipientUserId: string,
): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: existing } = await supabase
    .from('notifications')
    .select('id')
    .eq('user_id', recipientUserId)
    .eq('from_user_id', user.id)
    .eq('type', 'message')
    .eq('read', false)
    .maybeSingle()

  if (!existing) {
    await supabase.from('notifications').insert({
      user_id:      recipientUserId,
      from_user_id: user.id,
      type:         'message',
    })
  }
}

export async function createGroupMessageNotifications(
  conversationId: string,
): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: parts } = await supabase
    .from('conversation_participants')
    .select('user_id')
    .eq('conversation_id', conversationId)
    .neq('user_id', user.id)

  if (!parts?.length) return

  for (const { user_id } of parts) {
    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', user_id)
      .eq('from_user_id', user.id)
      .eq('type', 'group_message')
      .eq('read', false)
      .maybeSingle()

    if (!existing) {
      await supabase.from('notifications').insert({
        user_id,
        from_user_id: user.id,
        type:         'group_message',
        read:         false,
      })
    }
  }
}
