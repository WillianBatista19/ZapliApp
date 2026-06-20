'use client'

import { useEffect } from 'react'

type Props = {
  title?:       string
  message:      string
  confirmLabel: string
  onConfirm:    () => void
  onCancel:     () => void
  loading?:     boolean
  variant?:     'default' | 'danger'
}

export default function ConfirmModal({ title, message, confirmLabel, onConfirm, onCancel, loading = false, variant = 'default' }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onCancel}
      role="dialog"
      aria-modal
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {title && (
          <h2 className="mb-2 text-base font-bold text-zinc-100">{title}</h2>
        )}
        <p className="text-sm text-zinc-400">{message}</p>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            className="rounded-xl bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-300 transition-colors hover:bg-zinc-700 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={[
              'rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50',
              variant === 'danger'
                ? 'bg-red-700 hover:bg-red-600'
                : 'bg-[#D4537E] hover:bg-[#c0446e]',
            ].join(' ')}
          >
            {loading ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
