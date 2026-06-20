-- ============================================================
-- Incelicas — Supabase Schema
-- ============================================================

-- ------------------------------------------------------------
-- Enums
-- ------------------------------------------------------------

create type vibe_type as enum ('serving', 'morrei', 'iconic', 'cha', 'hype');

create type notification_type as enum (
  'follow',
  'follow_back',
  'vibe',
  'comment',
  'comment_reply',
  'comment_like',
  'repost',
  'mention'
);

create type post_category as enum (
  'anime',
  'bbb',
  'musica',
  'serie',
  'filme',
  'livro'
);

-- ------------------------------------------------------------
-- profiles
-- ------------------------------------------------------------

create table profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  username      text not null unique,
  display_name  text not null,
  bio           text,
  avatar_url    text,
  created_at    timestamptz not null default now()
);

-- Auto-create a minimal profile row when a user signs up
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ------------------------------------------------------------
-- posts
-- ------------------------------------------------------------

create table posts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references profiles (id) on delete cascade,
  content        text not null,
  image_url      text,
  spotify_url    text,
  youtube_url    text,
  category       post_category,
  created_at     timestamptz not null default now(),
  -- Repost ("incelicar") columns
  repost_of      uuid references posts (id) on delete cascade,
  repost_comment text,
  repost_count   integer not null default 0,

  constraint posts_no_self_repost check (repost_of is null or repost_of <> id)
);

-- ------------------------------------------------------------
-- vibes (reactions — one active vibe per user per post)
-- ------------------------------------------------------------

create table vibes (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references posts (id) on delete cascade,
  user_id    uuid not null references profiles (id) on delete cascade,
  type       vibe_type not null,
  created_at timestamptz not null default now(),

  constraint vibes_unique_user_post unique (post_id, user_id)
);

-- ------------------------------------------------------------
-- comments
-- ------------------------------------------------------------

create table comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references posts (id) on delete cascade,
  user_id    uuid not null references profiles (id) on delete cascade,
  parent_id  uuid references comments (id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- follows
-- ------------------------------------------------------------

create table follows (
  follower_id  uuid not null references profiles (id) on delete cascade,
  following_id uuid not null references profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),

  primary key (follower_id, following_id),
  constraint follows_no_self_follow check (follower_id <> following_id)
);

-- ------------------------------------------------------------
-- notifications
-- ------------------------------------------------------------

create table notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles (id) on delete cascade,
  from_user_id uuid not null references profiles (id) on delete cascade,
  type         notification_type not null,
  post_id      uuid references posts (id) on delete cascade,
  comment_id   uuid references comments (id) on delete cascade,
  read         boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ============================================================
-- Indexes
-- ============================================================

create index posts_user_id_idx        on posts         (user_id, created_at desc);
create index posts_category_idx       on posts         (category, created_at desc);
create index posts_repost_of_idx      on posts         (repost_of) where repost_of is not null;
create index vibes_post_id_idx        on vibes         (post_id);
create index vibes_user_id_idx        on vibes         (user_id);
create index comments_post_id_idx     on comments      (post_id, created_at asc);
create index follows_follower_idx     on follows       (follower_id);
create index follows_following_idx    on follows       (following_id);
create index notifications_user_idx   on notifications (user_id, created_at desc);
create index notifications_unread_idx on notifications (user_id, read) where read = false;

-- ============================================================
-- Notification Triggers
-- ============================================================

