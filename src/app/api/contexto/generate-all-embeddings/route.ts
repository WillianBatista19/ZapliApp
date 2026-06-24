import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime     = 'nodejs'
export const dynamic     = 'force-dynamic'
export const maxDuration = 60

const ADMIN_USERNAME = 'incelicasappoficial'

/* eslint-disable @typescript-eslint/no-explicit-any */
let _pipe: any = null
async function getPipeline() {
  if (_pipe) return _pipe
  const { pipeline } = await import('@xenova/transformers')
  _pipe = await pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2', { quantized: true })
  return _pipe
}

export async function POST() {
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

    const { data: pending, error: fetchErr } = await supabase
      .from('contexto_words')
      .select('id, word')
      .is('embedding', null)
      .order('play_date', { ascending: true })

    if (fetchErr) {
      console.error('[generate-all] fetch error:', fetchErr.message)
      return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    }

    const total = pending?.length ?? 0
    console.log(`[generate-all] ${total} words pending`)

    if (total === 0) {
      return NextResponse.json({ total: 0, processed: 0, errors: 0 })
    }

    const pipe = await getPipeline()
    console.log('[generate-all] pipeline ready')

    let processed = 0
    let errors    = 0

    for (const row of pending!) {
      try {
        const output    = await pipe(row.word, { pooling: 'mean', normalize: true })
        const embedding = Array.from(output.data) as number[]
        console.log(`[generate-all] "${row.word}" — embedding length: ${embedding.length}`)

        const { error: updateErr, data: updateData, count } = await supabase
          .from('contexto_words')
          .update({ embedding })
          .eq('id', row.id)
          .select('id')   // forces PostgREST to return affected rows

        console.log(`[generate-all] "${row.word}" — update error: ${updateErr?.message ?? 'none'}, rows returned: ${updateData?.length ?? 0}, count: ${count ?? 'null'}`)

        if (updateErr) {
          errors++
        } else if (!updateData || updateData.length === 0) {
          console.warn(`[generate-all] "${row.word}" — update matched 0 rows (RLS block or wrong id)`)
          errors++
        } else {
          processed++
        }
      } catch (err) {
        console.error(`[generate-all] inference error for "${row.word}":`, err)
        errors++
      }
    }

    console.log(`[generate-all] done — processed: ${processed}, errors: ${errors}`)
    return NextResponse.json({ total, processed, errors })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[generate-all] UNCAUGHT ERROR:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
