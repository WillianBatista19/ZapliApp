import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const HF_MODEL = 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2'

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

    const supabase = await createClient()
    const { data: wordData, error: dbErr } = await supabase
      .from('contexto_words')
      .select('word')
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

    const secretWord = wordData.word.toLowerCase().trim()

    // Exact match — no API call needed
    if (guess === secretWord) {
      return NextResponse.json({ similarity: 100, isCorrect: true })
    }

    const apiKey = process.env.HUGGING_FACE_API_KEY
    if (!apiKey) {
      console.error('[similarity] HUGGING_FACE_API_KEY not set')
      return NextResponse.json({ error: 'Configuração de API ausente.' }, { status: 500 })
    }

    const hfRes = await fetch(
      `https://api-inference.huggingface.co/models/${HF_MODEL}`,
      {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          inputs: {
            source_sentence: secretWord,
            sentences:       [guess],
          },
        }),
      },
    )

    if (!hfRes.ok) {
      const text = await hfRes.text()
      console.error('[similarity] HF API error:', hfRes.status, text)
      return NextResponse.json({ error: `Erro na API de similaridade: ${hfRes.status}` }, { status: 502 })
    }

    const result = await hfRes.json() as unknown
    const rawScore = Array.isArray(result) ? (result[0] as number) : 0
    const similarity = Math.max(0, Math.min(99, Math.round(rawScore * 100)))

    console.log(`[similarity] "${guess}" vs "${secretWord}" → raw: ${rawScore.toFixed(4)}, score: ${similarity}`)

    return NextResponse.json({ similarity, isCorrect: false })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[similarity] UNCAUGHT ERROR:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
