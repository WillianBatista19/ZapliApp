import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import EditProfileForm from '@/components/profile/EditProfileForm'

export default async function EditProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, bio, created_at, lastfm_username, watching_now, reading_now')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/feed')

  return (
    <div className="mx-auto max-w-lg px-4 pb-12">

      {/* Back header */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          href={`/profile/${profile.username}`}
          className="rounded-xl p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          aria-label="Voltar ao perfil"
        >
          ←
        </Link>
        <h1 className="text-xl font-bold text-zinc-100">Editar perfil</h1>
      </div>

      <EditProfileForm profile={profile} />

    </div>
  )
}
