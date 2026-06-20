import type { ReactNode } from 'react'
import Link from 'next/link'
import AppNav from '@/components/AppNav'
import BottomNav from '@/components/BottomNav'
import LeftSidebar from '@/components/LeftSidebar'

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppNav />
      <div className="mx-auto max-w-6xl overflow-x-hidden px-4 pt-4 pb-24 sm:pt-20 sm:pb-12">
        {/* xl+: left sidebar + content side by side; below xl: content only */}
        <div className="xl:flex xl:gap-8">
          <LeftSidebar />
          <div className="min-w-0 flex-1">
            {children}
          </div>
        </div>

        {/* Mobile-only footer links — hidden on xl where LeftSidebar handles this */}
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
      </div>
      <BottomNav />
    </>
  )
}
