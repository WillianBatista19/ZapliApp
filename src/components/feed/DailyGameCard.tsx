import Link from 'next/link'

export default function DailyGameCard() {
  const today = new Date().toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday:  'long',
    day:      'numeric',
    month:    'long',
  })

  return (
    <Link
      href="/jogar"
      className="block rounded-2xl border border-zinc-800 bg-zinc-900 p-4 transition-colors hover:border-zinc-700"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs capitalize text-zinc-500">{today}</p>
          <p className="mt-0.5 text-sm font-semibold text-zinc-100">🎮 Desafios do dia</p>
        </div>
        <span className="rounded-full bg-[#D4537E]/10 px-3 py-1 text-xs font-bold text-[#D4537E]">
          Jogar →
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-zinc-800 px-3 py-2">
          <p className="text-xs font-medium text-[#7F77DD]">📝 Termo</p>
          <p className="mt-0.5 text-xs text-zinc-500">Palavra de 5 letras</p>
        </div>
        <div className="rounded-xl bg-zinc-800 px-3 py-2">
          <p className="text-xs font-medium text-[#D4537E]">🎵 Música</p>
          <p className="mt-0.5 text-xs text-zinc-500">Adivinhe pelo trecho</p>
        </div>
      </div>
    </Link>
  )
}
