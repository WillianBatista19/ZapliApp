import Link from 'next/link'

// ← Change this value to update the status badge site-wide
const CURRENT_STATUS = 'operational' as const
type Status = 'operational' | 'maintenance' | 'degraded'

const STATUS_CONFIG: Record<Status, {
  label:  string
  bg:     string
  border: string
  text:   string
  dot:    string
}> = {
  operational: {
    label:  'Tudo funcionando',
    bg:     'bg-emerald-950/50',
    border: 'border-emerald-800/40',
    text:   'text-emerald-400',
    dot:    'bg-emerald-400',
  },
  maintenance: {
    label:  'Manutenção em andamento',
    bg:     'bg-yellow-950/50',
    border: 'border-yellow-800/40',
    text:   'text-yellow-400',
    dot:    'bg-yellow-400',
  },
  degraded: {
    label:  'Instabilidade detectada',
    bg:     'bg-red-950/50',
    border: 'border-red-800/40',
    text:   'text-red-400',
    dot:    'bg-red-400',
  },
}

const KNOWN_BUGS = [
  'Upload de vídeo pode falhar em conexões lentas — se o post não aparecer, tente de novo.',
  'Câmera frontal no iOS pode abrir invertida ao usar "Tirar foto" no compositor.',
  'O player do Spotify pode não carregar com bloqueadores de anúncios ativos.',
  'Notificações em tempo real podem levar alguns segundos para aparecer após a ação.',
]

export default function StatusPage() {
  const s = STATUS_CONFIG[CURRENT_STATUS]

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-10">
      <div className="mx-auto max-w-lg">

        {/* Header */}
        <div className="mb-8 text-center">
          <p className="text-2xl font-black tracking-tight">
            <span className="text-[#D4537E]">Incelicas</span>
          </p>
          <h1 className="mt-1 text-lg font-semibold text-zinc-300">Status do Sistema</h1>
        </div>

        {/* Status badge */}
        <div className={`mb-6 flex items-center gap-3 rounded-2xl border p-4 ${s.bg} ${s.border}`}>
          <span className={`h-3 w-3 flex-shrink-0 animate-pulse rounded-full ${s.dot}`} />
          <p className={`font-semibold ${s.text}`}>{s.label}</p>
        </div>

        {/* Development notice */}
        <div className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Aviso
          </h2>
          <p className="text-sm leading-relaxed text-zinc-300">
            Este site está em desenvolvimento ativo. Algumas funcionalidades podem apresentar bugs
            ou instabilidade durante atualizações. Agradecemos a paciência! 💀
          </p>
        </div>

        {/* Known bugs */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Bugs conhecidos
          </h2>
          {KNOWN_BUGS.length === 0 ? (
            <p className="text-sm text-zinc-500">Nenhum bug registrado no momento. 🎉</p>
          ) : (
            <ul className="space-y-2.5">
              {KNOWN_BUGS.map((bug, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-zinc-300">
                  <span className="mt-0.5 flex-shrink-0">🐛</span>
                  {bug}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 flex items-center justify-between text-xs text-zinc-600">
          <Link href="/feed" className="transition-colors hover:text-zinc-400">
            ← Voltar ao feed
          </Link>
          <Link href="/changelog" className="transition-colors hover:text-zinc-400">
            Ver novidades →
          </Link>
        </div>

      </div>
    </div>
  )
}
