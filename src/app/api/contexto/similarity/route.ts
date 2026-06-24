import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'

export const runtime     = 'nodejs'
export const dynamic     = 'force-dynamic'
export const maxDuration = 30

const HF_URL = 'https://api-inference.huggingface.co/models/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2'

// Pre-warm the model on cold start so the first real guess doesn't hit a 503
fetch(HF_URL, {
  method:  'POST',
  headers: {
    'Authorization': `Bearer ${process.env.HUGGING_FACE_API_KEY}`,
    'Content-Type':  'application/json',
  },
  body: JSON.stringify({ inputs: { source_sentence: 'test', sentences: ['test'] } }),
}).catch(() => {})

async function fetchHuggingFace(word: string, guess: string): Promise<number> {
  const controller = new AbortController()
  const timeoutId  = setTimeout(() => controller.abort(), 20_000)

  let response: Response
  try {
    response = await fetch(HF_URL, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HUGGING_FACE_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body:   JSON.stringify({ inputs: { source_sentence: word, sentences: [guess] } }),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof Error && err.name === 'AbortError') {
      throw Object.assign(new Error('timeout'), { status: 503 })
    }
    throw err
  }
  clearTimeout(timeoutId)

  const data = await response.json() as unknown
  console.log('[HF] status:', response.status, 'data:', JSON.stringify(data))

  if (response.status === 503) {
    throw Object.assign(new Error('model_loading'), { status: 503 })
  }

  const isLoadingError =
    data !== null &&
    typeof data === 'object' &&
    'error' in data &&
    typeof (data as Record<string, unknown>).error === 'string' &&
    ((data as Record<string, unknown>).error as string).toLowerCase().includes('loading')

  if (isLoadingError) {
    throw Object.assign(new Error('model_loading'), { status: 503 })
  }

  if (Array.isArray(data) && typeof data[0] === 'number') {
    return Math.min(99, Math.round(data[0] * 100))
  }

  throw new Error(`HF API error: ${JSON.stringify(data)}`)
}

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

    if (guess === secretWord) {
      return NextResponse.json({ similarity: 100, isCorrect: true })
    }

    if (!process.env.HUGGING_FACE_API_KEY) {
      console.error('[similarity] HUGGING_FACE_API_KEY not set')
      return NextResponse.json({ error: 'Configuração de API ausente.' }, { status: 500 })
    }

    try {
      const similarity = await fetchHuggingFace(secretWord, guess)
      console.log(`[similarity] "${guess}" vs "${secretWord}" → ${similarity}`)
      return NextResponse.json({ similarity, isCorrect: false })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg === 'model_loading') {
        console.log('[similarity] HF model warming up')
        return NextResponse.json(
          { error: 'Modelo carregando, tente novamente em alguns segundos', retryAfter: 10 },
          { status: 503 },
        )
      }
      if (msg === 'timeout') {
        console.log('[similarity] HF fetch timed out after 20s')
        return NextResponse.json(
          { error: 'Tempo esgotado. Tente novamente.', retryAfter: 5 },
          { status: 503 },
        )
      }
      console.error('[similarity] HF failed:', msg)
      return NextResponse.json({ error: `Erro na API de similaridade: ${msg}` }, { status: 502 })
    }

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[similarity] UNCAUGHT ERROR:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
