import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TrendingSidebar from '@/components/sidebar/TrendingSidebar'
import WhoToFollow from '@/components/sidebar/WhoToFollow'

export default async function ExplorePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-zinc-100">Explorar</h1>
      <TrendingSidebar />
      <WhoToFollow currentUserId={user.id} />
    </div>
  )
}
