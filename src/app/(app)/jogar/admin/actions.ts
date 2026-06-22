'use server'

import { createClient } from '@/lib/supabase/server'

export async function submitChangelogEntry(
  version: string,
  title: string,
  items: string[],
  entryDate: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .single()

  if (profile?.username !== 'incelicasappoficial') {
    return { error: 'Apenas a conta oficial pode adicionar entradas no changelog' }
  }

  const { error: dbError } = await supabase.from('changelog_entries').insert({
    version:    version.trim(),
    title:      title.trim(),
    items,
    entry_date: entryDate,
  })

  if (dbError) return { error: dbError.message }

  // Insert post directly as the authenticated incelicasappoficial user.
  // This satisfies the RLS policy (auth.uid() = user_id) without needing
  // the service role key.
  const body = `🆕 ${version.trim()} — ${title.trim()}\n\n${items.map(i => `• ${i}`).join('\n')}\n\n#incelicas #update`
  const { error: postError } = await supabase
    .from('posts')
    .insert({ user_id: user.id, content: body })

  if (postError) {
    console.error('[submitChangelogEntry] post insert failed:', postError.message, postError.code)
    return { error: `Changelog salvo, mas falha ao criar post: ${postError.message}` }
  }

  return {}
}

export async function postOfficialMessage(content: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .single()

  if (profile?.username !== 'incelicasappoficial') {
    return { error: 'Apenas a conta oficial pode criar posts oficiais' }
  }

  // Insert directly as the authenticated user — satisfies RLS without service role key.
  console.log('[postOfficialMessage] inserting post for user', user.id)
  const { data: inserted, error: insertError } = await supabase
    .from('posts')
    .insert({ user_id: user.id, content: content.trim() })
    .select('id')
    .single()

  if (insertError) {
    console.error('[postOfficialMessage] insert failed:', insertError.message, insertError.code)
    return { error: `Erro ao criar post: ${insertError.message}` }
  }

  console.log('[postOfficialMessage] post created, id =', inserted?.id)
  return {}
}

