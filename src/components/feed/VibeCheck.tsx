'use client'

import { useVibeCheck } from '@/hooks/useVibeCheck'
import type { Vibe, VibeType } from '@/types'

// ─── vibe config ──────────────────────────────────────────────────────────────

type VibeDef = {
  type:        VibeType
  emoji:       string
  label:       string
  activeTitle: string   // shown as tooltip when the user already has this vibe
  addTitle:    string   // shown when the user hasn't vibed
}

const VIBES: VibeDef[] = [
  {
    type:        'serving',
    emoji:       '🔥',
    label:       'Serving',
    activeTitle: 'Você achou uma brasa — clique para remover',
    addTitle:    'Esse post é uma brasa',
  },
  {
    type:        'morrei',
    emoji:       '💀',
    label:       'Morri',
    activeTitle: 'Você morreu — clique para remover',
    addTitle:    'Morri nesse post',
  },
  {
    type:        'iconic',
    emoji:       '👑',
    label:       'Iconic',
    activeTitle: 'Você coroou — clique para remover',
    addTitle:    'Esse post é iconic',
  },
  {
    type:        'cha',
    emoji:       '☕',
    label:       'Chá',
    activeTitle: 'Você derramou o chá — clique para remover',
    addTitle:    'Derramar o chá',
  },
  {
    type:        'hype',
    emoji:       '🌊',
    label:       'No Hype',
    activeTitle: 'Você entrou na onda — clique para remover',
    addTitle:    'Entrar na onda',
  },
]

// ─── component ────────────────────────────────────────────────────────────────

type Props = {
  postId:         string
  initialVibes:   Vibe[]
  currentUserId:  string | null
  onShowVibes?:   () => void
}

export default function VibeCheck({ postId, initialVibes, currentUserId, onShowVibes }: Props) {
  const { counts, myVibe, pending, react, total } = useVibeCheck(
    postId,
    initialVibes,
    currentUserId,
  )

  const loggedIn = Boolean(currentUserId)

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {VIBES.map(({ type, emoji, label, activeTitle, addTitle }) => {
        const active = myVibe?.type === type
        const count  = counts[type]

        return (
          <VibeButton
            key={type}
            emoji={emoji}
            label={label}
            count={count}
            active={active}
            disabled={pending || !loggedIn}
            title={
              !loggedIn
                ? 'Entre para reagir'
                : active
                  ? activeTitle
                  : addTitle
            }
            onClick={() => react(type)}
          />
        )
      })}

      {total > 0 && (
        <button
          type="button"
          onClick={onShowVibes}
          className="ml-auto text-xs tabular-nums text-zinc-600 transition-colors hover:text-zinc-300 disabled:pointer-events-none"
          disabled={!onShowVibes}
          title="Ver quem reagiu"
        >
          {total} {total === 1 ? 'vibe' : 'vibes'}
        </button>
      )}
    </div>
  )
}

// ─── VibeButton ───────────────────────────────────────────────────────────────

type ButtonProps = {
  emoji:    string
  label:    string
  count:    number
  active:   boolean
  disabled: boolean
  title:    string
  onClick:  () => void
}

function VibeButton({ emoji, label, count, active, disabled, title, onClick }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active}
      className={`
        group relative flex items-center gap-1.5 rounded-xl border px-3 py-1.5
        text-xs font-medium transition-all duration-150
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink focus-visible:ring-offset-1 focus-visible:ring-offset-zinc-900
        disabled:cursor-default
        ${active
          ? [
              'border-pink bg-pink/15 text-pink',
              'shadow-[0_0_12px_-2px] shadow-pink/30',
              'hover:bg-pink/20',
              'active:scale-95',
            ].join(' ')
          : [
              'border-zinc-700/60 bg-zinc-800/50 text-zinc-400',
              'hover:border-pink/50 hover:bg-pink/10 hover:text-zinc-200',
              'active:scale-95',
            ].join(' ')
        }
      `}
    >
      {/* Emoji */}
      <span
        className={`
          text-base leading-none transition-transform duration-200
          ${active ? 'scale-110' : 'group-hover:scale-110'}
        `}
      >
        {emoji}
      </span>

      {/* Label */}
      <span className={active ? 'text-pink' : 'text-zinc-400 group-hover:text-zinc-200'}>
        {label}
      </span>

      {/* Count badge */}
      {count > 0 && (
        <span
          className={`
            min-w-[1.1rem] rounded-full px-1 py-px text-center text-[10px] font-semibold tabular-nums leading-tight
            ${active
              ? 'bg-pink/25 text-pink'
              : 'bg-zinc-700/60 text-zinc-500 group-hover:bg-pink/15 group-hover:text-pink/70'
            }
          `}
        >
          {count > 999 ? '999+' : count}
        </span>
      )}
    </button>
  )
}
