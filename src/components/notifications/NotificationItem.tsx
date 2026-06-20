import Link from 'next/link'
import Avatar from '@/components/Avatar'
import VerifiedBadge from '@/components/VerifiedBadge'
import { relativeTime } from '@/lib/utils'
import { notificationText, notificationEmoji, notificationHref } from '@/lib/notificationCopy'
import { isVerified } from '@/lib/verified'
import type { NotificationRow } from '@/types'

type Props = {
  notification: NotificationRow
}

export default function NotificationItem({ notification }: Props) {
  const { type, from_profile, post, comment, read, created_at, post_id } = notification

  const actorName = from_profile.display_name || from_profile.username
  const text      = notificationText(type, actorName, comment?.content ?? null)
  const emoji     = notificationEmoji(type)
  const href      = notificationHref(type, from_profile.username, post_id)

  return (
    <Link
      href={href}
      className={[
        'flex items-start gap-3 rounded-2xl border px-4 py-3 transition-colors',
        read
          ? 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
          : 'border-zinc-700 bg-zinc-900 hover:border-zinc-600',
      ].join(' ')}
    >
      {/* Actor avatar */}
      <div className="relative flex-shrink-0">
        <Avatar
          src={from_profile.avatar_url}
          name={actorName}
          size="md"
        />
        {/* Notification type emoji badge */}
        <span
          aria-hidden
          className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-950 text-xs ring-1 ring-zinc-800"
        >
          {emoji}
        </span>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className={['text-sm leading-snug', read ? 'text-zinc-400' : 'text-zinc-100'].join(' ')}>
          <span className="font-semibold">{actorName}</span>
          {isVerified(from_profile.username) && <VerifiedBadge className="mx-0.5 align-middle" />}
          {text.slice(actorName.length)}
        </p>

        {/* Post excerpt for vibe/repost/mention */}
        {post && !comment && (type === 'vibe' || type === 'repost' || type === 'mention') && (
          <p className="mt-1 truncate text-xs text-zinc-600">
            {post.content}
          </p>
        )}

        <p className="mt-1 text-xs text-zinc-600">{relativeTime(created_at)}</p>
      </div>

      {/* Unread dot */}
      {!read && (
        <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-pink" aria-hidden />
      )}
    </Link>
  )
}
