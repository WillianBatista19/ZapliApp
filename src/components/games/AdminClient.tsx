'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { postOfficialMessage, submitChangelogEntry } from '@/app/(app)/jogar/admin/actions'

type TrackResult = {
  title:        string
  artist:       string
  preview_url:  string | null
  cover_url:    string | null
  deezer_found: boolean
}

export default function AdminClient() {
  const supabase = useMemo(() => createClient(), [])

  // Song form
  const [spotifyUrl,  setSpotifyUrl]  = useState('')
  const [trackResult, setTrackResult] = useState<TrackResult | null>(null)
  const [songLoading, setSongLoading] = useState(false)
  const [songMsg,     setSongMsg]     = useState('')

  // Word form
  const [wordInput,  setWordInput]  = useState('')
  const [wordMsg,    setWordMsg]    = useState('')
  const [wordSaving, setWordSaving] = useState(false)

  // Contexto word form
  const [ctxWord,   setCtxWord]   = useState('')
  const [ctxDate,   setCtxDate]   = useState(() => {
    const tomorrow = new Date(Date.now() + 86_400_000)
    return tomorrow.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  })
  const [ctxMsg,       setCtxMsg]       = useState('')
  const [ctxSaving,    setCtxSaving]    = useState(false)
  const [ctxCount,     setCtxCount]     = useState<number | null>(null)
  const [ctxPending,   setCtxPending]   = useState<number | null>(null)
  const [ctxAllRunning, setCtxAllRunning] = useState(false)
  const [ctxAllMsg,    setCtxAllMsg]    = useState('')

  // Official post form
  const [officialContent, setOfficialContent] = useState('')
  const [officialMsg,     setOfficialMsg]     = useState('')
  const [officialPosting, setOfficialPosting] = useState(false)

  // Changelog form
  const [clVersion, setClVersion] = useState('')
  const [clTitle,   setClTitle]   = useState('')
  const [clItems,   setClItems]   = useState('')
  const [clDate,    setClDate]    = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }))
  const [clMsg,     setClMsg]     = useState('')
  const [clSaving,  setClSaving]  = useState(false)

  async function fetchTrack() {
    if (!spotifyUrl.trim()) return
    setSongLoading(true)
    setTrackResult(null)
    setSongMsg('')
    try {
      const res  = await fetch(`/api/spotify?url=${encodeURIComponent(spotifyUrl.trim())}`)
      const json = await res.json() as TrackResult & { error?: string }
      if (json.error) {
        setSongMsg(`Erro: ${json.error}`)
        return
      }
      setTrackResult(json)
      if (!json.deezer_found) {
        setSongMsg('⚠️ Preview não encontrado no Deezer. Não é possível salvar sem preview.')
      }
    } finally {
      setSongLoading(false)
    }
  }

  async function saveSong() {
    if (!trackResult?.preview_url) return
    setSongMsg('')
    const { error } = await supabase.from('daily_songs').insert({
      preview_url:   trackResult.preview_url,
      answer_title:  trackResult.title,
      answer_artist: trackResult.artist,
      cover_url:     trackResult.cover_url,
    })
    if (error) setSongMsg(`Erro: ${error.message}`)
    else {
      setSongMsg('✓ Música adicionada ao banco!')
      setTrackResult(null)
      setSpotifyUrl('')
    }
  }

  async function handleOfficialPost() {
    if (!officialContent.trim()) return
    setOfficialPosting(true)
    setOfficialMsg('')
    const result = await postOfficialMessage(officialContent)
    if (result.error) {
      setOfficialMsg(`Erro: ${result.error}`)
    } else {
      setOfficialMsg('✓ Post publicado no feed!')
      setOfficialContent('')
    }
    setOfficialPosting(false)
  }

  async function handleChangelogSubmit() {
    const items = clItems.split('\n').map(s => s.trim()).filter(Boolean)
    if (!clVersion.trim() || !clTitle.trim() || items.length === 0) {
      setClMsg('Preencha a versão, o título e pelo menos um item.')
      return
    }
    setClSaving(true)
    setClMsg('')
    const result = await submitChangelogEntry(clVersion.trim(), clTitle.trim(), items, clDate)
    if (result.error) {
      setClMsg(`Erro: ${result.error}`)
    } else {
      setClMsg('✓ Changelog salvo e post publicado no feed!')
      setClVersion('')
      setClTitle('')
      setClItems('')
    }
    setClSaving(false)
  }

  async function saveWord() {
    const w = wordInput.trim().toUpperCase()
    if (w.length !== 5) { setWordMsg('A palavra precisa ter 5 letras.'); return }
    setWordSaving(true)
    setWordMsg('')
    const { error } = await supabase.from('daily_words').insert({ word: w })
    if (error) setWordMsg(error.code === '23505' ? 'Palavra já existe.' : `Erro: ${error.message}`)
    else { setWordMsg(`✓ "${w}" adicionada!`); setWordInput('') }
    setWordSaving(false)
  }

  useEffect(() => {
    async function loadCtxCount() {
      const [totalRes, pendingRes] = await Promise.all([
        supabase.from('contexto_words').select('*', { count: 'exact', head: true }),
        supabase.from('contexto_words').select('*', { count: 'exact', head: true }).is('embedding', null),
      ])
      setCtxCount(totalRes.count ?? 0)
      setCtxPending(pendingRes.count ?? 0)
    }
    void loadCtxCount()
  }, [supabase])

  async function saveContextoWord() {
    const word = ctxWord.trim().toLowerCase()
    if (!word) { setCtxMsg('Digite uma palavra.'); return }
    setCtxSaving(true)
    setCtxMsg('Gerando embedding — pode demorar até 1 min na primeira vez...')
    try {
      const res  = await fetch('/api/contexto/generate-embedding', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ word, playDate: ctxDate }),
      })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || !json.ok) {
        setCtxMsg(`Erro: ${json.error ?? 'desconhecido'}`)
      } else {
        setCtxMsg(`✓ "${word}" salva para ${ctxDate}!`)
        setCtxWord('')
        setCtxCount(prev => (prev ?? 0) + 1)
      }
    } catch {
      setCtxMsg('Erro de rede.')
    } finally {
      setCtxSaving(false)
    }
  }

  async function generateAllEmbeddings() {
    setCtxAllRunning(true)
    setCtxAllMsg('Processando — pode demorar alguns minutos...')
    try {
      const res  = await fetch('/api/contexto/generate-all-embeddings', { method: 'POST' })
      const json = await res.json() as { total?: number; processed?: number; errors?: number; error?: string }
      if (!res.ok) {
        setCtxAllMsg(`Erro: ${json.error ?? 'desconhecido'}`)
      } else if (json.total === 0) {
        setCtxAllMsg('✓ Nenhuma palavra pendente.')
      } else {
        setCtxAllMsg(
          `✓ ${json.processed}/${json.total} processadas` +
          (json.errors ? ` — ${json.errors} erro(s)` : '') + '.'
        )
        setCtxPending(json.errors ?? 0)
        setCtxCount(prev => prev)   // unchanged total
      }
    } catch {
      setCtxAllMsg('Erro de rede.')
    } finally {
      setCtxAllRunning(false)
    }
  }

  const songMsgColor = songMsg.startsWith('✓')
    ? 'text-[#1D9E75]'
    : songMsg.startsWith('⚠️')
    ? 'text-amber-400'
    : 'text-red-400'

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/jogar" className="text-xs text-zinc-500 hover:text-zinc-300">← Voltar</Link>
        <h1 className="text-xl font-black text-zinc-100">⚙️ Admin — Banco de Jogos</h1>
      </div>

      {/* SONG SECTION */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-1 text-sm font-semibold text-zinc-100">🎵 Adicionar Música</h2>
        <p className="mb-4 text-xs text-zinc-500">
          Cole a URL do Spotify — o título e artista vêm do Spotify, o preview vem do Deezer.
        </p>

        <div className="flex gap-2">
          <input
            type="text"
            value={spotifyUrl}
            onChange={e => setSpotifyUrl(e.target.value)}
            placeholder="https://open.spotify.com/track/..."
            className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-[#D4537E]"
          />
          <button
            onClick={() => void fetchTrack()}
            disabled={songLoading || !spotifyUrl.trim()}
            className="rounded-xl bg-[#D4537E] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#c0456e] disabled:opacity-40"
          >
            {songLoading ? '...' : 'Buscar'}
          </button>
        </div>

        {trackResult && (
          <div className="mt-4 rounded-xl border border-zinc-700 bg-zinc-800 p-3">
            <div className="flex items-center gap-3">
              {trackResult.cover_url && (
                <img
                  src={trackResult.cover_url}
                  alt={trackResult.title}
                  className="h-14 w-14 shrink-0 rounded-lg object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-zinc-100">{trackResult.title}</p>
                <p className="truncate text-sm text-zinc-400">{trackResult.artist}</p>
                <div className="mt-1 flex items-center gap-1.5">
                  {trackResult.deezer_found ? (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-[#1D9E75]" />
                      <p className="truncate text-xs text-zinc-600">{trackResult.preview_url}</p>
                    </>
                  ) : (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      <p className="text-xs text-amber-500">Preview não encontrado no Deezer</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => void saveSong()}
              disabled={!trackResult.deezer_found}
              className="mt-3 w-full rounded-xl bg-[#1D9E75] py-2 text-sm font-semibold text-white transition-colors hover:bg-[#178a63] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {trackResult.deezer_found ? 'Salvar no banco' : 'Sem preview — não é possível salvar'}
            </button>
          </div>
        )}

        {songMsg && (
          <p className={`mt-2 text-xs ${songMsgColor}`}>{songMsg}</p>
        )}
      </div>

      {/* WORD SECTION */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-4 text-sm font-semibold text-zinc-100">📝 Adicionar Palavra</h2>
        <p className="mb-3 text-xs text-zinc-500">Somente palavras de exatamente 5 letras (sem acentos).</p>

        <div className="flex gap-2">
          <input
            type="text"
            value={wordInput}
            onChange={e => setWordInput(e.target.value.toUpperCase().slice(0, 5))}
            onKeyDown={e => { if (e.key === 'Enter') void saveWord() }}
            placeholder="PALAVRA"
            maxLength={5}
            className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm tracking-widest text-zinc-100 placeholder-zinc-600 outline-none focus:border-[#7F77DD]"
          />
          <button
            onClick={() => void saveWord()}
            disabled={wordSaving || wordInput.trim().length !== 5}
            className="rounded-xl bg-[#7F77DD] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#6d65cb] disabled:opacity-40"
          >
            {wordSaving ? '...' : 'Adicionar'}
          </button>
        </div>

        {wordMsg && (
          <p className={`mt-2 text-xs ${wordMsg.startsWith('✓') ? 'text-[#1D9E75]' : 'text-red-400'}`}>
            {wordMsg}
          </p>
        )}
      </div>

      {/* CONTEXTO SECTION */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-1 text-sm font-semibold text-zinc-100">🧠 Palavra do Contexto</h2>
        <p className="mb-4 text-xs text-zinc-500">
          Define a palavra secreta e gera o embedding para o jogo do dia.
          {ctxCount !== null && (
            <span className="ml-1 font-medium text-zinc-400">
              {ctxCount} palavra{ctxCount !== 1 ? 's' : ''} no banco.
            </span>
          )}
        </p>

        <div className="flex gap-2">
          <input
            type="text"
            value={ctxWord}
            onChange={e => setCtxWord(e.target.value.toLowerCase())}
            onKeyDown={e => { if (e.key === 'Enter' && !ctxSaving) void saveContextoWord() }}
            placeholder="palavra secreta..."
            className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-[#1D9E75]"
          />
          <input
            type="date"
            value={ctxDate}
            onChange={e => setCtxDate(e.target.value)}
            className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[#1D9E75]"
          />
          <button
            onClick={() => void saveContextoWord()}
            disabled={ctxSaving || !ctxWord.trim()}
            className="rounded-xl bg-[#1D9E75] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#178a63] disabled:opacity-40"
          >
            {ctxSaving ? '...' : 'Gerar'}
          </button>
        </div>

        {ctxMsg && (
          <p className={`mt-2 text-xs ${ctxMsg.startsWith('✓') ? 'text-[#1D9E75]' : ctxMsg.startsWith('Gerando') ? 'text-zinc-400' : 'text-red-400'}`}>
            {ctxMsg}
          </p>
        )}

        {/* Pending embeddings */}
        {ctxPending !== null && ctxPending > 0 && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
            <div>
              <p className="text-xs font-semibold text-amber-400">
                {ctxPending} palavra{ctxPending !== 1 ? 's' : ''} sem embedding
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                Palavras salvas sem gerar o vetor de similaridade.
              </p>
            </div>
            <button
              onClick={() => void generateAllEmbeddings()}
              disabled={ctxAllRunning}
              className="ml-4 shrink-0 rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-400 disabled:opacity-40"
            >
              {ctxAllRunning ? 'Processando...' : 'Gerar pendentes'}
            </button>
          </div>
        )}
        {ctxPending === 0 && ctxCount !== null && ctxCount > 0 && (
          <p className="mt-3 text-xs text-[#1D9E75]">✓ Todos os embeddings gerados.</p>
        )}

        {ctxAllMsg && (
          <p className={`mt-2 text-xs ${ctxAllMsg.startsWith('✓') ? 'text-[#1D9E75]' : ctxAllMsg.startsWith('Processando') ? 'text-zinc-400' : 'text-red-400'}`}>
            {ctxAllMsg}
          </p>
        )}
      </div>

      {/* OFFICIAL POST SECTION */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-1 text-sm font-semibold text-zinc-100">📣 Criar Post Oficial</h2>
        <p className="mb-4 text-xs text-zinc-500">
          Publica um post no feed como a conta{' '}
          <span className="font-medium text-zinc-300">@incelicasappoficial</span>.
          Use para anunciar updates, bugs corrigidos ou novidades.
        </p>

        <textarea
          value={officialContent}
          onChange={e => setOfficialContent(e.target.value.slice(0, 2000))}
          rows={5}
          placeholder={'🆕 Nova atualização!\n\n• Feature A\n• Feature B\n\n#incelicas #update'}
          className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-[#D4537E]"
        />

        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-zinc-600">{officialContent.length}/2000</span>
          <button
            onClick={() => void handleOfficialPost()}
            disabled={officialPosting || !officialContent.trim()}
            className="rounded-xl bg-[#D4537E] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#c0456e] disabled:opacity-40"
          >
            {officialPosting ? 'Publicando…' : 'Publicar no feed'}
          </button>
        </div>

        {officialMsg && (
          <p className={`mt-2 text-xs ${officialMsg.startsWith('✓') ? 'text-[#1D9E75]' : 'text-red-400'}`}>
            {officialMsg}
          </p>
        )}
      </div>

      {/* CHANGELOG SECTION */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-1 text-sm font-semibold text-zinc-100">📋 Adicionar ao Changelog</h2>
        <p className="mb-4 text-xs text-zinc-500">
          Salva a entrada no changelog e publica um post oficial automaticamente.
        </p>

        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={clVersion}
              onChange={e => setClVersion(e.target.value)}
              placeholder="v0.14"
              className="w-28 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-[#7F77DD]"
            />
            <input
              type="date"
              value={clDate}
              onChange={e => setClDate(e.target.value)}
              className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[#7F77DD]"
            />
          </div>

          <input
            type="text"
            value={clTitle}
            onChange={e => setClTitle(e.target.value)}
            placeholder="Título da versão (ex: Edição e correções)"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-[#7F77DD]"
          />

          <textarea
            value={clItems}
            onChange={e => setClItems(e.target.value)}
            rows={5}
            placeholder={'Um item por linha:\nAdicionado widget do Goodreads\n🐛 Corrigido: cover images não apareciam'}
            className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-[#7F77DD]"
          />
        </div>

        <div className="mt-3 flex justify-end">
          <button
            onClick={() => void handleChangelogSubmit()}
            disabled={clSaving || !clVersion.trim() || !clTitle.trim() || !clItems.trim()}
            className="rounded-xl bg-[#7F77DD] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#6d65cb] disabled:opacity-40"
          >
            {clSaving ? 'Salvando…' : 'Salvar e publicar'}
          </button>
        </div>

        {clMsg && (
          <p className={`mt-2 text-xs ${clMsg.startsWith('✓') ? 'text-[#1D9E75]' : 'text-red-400'}`}>
            {clMsg}
          </p>
        )}
      </div>
    </div>
  )
}
