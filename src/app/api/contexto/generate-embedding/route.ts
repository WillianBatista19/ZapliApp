import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
import { PORTUGUESE_WORDS }         from '@/lib/portuguese-words'

export const runtime     = 'nodejs'
export const dynamic     = 'force-dynamic'
export const maxDuration = 60

const GEMINI_KEY       = process.env.GOOGLE_GEMINI_API_KEY!
const GEMINI_SINGLE    = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_KEY}`
const GEMINI_BATCH     = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents?key=${GEMINI_KEY}`
const BATCH_SIZE       = 100
const ADMIN_USERNAME   = 'incelicasappoficial'

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function getEmbedding(text: string): Promise<number[]> {
  const res  = await fetch(GEMINI_SINGLE, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ model: 'models/gemini-embedding-001', content: { parts: [{ text }] } }),
  })
  if (!res.ok) throw new Error(`Gemini single embed ${res.status}: ${await res.text()}`)
  const data = await res.json() as { embedding: { values: number[] } }
  return data.embedding.values
}

async function getBatchEmbeddings(words: string[]): Promise<number[][]> {
  const res = await fetch(GEMINI_BATCH, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      requests: words.map(w => ({
        model:   'models/gemini-embedding-001',
        content: { parts: [{ text: w }] },
      })),
    }),
  })
  if (!res.ok) throw new Error(`Gemini batch embed ${res.status}: ${await res.text()}`)
  const data = await res.json() as { embeddings: { values: number[] }[] }
  return data.embeddings.map(e => e.values)
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  return magA && magB ? dot / (Math.sqrt(magA) * Math.sqrt(magB)) : 0
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    // Auth: must be admin
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

    const word     = typeof body.word     === 'string' ? body.word.trim().toLowerCase()  : null
    const playDate = typeof body.playDate === 'string' ? body.playDate.trim()             : null
    if (!word || !playDate) {
      return NextResponse.json({ error: 'word e playDate são obrigatórios' }, { status: 400 })
    }

    // 1. Save the word
    const { error: wordErr } = await supabase
      .from('contexto_words')
      .upsert({ word, play_date: playDate }, { onConflict: 'play_date' })
    if (wordErr) {
      console.error('[generate-embedding] upsert error:', wordErr.message)
      return NextResponse.json({ error: wordErr.message }, { status: 500 })
    }

    // 2. Build word list — always include the secret word so it ends up at rank 1
    const wordSet  = new Set(PORTUGUESE_WORDS.map(w => w.toLowerCase()))
    wordSet.add(word)
    const allWords = Array.from(wordSet)

    console.log(`[generate-embedding] ranking ${allWords.length} words for "${word}" on ${playDate}`)

    // 3. Embed the secret word (single call, used to compute similarities)
    const secretEmbed = await getEmbedding(word)

    // 4. Embed all words in parallel batches of BATCH_SIZE
    const batches      = chunk(allWords, BATCH_SIZE)
    const batchResults = await Promise.all(batches.map(b => getBatchEmbeddings(b)))
    const embeddings   = batchResults.flat()

    // 5. Compute cosine similarity and sort descending
    const scored = allWords
      .map((w, i) => ({ word: w, similarity: cosineSimilarity(secretEmbed, embeddings[i]) }))
      .sort((a, b) => b.similarity - a.similarity)

    // 6. Assign ranks (1-based) and build rows
    const rows = scored.map((s, idx) => ({
      play_date:  playDate,
      word:       s.word,
      rank:       idx + 1,
      similarity: s.similarity,
    }))

    // 7. Delete stale rankings for this date and insert fresh ones
    await supabase.from('contexto_word_rankings').delete().eq('play_date', playDate)

    const INSERT_CHUNK = 500
    for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
      const { error: insErr } = await supabase
        .from('contexto_word_rankings')
        .insert(rows.slice(i, i + INSERT_CHUNK))
      if (insErr) {
        console.error('[generate-embedding] insert rankings error:', insErr.message)
        return NextResponse.json({ error: insErr.message }, { status: 500 })
      }
    }

    console.log(`[generate-embedding] saved "${word}" + ${rows.length} rankings for ${playDate}`)
    return NextResponse.json({ ok: true, word, playDate, ranked: rows.length })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[generate-embedding] UNCAUGHT ERROR:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
