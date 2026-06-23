import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CommunityPageClient from '@/components/communities/CommunityPageClient'
import type { Community, CommunityMemberRow, CommunityPost, CommunityRole } from '@/types'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function CommunityPage({ params }: Props) {
  const { slug }  = await params
  const supabase  = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: community } = await supabase
    .from('communities')
    .select('id, name, slug, description, avatar_url, banner_url, created_by, member_count, post_permission, created_at')
    .eq('slug', slug)
    .single()

  if (!community) notFound()

  const c = community as Community

  const [postsRes, membersRes, viewerMemberRes, survivorRes] = await Promise.all([
    supabase
      .from('community_posts')
      .select(`
        id, community_id, user_id, content, image_url, media_url, created_at,
        profiles!community_posts_user_id_fkey (id, username, display_name, avatar_url),
        community_post_vibes (id, post_id, user_id, type, created_at),
        community_comments (id)
      `)
      .eq('community_id', c.id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('community_members')
      .select('community_id, user_id, role, can_post, notifications_muted, joined_at, profiles!community_members_user_id_fkey (id, username, display_name, avatar_url)')
      .eq('community_id', c.id)
      .order('joined_at'),
    user
      ? supabase
          .from('community_members')
          .select('role, can_post, notifications_muted')
          .eq('community_id', c.id)
          .eq('user_id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    slug === 'musica'
      ? supabase
          .from('survivor_events')
          .select('album_name, artist_name, current_round')
          .eq('community_id', c.id)
          .eq('status', 'active')
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const { data: postsData,   error: postsError   } = postsRes
  const { data: membersData, error: membersError } = membersRes

  console.log('[Community] posts:', postsData?.length ?? 0, postsError)
  console.log('[Community] members:', membersData?.length ?? 0, membersError)

  const posts   = (postsData   ?? []) as unknown as CommunityPost[]
  const members = (membersData ?? []) as unknown as CommunityMemberRow[]

  const viewerMemberData = (viewerMemberRes as {
    data: { role: CommunityRole; can_post: boolean; notifications_muted: boolean } | null
  }).data

  const activeSurvivorEvent = (survivorRes as {
    data: { album_name: string; artist_name: string; current_round: number } | null
  }).data
  const viewerRole            = viewerMemberData?.role ?? null
  const canPost               = viewerMemberData?.can_post ?? false
  const notificationsMuted    = viewerMemberData?.notifications_muted ?? false

  return (
    <main className="max-w-2xl mx-auto px-4 py-6">
      <CommunityPageClient
        community={c}
        posts={posts}
        members={members}
        currentUserId={user?.id ?? null}
        viewerRole={viewerRole}
        canPost={canPost}
        notificationsMuted={notificationsMuted}
        activeSurvivorEvent={activeSurvivorEvent}
      />
    </main>
  )
}
