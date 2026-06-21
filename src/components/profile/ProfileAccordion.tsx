'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Ctx = { open: Record<string, boolean>; toggle: (id: string) => void }
const AccordionCtx = createContext<Ctx>({ open: {}, toggle: () => {} })

export function AccordionRoot({
  defaultDesktopOpen = [],
  children,
}: {
  defaultDesktopOpen?: string[]
  children: React.ReactNode
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (window.innerWidth >= 768) {
      setOpen(Object.fromEntries(defaultDesktopOpen.map(id => [id, true])))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggle(id: string) {
    setOpen(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <AccordionCtx.Provider value={{ open, toggle }}>
      <div className="space-y-2">{children}</div>
    </AccordionCtx.Provider>
  )
}

export function AccordionSection({
  id,
  label,
  children,
}: {
  id:       string
  label:    string
  children: React.ReactNode
}) {
  const { open, toggle } = useContext(AccordionCtx)
  const isOpen = !!open[id]

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60">
      <button
        type="button"
        onClick={() => toggle(id)}
        className="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-zinc-800/40"
      >
        <span className="text-sm font-semibold text-zinc-200">{label}</span>
        <svg
          className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {isOpen && (
        <div className="border-t border-zinc-800 p-4">
          {children}
        </div>
      )}
    </div>
  )
}
