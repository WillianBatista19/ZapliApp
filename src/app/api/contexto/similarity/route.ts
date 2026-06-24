import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'

export const runtime     = 'nodejs'
export const dynamic     = 'force-dynamic'
export const maxDuration = 30

const GEMINI_EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${process.env.GOOGLE_GEMINI_API_KEY}`

async function getEmbedding(text: string): Promise<number[]> {
  const response = await fetch(GEMINI_EMBED_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model:   'models/gemini-embedding-001',
      content: { parts: [{ text }] },
    }),
  })
  const data = await response.json() as Record<string, unknown>
  console.log('[Gemini Embed] status:', response.status, 'error:', (data as { error?: unknown }).error ?? 'none')
  if (!response.ok) throw new Error(`Gemini embed error ${response.status}: ${JSON.stringify(data)}`)
  return (data.embedding as { values: number[] }).values
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB))
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

    // Fetch today's secret word
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

    // Exact match is always rank 1 regardless of whether rankings are generated
    if (guess === secretWord) {
      return NextResponse.json({ rank: 1, isCorrect: true })
    }

    // Check pre-computed rankings table first (fast path — no Gemini call needed)
    const { data: ranked } = await supabase
      .from('contexto_word_rankings')
      .select('rank')
      .eq('play_date', playDate)
      .eq('word', guess)
      .maybeSingle()

    if (ranked) {
      console.log(`[similarity] "${guess}" found in rankings: rank ${ranked.rank}`)
      // isCorrect is determined solely by exact string match (handled above); never by rank
      return NextResponse.json({ rank: ranked.rank, isCorrect: false })
    }

    // Word not pre-ranked — compute similarity with Gemini and map to approximate rank
    const [secretEmbed, guessEmbed] = await Promise.all([
      getEmbedding(secretWord),
      getEmbedding(guess),
    ])
    const rawSimilarity = cosineSimilarity(secretEmbed, guessEmbed)

    // Exponential curve: spreads ranks naturally across the similarity range.
    // similarity >0.90 → ~1-50 | 0.80-0.90 → ~51-200 | 0.70-0.80 → ~201-500
    // 0.60-0.70 → ~501-1000 | 0.50-0.60 → ~1001-2000 | <0.40 → ~4000-10000
    const approxRank = Math.round(Math.pow(1 - rawSimilarity, 1.5) * 10000) + 1

    console.log(`[similarity] "${guess}" not in rankings → cosine: ${rawSimilarity.toFixed(4)}, approx rank: ${approxRank}`)
    return NextResponse.json({ rank: approxRank, isCorrect: false })

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[similarity] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
