// Singleton embedding pipeline — shared across API routes in the same Node.js process

/* eslint-disable @typescript-eslint/no-explicit-any */
let pipelineCache: any = null
let pipelinePromise: Promise<any> | null = null

export async function getEmbeddingPipeline(): Promise<any> {
  if (pipelineCache) { console.log('[transformers] returning cached pipeline'); return pipelineCache }
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      try {
        console.log('[transformers] importing @xenova/transformers...')
        const { pipeline } = await import('@xenova/transformers')
        console.log('[transformers] import ok — loading model...')
        const p = await pipeline(
          'feature-extraction',
          'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
        )
        console.log('[transformers] model loaded ok')
        pipelineCache = p
        pipelinePromise = null
        return p
      } catch (err) {
        pipelinePromise = null  // allow retry
        console.error('[transformers] FAILED to load pipeline:', err)
        throw err
      }
    })()
  }
  return pipelinePromise
}

export function cosineSimilarity(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na  += a[i] * a[i]
    nb  += b[i] * b[i]
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

export function parseEmbedding(raw: unknown): number[] {
  if (Array.isArray(raw)) return raw as number[]
  if (typeof raw === 'string') return JSON.parse(raw) as number[]
  throw new Error('Invalid embedding format')
}
