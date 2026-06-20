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
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles (id) on delete cascade,
  content      text not null,
  image_url    text,
  spotify_url  text,
  youtube_url  text,
  category     post_category,
  created_at   timestamptz not null default now()
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
-- Realtime — enable for live feed and notifications
-- ============================================================

alter publication supabase_realtime add table posts;
alter publication supabase_realtime add table vibes;
alter publication supabase_realtime add table comments;
alter publication supabase_realtime add table notifications;
