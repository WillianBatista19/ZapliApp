import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const COMING_SOON = [
  'Mensagens diretas entre usuários',
  'Busca de posts e conteúdo',
  'Notificações push (Web Push API)',
  'Salvar posts para ver depois',
  'PWA — instalar como app no celular',
]

function formatDate(d: string): string {
  const [year, month] = d.split('-').map(Number)
  return `${MONTHS_PT[month - 1]} ${year}`
}

type ChangelogEntry = {
  id:         string
  version:    string
  title:      string
  items:      string[]
  entry_date: string
}

export default async function ChangelogPage() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('changelog_entries')
    .select('*')
    .order('entry_date', { ascending: false })

  if (error) {
    console.error('[changelog] fetch error:', error.message, error.code)
  }

  const entries = (data ?? []) as ChangelogEntry[]
  console.log('[changelog] entries fetched from Supabase:', entries.length, entries)

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-10">
      <div className="mx-auto max-w-lg">

        {/* Header */}
        <div className="mb-8">
          <Link href="/feed" className="text-xs text-zinc-600 transition-colors hover:text-zinc-400">
            ← Voltar ao feed
          </Link>
          <p className="mt-4 text-2xl font-black tracking-tight">
            <span className="text-[#D4537E]">Incelicas</span>
          </p>
          <h1 className="mt-1 text-lg font-semibold text-zinc-300">
            O que tem de novo
          </h1>
        </div>

        {/* Timeline */}
        <div className="relative">
          <div className="absolute left-3 top-2 bottom-0 w-px bg-zinc-800" aria-hidden />

          <div className="space-y-0">
            {entries.length === 0 ? (
              <p className="pl-10 text-sm text-zinc-600">Nenhuma entrada ainda.</p>
            ) : entries.map((entry, i) => (
              <div key={entry.id} className="relative pb-6 pl-10">
                {/* Dot */}
                <div className={[
                  'absolute left-0 flex h-7 w-7 items-center justify-center rounded-full border',
                  i === 0
                    ? 'border-[#D4537E] bg-[#D4537E]/20'
                    : 'border-zinc-700 bg-zinc-900',
                ].join(' ')}>
                  <div className={[
                    'h-2 w-2 rounded-full',
                    i === 0 ? 'bg-[#D4537E]' : 'bg-zinc-600',
                  ].join(' ')} />
                </div>

                {/* Card */}
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className={[
                      'rounded-full px-2.5 py-0.5 text-xs font-bold',
                      i === 0
                        ? 'bg-[#D4537E]/20 text-[#D4537E]'
                        : 'bg-zinc-800 text-zinc-400',
                    ].join(' ')}>
                      {entry.version}
                    </span>
                    <span className="text-xs text-zinc-600">{formatDate(entry.entry_date)}</span>
                  </div>
                  <h2 className="mb-2.5 text-sm font-semibold text-zinc-100">{entry.title}</h2>
                  <ul className="space-y-1.5">
                    {entry.items.map((item, j) => (
                      <li key={j} className="flex items-start gap-2 text-xs text-zinc-400">
                        <span className="mt-0.5 flex-shrink-0 text-[#7F77DD]">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Em breve */}
        <div className="mt-2 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 p-5">
          <h2 className="mb-3 text-sm font-semibold text-zinc-400">
            ✨ Em breve
          </h2>
          <ul className="space-y-2">
            {COMING_SOON.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-zinc-500">
                <span className="mt-0.5 flex-shrink-0 text-[#1D9E75]">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="mt-8 flex items-center justify-between text-xs text-zinc-600">
          <Link href="/status" className="transition-colors hover:text-zinc-400">
            ← Status do sistema
          </Link>
          <Link href="/feed" className="transition-colors hover:text-zinc-400">
            Voltar ao feed →
          </Link>
        </div>

      </div>
    </div>
  )
}
