import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProfileInteractive from '@/components/profile/ProfileInteractive'
import PostGrid from '@/components/profile/PostGrid'
import LastfmWidget from '@/components/profile/LastfmWidget'
import MediaNowWidgets from '@/components/profile/MediaNowWidgets'
import SteamWidget from '@/components/profile/SteamWidget'
import type { WatchingNow, ReadingNow } from '@/types'

type Props = {
  params: { username: string }
}

export default async function ProfilePage({ params }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { username } = params

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, bio, created_at, lastfm_username, watching_now, reading_now, anime_title, anime_cover_url, steam_id')
    .eq('username', username)
    .single()

  if (profileError) {
    // PGRST116 = row not found (single() with no match) → genuine 404
    // Any other code = DB/column error → throw so it surfaces in logs
    if (profileError.code !== 'PGRST116') throw new Error(`[profile] DB error: ${profileError.message} (${profileError.code})`)
    notFound()
  }
  if (!profile) notFound()

  const isOwnProfile = user.id === profile.id

  const [postsRes, followersRes, followingRes] = await Promise.all([
    supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profile.id),
    supabase
      .from('follows')
      .select('follower_id', { count: 'exact', head: true })
      .eq('following_id', profile.id),
    supabase
      .from('follows')
      .select('follower_id', { count: 'exact', head: true })
      .eq('follower_id', profile.id),
  ])

  const postCount      = postsRes.count      ?? 0
  const followerCount  = followersRes.count  ?? 0
  const followingCount = followingRes.count  ?? 0

  return (
    <div className="space-y-4 pb-12">
      <ProfileInteractive
        profile={profile}
        currentUserId={user.id}
        isOwnProfile={isOwnProfile}
        postCount={postCount}
        initialFollowerCount={followerCount}
        followingCount={followingCount}
      />
      <MediaNowWidgets
        watching={profile.watching_now as WatchingNow | null}
        reading={profile.reading_now  as ReadingNow  | null}
        animeTitle={profile.anime_title    as string | null}
        animeCoverUrl={profile.anime_cover_url as string | null}
      />
      {profile.steam_id && (
        <SteamWidget steamId={profile.steam_id} />
      )}
      {profile.lastfm_username && (
        <LastfmWidget username={profile.lastfm_username} />
      )}
      <PostGrid
        userId={profile.id}
        displayName={profile.display_name || profile.username}
        currentUserId={user.id}
      />
    </div>
  )
}
