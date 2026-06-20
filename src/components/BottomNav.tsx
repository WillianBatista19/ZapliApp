'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useUser } from '@/context/UserContext'
import { createClient } from '@/lib/supabase/client'
import { useUnreadCount } from '@/hooks/useUnreadCount'
import Avatar from '@/components/Avatar'

export default function BottomNav() {
  const { user }  = useUser()
  const pathname  = usePathname()
  const supabase  = useMemo(() => createClient(), [])
  const unread    = useUnreadCount(user?.id ?? null)

  const [username,    setUsername]    = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [avatarUrl,   setAvatarUrl]   = useState<string | null>(null)

  useEffect(() => {
    if (!user) { setUsername(null); return }
    supabase
      .from('profiles')
      .select('username, display_name, avatar_url')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (!data) return
        setUsername(data.username)
        setDisplayName(data.display_name)
        setAvatarUrl(data.avatar_url)
      })
  }, [user, supabase])

  const profileHref   = username ? `/profile/${username}` : '#'
  const profileActive = !!username && pathname.startsWith(`/profile/${username}`)

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-800 bg-zinc-950 sm:hidden"
      aria-label="Navegação principal"
    >
      <div className="flex h-16 items-stretch">

        {/* Feed */}
        <NavLink href="/feed" active={pathname === '/feed' || pathname.startsWith('/feed')} label="Feed">
          <HomeIcon />
        </NavLink>

        {/* Explore */}
        <NavLink href="/explore" active={pathname.startsWith('/explore')} label="Explorar">
          <CompassIcon />
        </NavLink>

        {/* Notifications */}
        <NavLink href="/notifications" active={pathname.startsWith('/notifications')} label="Notificações">
          <span className="relative">
            <BellIcon />
            {unread > 0 && (
              <span
                aria-hidden
                className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#D4537E] px-0.5 text-[9px] font-bold leading-none text-white"
              >
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </span>
        </NavLink>

        {/* Profile — avatar with pink ring when active */}
        <Link
          href={profileHref}
          aria-label="Meu perfil"
          className={`flex flex-1 items-center justify-center transition-opacity ${
            profileActive ? 'opacity-100' : 'opacity-55 hover:opacity-80'
          }`}
        >
          <span className={profileActive ? 'rounded-full ring-2 ring-[#D4537E] ring-offset-2 ring-offset-zinc-950' : ''}>
            <Avatar
              src={avatarUrl}
              name={displayName || user?.email || ''}
              size="sm"
            />
          </span>
        </Link>

      </div>
    </nav>
  )
}

// ── Shared tab link ─────────────────────────────────────────────────────────

function NavLink({
  href, active, label, children,
}: {
  href:     string
  active:   boolean
  label:    string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={`flex flex-1 items-center justify-center transition-colors ${
        active ? 'text-[#D4537E]' : 'text-zinc-500 hover:text-zinc-300'
      }`}
    >
      {children}
    </Link>
  )
}

// ── Icons (Tabler-style, 2px stroke) ────────────────────────────────────────

function HomeIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12L3 12L12 3L21 12L19 12" />
      <path d="M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
      <path d="M9 21v-6a2 2 0 012-2h2a2 2 0 012 2v6" />
    </svg>
  )
}

function CompassIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  )
}

function BellIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  )
}