-- Helper to skip self-notifications
create or replace function create_notification(
  p_user_id      uuid,
  p_from_user_id uuid,
  p_type         notification_type,
  p_post_id      uuid default null,
  p_comment_id   uuid default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if p_user_id = p_from_user_id then
    return;
  end if;

  insert into notifications (user_id, from_user_id, type, post_id, comment_id)
  values (p_user_id, p_from_user_id, p_type, p_post_id, p_comment_id);
end;
$$;

-- Vibe → notify post owner
-- Fires on INSERT only (first vibe per user per post).
-- Switching vibes goes through the upsert ON CONFLICT DO UPDATE path,
-- which fires UPDATE — intentionally NOT re-notified to avoid spam.
create or replace function notify_on_vibe()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_post_owner uuid;
begin
  select user_id into v_post_owner from posts where id = new.post_id;
  perform create_notification(v_post_owner, new.user_id, 'vibe', new.post_id);
  return new;
end;
$$;

create trigger trg_notify_vibe
  after insert on vibes
  for each row execute procedure notify_on_vibe();

-- Comment → notify post owner; reply → notify parent comment owner
create or replace function notify_on_comment()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_post_owner    uuid;
  v_parent_owner  uuid;
begin
  select user_id into v_post_owner from posts where id = new.post_id;
  perform create_notification(v_post_owner, new.user_id, 'comment', new.post_id, new.id);

  if new.parent_id is not null then
    select user_id into v_parent_owner from comments where id = new.parent_id;
    if v_parent_owner <> v_post_owner then
      perform create_notification(v_parent_owner, new.user_id, 'comment_reply', new.post_id, new.id);
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_notify_comment
  after insert on comments
  for each row execute procedure notify_on_comment();

-- Follow → notify followed user; mutual follow → notify follow_back
create or replace function notify_on_follow()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_mutual boolean;
begin
  -- Check if the other person already follows back
  select exists(
    select 1 from follows
    where follower_id = new.following_id
      and following_id = new.follower_id
  ) into v_mutual;

  if v_mutual then
    -- B was already following A; A now follows B back.
    -- Only B (new.following_id) is notified — A is the one who initiated, so A gets nothing.
    perform create_notification(new.following_id, new.follower_id, 'follow_back');
  else
    perform create_notification(new.following_id, new.follower_id, 'follow');
  end if;

  return new;
end;
$$;

create trigger trg_notify_follow
  after insert on follows
  for each row execute procedure notify_on_follow();

-- Repost (incelicar) → increment count on original + notify its owner
create or replace function handle_repost_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update posts
    set repost_count = repost_count + 1
    where id = new.repost_of;

  perform create_notification(
    (select user_id from posts where id = new.repost_of),
    new.user_id,
    'repost',
    new.repost_of
  );

  return new;
end;
$$;

create trigger trg_handle_repost_insert
  after insert on posts
  for each row
  when (new.repost_of is not null)
  execute procedure handle_repost_insert();

-- Undo repost → decrement count on original
create or replace function handle_repost_delete()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update posts
    set repost_count = greatest(0, repost_count - 1)
    where id = old.repost_of;

  return old;
end;
$$;

create trigger trg_handle_repost_delete
  after delete on posts
  for each row
  when (old.repost_of is not null)
  execute procedure handle_repost_delete();

-- @mention in comments → notify each mentioned user
create or replace function notify_on_mention()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_username     text;
  v_mentioned_id uuid;
begin
  for v_username in
    select distinct lower(m[1])
    from regexp_matches(new.content, '@([A-Za-z0-9_]+)', 'g') m
  loop
    select id into v_mentioned_id
    from profiles
    where lower(username) = v_username;

    if v_mentioned_id is not null then
      perform create_notification(v_mentioned_id, new.user_id, 'mention', new.post_id, new.id);
    end if;
  end loop;
  return new;
end;
$$;

create trigger trg_notify_mention
  after insert on comments
  for each row execute procedure notify_on_mention();

-- ------------------------------------------------------------
-- comment_likes  (heart reactions on comments and replies)
-- ------------------------------------------------------------

create table comment_likes (
  id         uuid primary key default gen_random_uuid(),
  comment_id uuid not null references comments (id) on delete cascade,
  user_id    uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),

  constraint comment_likes_unique unique (comment_id, user_id)
);

create index comment_likes_comment_idx on comment_likes (comment_id);
create index comment_likes_user_idx    on comment_likes (user_id);

alter table comment_likes enable row level security;

create policy "comment_likes: public read"
  on comment_likes for select using (true);

create policy "comment_likes: authenticated insert"
  on comment_likes for insert with check (auth.uid() = user_id);

create policy "comment_likes: owner delete"
  on comment_likes for delete using (auth.uid() = user_id);

-- comment_like → notify comment author
create or replace function notify_on_comment_like()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_author_id uuid;
  v_post_id   uuid;
begin
  select user_id, post_id into v_author_id, v_post_id
  from comments where id = new.comment_id;

  perform create_notification(v_author_id, new.user_id, 'comment_like', v_post_id, new.comment_id);
  return new;
end;
$$;

create trigger trg_notify_comment_like
  after insert on comment_likes
  for each row execute procedure notify_on_comment_like();

-- ============================================================
-- Hashtags  (free-form tags extracted from post content)
-- ============================================================

create table hashtags (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references posts (id) on delete cascade,
  tag        text not null check (length(tag) between 1 and 100),
  created_at timestamptz not null default now(),

  constraint hashtags_unique unique (post_id, tag)
);

create index hashtags_tag_idx     on hashtags (tag, created_at desc);
create index hashtags_post_id_idx on hashtags (post_id);

alter table hashtags enable row level security;

create policy "hashtags: public read"
  on hashtags for select using (true);

-- Extract #hashtags from post content on insert or content update
create or replace function extract_post_hashtags()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_tag text;
begin
  -- Remove stale hashtags (handles UPDATE as well as INSERT)
  delete from hashtags where post_id = new.id;

  for v_tag in
    select distinct lower(m[1])
    from regexp_matches(new.content, '#([A-Za-z0-9_]+)', 'g') m
    where length(m[1]) between 1 and 100
  loop
    insert into hashtags (post_id, tag)
    values (new.id, v_tag)
    on conflict (post_id, tag) do nothing;
  end loop;

  return new;
