import type { ReactNode } from 'react'
import AppNav from '@/components/AppNav'
import BottomNav from '@/components/BottomNav'

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppNav />
      {/* pt-4 on mobile (no top bar); sm:pt-20 on desktop (below fixed AppNav).
          pb-20 on mobile (above fixed BottomNav); sm:pb-12 on desktop. */}
      <div className="mx-auto max-w-5xl px-4 pt-4 pb-24 sm:pt-20 sm:pb-12">
        {children}
      </div>
      <BottomNav />
    </>
  )
}
