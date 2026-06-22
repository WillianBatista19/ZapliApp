import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProfileInteractive from '@/components/profile/ProfileInteractive'
import PostGrid from '@/components/profile/PostGrid'
import LastfmWidget from '@/components/profile/LastfmWidget'
import SteamWidget from '@/components/profile/SteamWidget'
import GoodreadsWidget from '@/components/profile/GoodreadsWidget'
import { AccordionRoot, AccordionSection } from '@/components/profile/ProfileAccordion'
import type { WatchingNow, ReadingNow } from '@/types'

type Props = {
  params:       { username: string }
  searchParams: { openStory?: string }
}

function MediaCard({
  item,
  label,
  labelColor,
}: {
  item:       WatchingNow
  label:      string
  labelColor: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
      {item.poster_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.poster_url} alt={item.title} className="h-16 w-11 shrink-0 rounded-lg object-cover" />
      ) : (
        <div className="flex h-16 w-11 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-xl">🎬</div>
      )}
      <div className="min-w-0 flex-1">
        <p className={`text-[10px] font-semibold uppercase tracking-wider ${labelColor}`}>{label}</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-zinc-100">{item.title}</p>
        {item.year && <p className="text-xs text-zinc-500">{item.year}</p>}
      </div>
    </div>
  )
}

function BookCard({
  item,
  label,
  labelColor,
}: {
  item:       ReadingNow
  label:      string
  labelColor: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
      {item.cover_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.cover_url} alt={item.title} className="h-16 w-11 shrink-0 rounded-lg object-cover" />
      ) : (
        <div className="flex h-16 w-11 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-xl">📚</div>
      )}
      <div className="min-w-0 flex-1">
        <p className={`text-[10px] font-semibold uppercase tracking-wider ${labelColor}`}>{label}</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-zinc-100">{item.title}</p>
        {item.author && <p className="text-xs text-zinc-500">{item.author}</p>}
      </div>
    </div>
  )
}

function AnimeCard({ title, coverUrl }: { title: string; coverUrl: string | null }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
      {coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverUrl} alt={title} className="h-16 w-11 shrink-0 rounded-lg object-cover" />
      ) : (
        <div className="flex h-16 w-11 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-xl">✨</div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#7F77DD]">Anime favorito</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-zinc-100">{title}</p>
      </div>
    </div>
  )
}

export default async function ProfilePage({ params, searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { username } = params

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, bio, created_at, lastfm_username, watching_now, reading_now, anime_title, anime_cover_url, steam_id, goodreads_book_title, goodreads_book_author, goodreads_cover_url, goodreads_rating, favorite_film, favorite_book')
    .eq('username', username)
    .single()

  if (profileError) {
    if (profileError.code !== 'PGRST116') throw new Error(`[profile] DB error: ${profileError.message} (${profileError.code})`)
    notFound()
  }
  if (!profile) notFound()

  function parseJson<T>(raw: unknown): T | null {
    if (!raw) return null
    if (typeof raw === 'string') { try { return JSON.parse(raw) as T } catch { return null } }
    return raw as T
  }

  const watching     = parseJson<WatchingNow>(profile.watching_now)
  const reading      = parseJson<ReadingNow>(profile.reading_now)
  const favoriteFilm = parseJson<WatchingNow>(profile.favorite_film)
  const favoriteBook = parseJson<ReadingNow>(profile.favorite_book)

  const isOwnProfile = user.id === profile.id

  const currentUserUsername = isOwnProfile
    ? profile.username
    : await supabase.from('profiles').select('username').eq('id', user.id).single()
        .then(({ data }) => (data as { username: string } | null)?.username ?? null)

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

  const hasMusic     = !!profile.lastfm_username
  const hasMedia     = !!(watching || favoriteFilm)
  const hasReading   = !!(reading || favoriteBook)
  const hasGaming    = !!profile.steam_id
  const hasAnime     = !!profile.anime_title
  const hasGoodreads = !!profile.goodreads_book_title
  const hasAny       = hasMusic || hasMedia || hasReading || hasGaming || hasAnime || hasGoodreads

  return (
    <div className="space-y-4 pb-12">
      <ProfileInteractive
        profile={profile}
        currentUserId={user.id}
        currentUserUsername={currentUserUsername}
        isOwnProfile={isOwnProfile}
        postCount={postCount}
        initialFollowerCount={followerCount}
        followingCount={followingCount}
        openStory={searchParams.openStory === 'true'}
      />

      {hasAny && (
        <AccordionRoot defaultDesktopOpen={['music']}>
          {hasMusic && (
            <AccordionSection id="music" label="🎵 Música">
              <LastfmWidget username={profile.lastfm_username as string} />
            </AccordionSection>
          )}

          {hasMedia && (
            <AccordionSection id="media" label="🎬 Mídia">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {watching     && <MediaCard item={watching}     label="Assistindo agora" labelColor="text-[#D4537E]"  />}
                {favoriteFilm && <MediaCard item={favoriteFilm} label="Filme favorito"   labelColor="text-amber-400" />}
              </div>
            </AccordionSection>
          )}

          {hasReading && (
            <AccordionSection id="reading" label="📚 Leituras">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {reading      && <BookCard item={reading}      label="Lendo agora"    labelColor="text-[#7F77DD]"  />}
                {favoriteBook && <BookCard item={favoriteBook} label="Livro favorito" labelColor="text-amber-400" />}
              </div>
            </AccordionSection>
          )}

          {hasGaming && (
            <AccordionSection id="gaming" label="🎮 Gaming">
              <SteamWidget steamId={profile.steam_id as string} />
            </AccordionSection>
          )}

          {hasAnime && (
            <AccordionSection id="anime" label="📺 Anime">
              <AnimeCard
                title={profile.anime_title as string}
                coverUrl={profile.anime_cover_url as string | null}
              />
            </AccordionSection>
          )}

          {hasGoodreads && (
            <AccordionSection id="goodreads" label="📖 Goodreads">
              <GoodreadsWidget
                title={profile.goodreads_book_title  as string}
                author={profile.goodreads_book_author as string | null}
                coverUrl={profile.goodreads_cover_url  as string | null}
                rating={profile.goodreads_rating       as number | null}
              />
            </AccordionSection>
          )}
        </AccordionRoot>
      )}

      <PostGrid
        userId={profile.id}
        displayName={profile.display_name || profile.username}
        currentUserId={user.id}
      />
    </div>
  )
}
