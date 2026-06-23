export type Category         = 'anime' | 'bbb' | 'musica' | 'serie' | 'filme' | 'livro'
export type VibeType         = 'serving' | 'morrei' | 'iconic' | 'cha' | 'hype'
export type NotificationType =
  | 'follow'
  | 'follow_back'
  | 'vibe'
  | 'comment'
  | 'comment_reply'
  | 'comment_like'
  | 'repost'
  | 'mention'
  | 'message'
  | 'group_message'
  | 'story_like'
  | 'follow_request'
  | 'follow_accepted'
  | 'community_post'
  | 'community_comment'

export interface WatchingNow {
  id:         number
  title:      string
  year:       string
  poster_url: string | null
}

export interface ReadingNow {
  id:        string
  title:     string
  author:    string
  cover_url: string | null
}

export interface Profile {
  id:              string
  username:        string
  display_name:    string
  avatar_url:      string | null
  bio:             string | null
  created_at:      string
  is_private:      boolean
  lastfm_username: string | null
  watching_now:    WatchingNow | null
  reading_now:     ReadingNow  | null
  anime_title:     string | null
  anime_cover_url: string | null
  steam_id:        string | null
  goodreads_book_title:  string | null
  goodreads_book_author: string | null
  goodreads_cover_url:   string | null
  goodreads_rating:      number | null
  favorite_film:         WatchingNow | null
  favorite_book:         ReadingNow  | null
}

export interface Vibe {
  id: string
  post_id: string
  user_id: string
  type: VibeType
  created_at: string
}

export interface Comment {
  id: string
  post_id: string
  user_id: string
  parent_id: string | null
  content: string
  created_at: string
}

export interface NotificationRow {
  id:           string
  user_id:      string
  from_user_id: string
  type:         NotificationType
  post_id:      string | null
  comment_id:   string | null
  read:         boolean
  created_at:   string
  from_profile: Pick<Profile, 'display_name' | 'username' | 'avatar_url'>
  post:         Pick<Post, 'content'> | null
  comment:      Pick<Comment, 'content'> | null
}

export interface OriginalPost {
  id:          string
  user_id:     string
  content:     string
  image_url:   string | null
  spotify_url: string | null
  youtube_url: string | null
  category:    Category | null
  created_at:  string
  profiles:    Profile
}

export interface StoryProfile {
  id:           string
  username:     string
  display_name: string | null
  avatar_url:   string | null
}

export interface Story {
  id:         string
  user_id:    string
  media_url:  string
  created_at: string
  expires_at: string
  profiles:   StoryProfile
}

export interface StoryGroup {
  user:    StoryProfile
  stories: Story[]
}

export interface ConversationMessage {
  id:              string
  conversation_id: string
  sender_id:       string
  content:         string
  created_at:      string
}

export interface ConversationParticipant {
  id:           string
  username:     string
  display_name: string | null
  avatar_url:   string | null
}

export interface ConversationSummary {
  id:               string
  lastReadAt:       string | null
  isGroup:          boolean
  groupName:        string | null
  groupAvatarUrl:   string | null
  groupDescription: string | null
  createdBy:        string | null
  participants:     ConversationParticipant[]
  otherUser:        ConversationParticipant | null
  lastMessage:      ConversationMessage | null
}

export type PostPermission = 'all' | 'owner_only' | 'allowed_users'
export type CommunityRole  = 'owner' | 'moderator' | 'member'

export interface CommunityVibe {
  id:         string
  post_id:    string
  user_id:    string
  type:       VibeType
  created_at: string
}

export interface Community {
  id:              string
  name:            string
  slug:            string
  description:     string | null
  avatar_url:      string | null
  banner_url:      string | null
  created_by:      string
  member_count:    number
  post_permission: PostPermission
  created_at:      string
}

export interface CommunityMemberRow {
  community_id:         string
  user_id:              string
  role:                 CommunityRole
  can_post:             boolean
  notifications_muted:  boolean
  joined_at:            string
  profiles?: {
    id:           string
    username:     string
    display_name: string | null
    avatar_url:   string | null
  }
}

export interface CommunityPost {
  id:           string
  community_id: string
  user_id:      string
  content:      string
  image_url:    string | null
  media_url:    string | null
  created_at:   string
  profiles: {
    id:           string
    username:     string
    display_name: string | null
    avatar_url:   string | null
  }
  community_post_vibes: CommunityVibe[]
  community_comments:   { id: string }[]
}

export interface SurvivorEvent {
  id:            string
  community_id:  string
  created_by:    string
  album_id:      string
  album_name:    string
  artist_name:   string
  cover_url:     string | null
  status:        'active' | 'finished'
  current_round: number
  created_at:    string
}

export interface SurvivorTrack {
  id:                  string
  event_id:            string
  track_id:            string
  track_name:          string
  track_number:        number
  preview_url:         string | null
  eliminated_at_round: number | null
  final_position:      number | null
  created_at:          string
}

export interface Post {
  id:             string
  user_id:        string
  content:        string
  image_url:      string | null
  spotify_url:    string | null
  youtube_url:    string | null
  category:       Category | null
  created_at:     string
  repost_of?:     string | null
  repost_comment: string | null
  repost_count:   number
  profiles:       Profile
  vibes:          Vibe[]
  original_post:  OriginalPost | null
}