end;
$$;

create trigger trg_extract_hashtags
  after insert or update of content on posts
  for each row
  execute procedure extract_post_hashtags();

-- RPC: top N hashtags by post count in the last X hours
create or replace function trending_hashtags(hours int default 24, max_results int default 10)
returns table (tag text, post_count bigint)
language sql stable
as $$
  select h.tag, count(*) as post_count
  from hashtags h
  where h.created_at >= now() - (hours || ' hours')::interval
  group by h.tag
  order by post_count desc, h.tag asc
  limit max_results;
$$;

-- ============================================================
-- Row Level Security
-- ============================================================

alter table profiles      enable row level security;
alter table posts         enable row level security;
alter table vibes         enable row level security;
alter table comments      enable row level security;
alter table follows       enable row level security;
alter table notifications enable row level security;

-- ------------------------------------------------------------
-- profiles policies
-- ------------------------------------------------------------

-- Anyone (including anon) can read profiles
create policy "profiles: public read"
  on profiles for select
  using (true);

-- Only the owner can insert their own profile (the trigger handles this,
-- but explicit policy keeps things safe)
create policy "profiles: owner insert"
  on profiles for insert
  with check (id = auth.uid());

-- Only the owner can update their own profile
create policy "profiles: owner update"
  on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Supabase cascade handles delete via auth.users; no direct delete by clients
create policy "profiles: owner delete"
  on profiles for delete
  using (id = auth.uid());

-- ------------------------------------------------------------
-- posts policies
-- ------------------------------------------------------------

create policy "posts: public read"
  on posts for select
  using (true);

create policy "posts: authenticated insert"
  on posts for insert
  with check (auth.uid() = user_id);

create policy "posts: owner update"
  on posts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "posts: owner delete"
  on posts for delete
  using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- vibes policies
-- ------------------------------------------------------------

create policy "vibes: public read"
  on vibes for select
  using (true);

create policy "vibes: authenticated insert"
  on vibes for insert
  with check (auth.uid() = user_id);

-- Allow switching vibe type (upsert updates)
create policy "vibes: owner update"
  on vibes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "vibes: owner delete"
  on vibes for delete
  using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- comments policies
-- ------------------------------------------------------------

create policy "comments: public read"
  on comments for select
  using (true);

create policy "comments: authenticated insert"
  on comments for insert
  with check (auth.uid() = user_id);

create policy "comments: owner update"
  on comments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "comments: owner delete"
  on comments for delete
  using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- follows policies
-- ------------------------------------------------------------

create policy "follows: public read"
  on follows for select
  using (true);

create policy "follows: authenticated insert"
  on follows for insert
  with check (auth.uid() = follower_id);

create policy "follows: owner delete"
  on follows for delete
  using (auth.uid() = follower_id);

-- ------------------------------------------------------------
-- notifications policies
-- ------------------------------------------------------------

-- Users can only see their own notifications
create policy "notifications: owner read"
  on notifications for select
  using (auth.uid() = user_id);

-- Notifications are created by triggers (security definer), not direct client inserts
-- Keeping insert locked to service role only via the absence of an insert policy.

-- Users can mark their own notifications as read
create policy "notifications: owner update"
  on notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "notifications: owner delete"
  on notifications for delete
  using (auth.uid() = user_id);

-- ============================================================
-- Stories  (24-hour ephemeral photo posts)
-- ============================================================

create table stories (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references profiles (id) on delete cascade,
  media_url  text        not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create index stories_user_expires_idx on stories (user_id, expires_at);
create index stories_expires_idx      on stories (expires_at) where expires_at > now();

alter table stories enable row level security;

-- Anyone authenticated can see active stories
create policy "stories: public read active"
  on stories for select
  using (expires_at > now());

create policy "stories: authenticated insert"
  on stories for insert
  with check (auth.uid() = user_id);

create policy "stories: owner delete"
  on stories for delete
  using (auth.uid() = user_id);

-- ── story_views  (tracks which users have seen each story) ────────────────

create table story_views (
  story_id   uuid        not null references stories (id) on delete cascade,
  user_id    uuid        not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),

  primary key (story_id, user_id)
);

create index story_views_user_idx on story_views (user_id);

alter table story_views enable row level security;

create policy "story_views: owner read"
  on story_views for select
  using (auth.uid() = user_id);

create policy "story_views: authenticated insert"
  on story_views for insert
  with check (auth.uid() = user_id);

-- ============================================================
-- Realtime — enable for live feed and notifications
-- ============================================================

alter publication supabase_realtime add table posts;
alter publication supabase_realtime add table vibes;
alter publication supabase_realtime add table comments;
alter publication supabase_realtime add table notifications;
