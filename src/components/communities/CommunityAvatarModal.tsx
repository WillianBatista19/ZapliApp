'use client'

import { useEffect } from 'react'

interface Props {
  src:     string
  name:    string
  onClose: () => void
}

export default function CommunityAvatarModal({ src, name, onClose }: Props) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar"
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800/80 text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="h-5 w-5" aria-hidden>
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`Foto de ${name}`}
        className="max-h-[80vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl sm:max-w-[400px]"
        onClick={e => e.stopPropagation()}
      />
    </div>
  )
}
