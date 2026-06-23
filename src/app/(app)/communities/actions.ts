'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function createCommunity(data: {
  name:            string
  description:     string
  post_permission: string
  avatar_url?:     string | null
  banner_url?:     string | null
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  const slug = slugify(data.name)
  const { data: community, error } = await supabase
    .from('communities')
    .insert({
      name:            data.name,
      slug,
      description:     data.description || null,
      avatar_url:      data.avatar_url  || null,
      banner_url:      data.banner_url  || null,
      created_by:      user.id,
      post_permission: data.post_permission,
    })
    .select('id, slug')
    .single()

  if (error) throw new Error(error.message)

  await supabase.from('community_members').insert({
    community_id: community.id,
    user_id:      user.id,
    role:         'owner',
    can_post:     true,
  })

  revalidatePath('/communities')
  return { slug: community.slug }
}

export async function joinCommunity(communityId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  const { error } = await supabase.from('community_members').insert({
    community_id: communityId,
    user_id:      user.id,
    role:         'member',
    can_post:     true,
  })
  if (error) throw new Error(error.message)

  await supabase.rpc('increment_community_members', { p_community_id: communityId, delta: 1 })
  revalidatePath('/communities')
}

export async function leaveCommunity(communityId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  await supabase.from('community_members')
    .delete()
    .eq('community_id', communityId)
    .eq('user_id', user.id)

  await supabase.rpc('increment_community_members', { p_community_id: communityId, delta: -1 })
  revalidatePath('/communities')
}

export async function createCommunityPost(
  communityId: string,
  content:     string,
  imageUrl?:   string | null,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  const { data: post, error } = await supabase
    .from('community_posts')
    .insert({ community_id: communityId, user_id: user.id, content, image_url: imageUrl || null })
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  // Notify non-muted members (excluding the poster), capped at 50
  const [{ data: community }, { data: members }] = await Promise.all([
    supabase.from('communities').select('name').eq('id', communityId).single(),
    supabase
      .from('community_members')
      .select('user_id')
      .eq('community_id', communityId)
      .eq('notifications_muted', false)
      .neq('user_id', user.id)
      .limit(50),
  ])

  if (community && members && members.length > 0) {
    await supabase.from('notifications').insert(
      members.map(m => ({
        user_id:        m.user_id,
        from_user_id:   user.id,
        type:           'community_post',
        post_id:        null,
        comment_id:     null,
        read:           false,
        community_name: community.name,
      })),
    )
  }

  revalidatePath('/communities', 'layout')
  return { id: post.id }
}

export async function deleteCommunityPost(postId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  const { error } = await supabase.from('community_posts').delete().eq('id', postId)
  if (error) throw new Error(error.message)
}

export async function createCommunityComment(
  postId:    string,
  content:   string,
  parentId?: string | null,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  const { error } = await supabase
    .from('community_comments')
    .insert({ post_id: postId, user_id: user.id, content, parent_id: parentId || null })

  if (error) throw new Error(error.message)

  // Notify post author only if they're a non-muted member and not the commenter
  const { data: post } = await supabase
    .from('community_posts')
    .select('user_id, community_id')
    .eq('id', postId)
    .single()

  if (post && post.user_id !== user.id) {
    const [{ data: community }, { data: authorMember }] = await Promise.all([
      supabase.from('communities').select('name').eq('id', post.community_id).single(),
      supabase
        .from('community_members')
        .select('notifications_muted')
        .eq('community_id', post.community_id)
        .eq('user_id', post.user_id)
        .maybeSingle(),
    ])

    if (community && authorMember && !authorMember.notifications_muted) {
      await supabase.from('notifications').insert({
        user_id:        post.user_id,
        from_user_id:   user.id,
        type:           'community_comment',
        post_id:        null,
        comment_id:     null,
        read:           false,
        community_name: community.name,
      })
    }
  }
}

export async function deleteCommunityComment(commentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  await supabase.from('community_comments').delete().eq('id', commentId)
}

export async function updateCommunitySettings(
  communityId: string,
  data: {
    name?:            string
    description?:     string | null
    avatar_url?:      string | null
    banner_url?:      string | null
    post_permission?: string
  },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  const { error } = await supabase.from('communities').update(data).eq('id', communityId)
  if (error) throw new Error(error.message)
  revalidatePath('/communities')
}

export async function deleteCommunity(communityId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  const { data: community } = await supabase
    .from('communities').select('slug').eq('id', communityId).single()

  const { error } = await supabase.from('communities').delete().eq('id', communityId)
  if (error) throw new Error(error.message)

  revalidatePath('/communities')
  return { slug: community?.slug }
}

export async function updateMemberRole(communityId: string, userId: string, role: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  await supabase.from('community_members')
    .update({ role })
    .eq('community_id', communityId)
    .eq('user_id', userId)
}

export async function updateMemberCanPost(communityId: string, userId: string, canPost: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  await supabase.from('community_members')
    .update({ can_post: canPost })
    .eq('community_id', communityId)
    .eq('user_id', userId)
}

export async function removeMember(communityId: string, userId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  await supabase.from('community_members')
    .delete()
    .eq('community_id', communityId)
    .eq('user_id', userId)
}

export async function toggleNotificationsMuted(communityId: string, muted: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  const { error } = await supabase
    .from('community_members')
    .update({ notifications_muted: muted })
    .eq('community_id', communityId)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)
}
