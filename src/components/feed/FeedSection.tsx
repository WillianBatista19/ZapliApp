import StoriesBar from '@/components/stories/StoriesBar'
import ComposerForm from '@/components/feed/ComposerForm'
import HashtagFilter from '@/components/feed/HashtagFilter'
import FeedClient from '@/components/feed/FeedClient'

type Props = {
  currentUserId: string
  createPost:    (fd: FormData) => Promise<void>
}

export default function FeedSection({ currentUserId, createPost }: Props) {
  return (
    <div className="space-y-4">
      <StoriesBar currentUserId={currentUserId} />
      <ComposerForm action={createPost} />
      <HashtagFilter />
      <FeedClient currentUserId={currentUserId} />
    </div>
  )
}
