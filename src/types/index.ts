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
