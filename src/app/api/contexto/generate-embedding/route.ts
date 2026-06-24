import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
import { getEmbeddingPipeline }     from '@/lib/transformers'

export const runtime     = 'nodejs'
export const maxDuration = 60

const ADMIN_USERNAME = 'incelicasappoficial'

export async function POST(req: NextRequest) {
  try {
    console.log('[generate-embedding] POST received')

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    console.log('[generate-embedding] user:', user?.id ?? 'none')
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single()
    console.log('[generate-embedding] username:', profile?.username)
    if (profile?.username !== ADMIN_USERNAME) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let body: { word?: unknown; playDate?: unknown }
    try {
      body = await req.json() as { word?: unknown; playDate?: unknown }
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }

    const word     = typeof body.word     === 'string' ? body.word.trim().toLowerCase() : null
    const playDate = typeof body.playDate === 'string' ? body.playDate.trim()           : null
    console.log('[generate-embedding] word:', word, 'playDate:', playDate)
    if (!word || !playDate) {
      return NextResponse.json({ error: 'word e playDate são obrigatórios' }, { status: 400 })
    }

    console.log('[generate-embedding] loading pipeline...')
    const pipe = await getEmbeddingPipeline()
    console.log('[generate-embedding] pipeline ready — running inference...')

    const output   = await pipe(word, { pooling: 'mean', normalize: true })
    const embedding = Array.from(output.data as Float32Array) as number[]
    console.log('[generate-embedding] embedding dims:', embedding.length)

    const { error } = await supabase
      .from('contexto_words')
      .upsert({ word, play_date: playDate, embedding }, { onConflict: 'play_date' })
    console.log('[generate-embedding] upsert error:', error?.message ?? 'none')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    console.log('[generate-embedding] done ok')
    return NextResponse.json({ ok: true, word, playDate })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    const stack   = err instanceof Error ? err.stack   : undefined
    console.error('[generate-embedding] UNCAUGHT ERROR:', message)
    console.error(stack)
    return NextResponse.json({ error: message, stack }, { status: 500 })
  }
}
