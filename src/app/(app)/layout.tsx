import type { ReactNode } from 'react'
import AppNav from '@/components/AppNav'
import BottomNav from '@/components/BottomNav'
import LeftSidebar from '@/components/LeftSidebar'
import NavFooter from '@/components/NavFooter'

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppNav />
      <div className="mx-auto max-w-6xl px-4 pt-4 pb-24 sm:pt-20 sm:pb-12">
        {/* xl+: left sidebar + content side by side; below xl: content only */}
        <div className="xl:flex xl:gap-8">
          <LeftSidebar />
          <div className="min-w-0 flex-1 overflow-x-hidden">
            {children}
          </div>
        </div>

        {/* Mobile-only footer links — hidden on xl where LeftSidebar handles this, and hidden on /messages */}
        <NavFooter />
      </div>
      <BottomNav />
    </>
  )
}
