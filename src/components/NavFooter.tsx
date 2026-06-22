'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function NavFooter() {
  const pathname = usePathname()
  if (pathname.startsWith('/messages')) return null

  return (
    <footer className="mt-8 flex items-center justify-center gap-6 xl:hidden">
      <Link
        href="/status"
        className="text-xs text-zinc-600 transition-colors hover:text-zinc-400"
      >
        Status
      </Link>
      <span className="text-zinc-800" aria-hidden>·</span>
      <Link
        href="/changelog"
        className="text-xs text-zinc-600 transition-colors hover:text-zinc-400"
      >
        Novidades
      </Link>
    </footer>
  )
}
