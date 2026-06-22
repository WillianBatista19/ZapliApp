import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Internal-only endpoint for programmatic official post creation.
// Protected by INTERNAL_API_SECRET env var.
// Usage: POST /api/internal/post
//   Authorization: Bearer <INTERNAL_API_SECRET>
//   Content-Type: application/json
//   Body: { "content": "..." }
export async function POST(req: NextRequest) {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'INTERNAL_API_SECRET not configured' }, { status: 500 })
  }

  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let content: string
  try {
    const body = await req.json() as { content?: unknown }
    if (typeof body.content !== 'string' || !body.content.trim()) {
      return NextResponse.json({ error: 'content must be a non-empty string' }, { status: 400 })
    }
    content = body.content.trim()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }, { status: 500 })
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', 'incelicasappoficial')
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile @incelicasappoficial not found' }, { status: 500 })
  }

  const { error } = await supabase
    .from('posts')
    .insert({ user_id: profile.id, content })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
