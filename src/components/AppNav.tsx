'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useUser } from '@/context/UserContext'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/components/Avatar'
import NotificationBell from '@/components/notifications/NotificationBell'
import ThemeToggle from '@/components/ThemeToggle'

export default function AppNav() {
  const { user } = useUser()
  const supabase  = useMemo(() => createClient(), [])
  const pathname  = usePathname()
  const router    = useRouter()

  function handleLogoClick(e: React.MouseEvent) {
    if (pathname === '/feed') {
      e.preventDefault()
      router.refresh()
    }
  }

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

  return (
    <header className="fixed inset-x-0 top-0 z-50 hidden border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-xl sm:block">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">

        {/* Logo: "incel" flips to dark text in light mode, "icas" stays pink */}
        <Link href="/feed" onClick={handleLogoClick} className="text-xl font-bold tracking-tight">
          <span className="logo-prefix">incel</span><span className="text-pink">icas</span>
          {' '}<span className="text-zinc-400">✦</span>
        </Link>

        <div className="flex items-center gap-3">
          <ThemeToggle className="rounded-xl p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100" />

          {user && <NotificationBell />}

          {user && (
            username ? (
              <Link href={`/profile/${username}`} aria-label="Seu perfil">
                <Avatar
                  src={avatarUrl}
                  name={displayName || user.email}
                  size="sm"
                  className="transition-opacity hover:opacity-80"
                />
              </Link>
            ) : (
              <Avatar src={null} name={user.email} size="sm" />
            )
          )}
        </div>

      </div>
    </header>
  )
}
