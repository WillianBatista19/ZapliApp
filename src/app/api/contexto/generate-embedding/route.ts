import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ADMIN_USERNAME = 'incelicasappoficial'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single()
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
    if (!word || !playDate) {
      return NextResponse.json({ error: 'word e playDate são obrigatórios' }, { status: 400 })
    }

    const { error } = await supabase
      .from('contexto_words')
      .upsert({ word, play_date: playDate }, { onConflict: 'play_date' })

    if (error) {
      console.error('[generate-embedding] upsert error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`[generate-embedding] saved "${word}" for ${playDate}`)
    return NextResponse.json({ ok: true, word, playDate })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[generate-embedding] UNCAUGHT ERROR:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
