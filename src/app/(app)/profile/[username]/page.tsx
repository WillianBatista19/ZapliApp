import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProfileInteractive from '@/components/profile/ProfileInteractive'
import PostGrid from '@/components/profile/PostGrid'
import LastfmWidget from '@/components/profile/LastfmWidget'

type Props = {
  params: { username: string }
}

export default async function ProfilePage({ params }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { username } = params

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, bio, created_at, lastfm_username')
    .eq('username', username)
    .single()

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
    <div className="mx-auto max-w-2xl px-4 pb-12">
      <ProfileInteractive
        profile={profile}
        currentUserId={user.id}
        isOwnProfile={isOwnProfile}
        postCount={postCount}
        initialFollowerCount={followerCount}
        followingCount={followingCount}
      />
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
