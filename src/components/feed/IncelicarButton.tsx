'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import IncelicarCommentModal from '@/components/feed/IncelicarCommentModal'
import type { OriginalPost } from '@/types'

type Props = {
  postId:             string
  postOwnerId:        string
  currentUserId:      string | null
  initialRepostCount: number
  original:           OriginalPost
}

export default function IncelicarButton({
  postId,
  postOwnerId,
  currentUserId,
  initialRepostCount,
  original,
}: Props) {
  const supabase = useMemo(() => createClient(), [])

  const [repostCount, setRepostCount] = useState(initialRepostCount)
  const [hasReposted, setHasReposted] = useState<boolean | null>(null)
  const [myRepostId,  setMyRepostId]  = useState<string | null>(null)
  const [showMenu,    setShowMenu]    = useState(false)
  const [showModal,   setShowModal]   = useState(false)
  const [isPending,   setIsPending]   = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const isOwnPost    = currentUserId === postOwnerId

  // Fetch whether the current user has already incelicado this post
  useEffect(() => {
    if (!currentUserId) { setHasReposted(false); return }

    supabase
      .from('posts')
      .select('id')
      .eq('repost_of', postId)
      .eq('user_id', currentUserId)
      .maybeSingle()
      .then(({ data }) => {
        setHasReposted(!!data)
        setMyRepostId((data as { id: string } | null)?.id ?? null)
      })
  }, [supabase, postId, currentUserId])

  // Close popup when clicking outside
  useEffect(() => {
    if (!showMenu) return
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [showMenu])

  async function handleIncelicar() {
    if (!currentUserId || isPending) return
    setShowMenu(false)
    setHasReposted(true)
    setRepostCount(c => c + 1)
    setIsPending(true)

    const { data, error } = await supabase
      .from('posts')
      .insert({ user_id: currentUserId, content: '', repost_of: postId, repost_comment: null })
      .select('id')
      .single()

    if (error) {
      setHasReposted(false)
      setRepostCount(c => c - 1)
    } else {
      setMyRepostId((data as { id: string }).id)
    }
    setIsPending(false)
  }

  async function handleDesfazer() {
    if (!myRepostId || isPending) return
    setShowMenu(false)
    setHasReposted(false)
    setMyRepostId(null)
    setRepostCount(c => Math.max(0, c - 1))
    setIsPending(true)

    const { error } = await supabase.from('posts').delete().eq('id', myRepostId)
    if (error) {
      setHasReposted(true)
      setRepostCount(c => c + 1)
    }
    setIsPending(false)
  }

  function handleCommentSuccess(repostId: string) {
    setHasReposted(true)
    setMyRepostId(repostId)
    setRepostCount(c => c + 1)
    setShowModal(false)
  }

  const active   = hasReposted === true
  const loading  = hasReposted === null
  const disabled = !currentUserId || isOwnPost || isPending || loading

  const title = isOwnPost
    ? 'Não dá pra incelicar o próprio post'
    : !currentUserId
      ? 'Entre para incelicar'
      : active
        ? 'Você já incelicou esse post'
        : 'Incelicar'

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setShowMenu(v => !v)}
        disabled={disabled}
        title={title}
        aria-label={title}
        className={[
          'flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all active:scale-95 disabled:cursor-default disabled:opacity-50',
          active
            ? 'border-pink bg-pink/15 text-pink shadow-[0_0_12px_-2px] shadow-pink/30'
            : 'border-zinc-700/60 bg-zinc-800/50 text-zinc-400 hover:border-pink/50 hover:bg-pink/10 hover:text-zinc-200',
        ].join(' ')}
      >
        <RepeatIcon className="h-3.5 w-3.5" />
        <span>Incelicar</span>
        {repostCount > 0 && (
          <span className={[
            'min-w-[1.1rem] rounded-full px-1 py-px text-center text-[10px] font-semibold tabular-nums leading-tight',
            active
              ? 'bg-pink/25 text-pink'
              : 'bg-zinc-700/60 text-zinc-500 group-hover:bg-pink/15',
          ].join(' ')}>
            {repostCount > 999 ? '999+' : repostCount}
          </span>
        )}
      </button>

      {/* Pop-up menu */}
      {showMenu && (
        <div className="absolute bottom-full left-0 z-20 mb-2 min-w-[200px] overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 py-1 shadow-xl">
          {active ? (
            <MenuButton onClick={handleDesfazer} danger>
              <RepeatIcon className="h-4 w-4" />
              Desfazer incelicada
            </MenuButton>
          ) : (
            <>
              <MenuButton onClick={handleIncelicar}>
                <RepeatIcon className="h-4 w-4" />
                Incelicar
              </MenuButton>
              <MenuButton onClick={() => { setShowMenu(false); setShowModal(true) }}>
                <EditIcon className="h-4 w-4" />
                Incelicar com comentário
              </MenuButton>
            </>
          )}
        </div>
      )}

      {showModal && (
        <IncelicarCommentModal
          postId={postId}
          currentUserId={currentUserId!}
          original={original}
          onSuccess={handleCommentSuccess}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}

// ─── small sub-components ─────────────────────────────────────────────────────

function MenuButton({
  onClick,
  danger = false,
  children,
}: {
  onClick: () => void
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex w-full items-center gap-2.5 px-4 py-2.5 text-sm transition-colors hover:bg-zinc-800',
        danger ? 'text-red-400' : 'text-zinc-200',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function RepeatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17 1l4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="M7 23l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  )
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}
