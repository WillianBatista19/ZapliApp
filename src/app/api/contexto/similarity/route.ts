import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEmbeddingPipeline, cosineSimilarity, parseEmbedding } from '@/lib/transformers'

export const runtime     = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    let body: { guess?: unknown; playDate?: unknown }
    try {
      body = await req.json() as { guess?: unknown; playDate?: unknown }
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }

    const guess    = typeof body.guess    === 'string' ? body.guess.trim().toLowerCase() : null
    const playDate = typeof body.playDate === 'string' ? body.playDate.trim()            : null
    if (!guess || !playDate) {
      return NextResponse.json({ error: 'guess e playDate são obrigatórios' }, { status: 400 })
    }

    console.log('[similarity] guess:', guess, 'date:', playDate)

    const supabase = await createClient()
    const { data: wordData, error: dbErr } = await supabase
      .from('contexto_words')
      .select('word, embedding')
      .eq('play_date', playDate)
      .maybeSingle()

    if (dbErr) {
      console.error('[similarity] db error:', dbErr.message)
      return NextResponse.json({ error: dbErr.message }, { status: 500 })
    }

    if (!wordData) {
      return NextResponse.json(
        { error: 'Nenhuma palavra cadastrada para hoje. O admin precisa adicionar uma palavra em /jogar/admin' },
        { status: 404 },
      )
    }

    if (!wordData.embedding) {
      return NextResponse.json(
        { error: 'Embedding não gerado para a palavra de hoje. O admin precisa recriar a palavra.' },
        { status: 422 },
      )
    }

    if (guess === wordData.word.toLowerCase()) {
      return NextResponse.json({ similarity: 100, isCorrect: true })
    }

    console.log('[similarity] loading pipeline...')
    const pipe     = await getEmbeddingPipeline()
    const output   = await pipe(guess, { pooling: 'mean', normalize: true })
    const guessEmb = output.data as Float32Array
    const wordEmb  = parseEmbedding(wordData.embedding)

    const sim   = cosineSimilarity(guessEmb, wordEmb)
    const score = Math.max(0, Math.min(99, Math.round(sim * 100)))
    console.log('[similarity] score:', score)

    return NextResponse.json({ similarity: score, isCorrect: false })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    const stack   = err instanceof Error ? err.stack   : undefined
    console.error('[similarity] UNCAUGHT ERROR:', message)
    console.error(stack)
    return NextResponse.json({ error: message, stack }, { status: 500 })
  }
}
