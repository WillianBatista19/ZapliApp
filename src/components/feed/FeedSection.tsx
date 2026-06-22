import StoriesBar    from '@/components/stories/StoriesBar'
import PostComposer  from '@/components/feed/PostComposer'
import FeedClient    from '@/components/feed/FeedClient'
import DailyGameCard from '@/components/feed/DailyGameCard'
import type { Profile } from '@/types'

type Props = {
  currentUserId: string
  profile:       Profile
}

export default function FeedSection({ currentUserId, profile }: Props) {
  return (
    <div className="space-y-4">
      <StoriesBar currentUserId={currentUserId} currentUserUsername={profile.username} />
      <PostComposer profile={profile} />
      <DailyGameCard />
      <FeedClient currentUserId={currentUserId} currentUserUsername={profile.username} />
    </div>
  )
}
