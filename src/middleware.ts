import { createServerClient, type SetAllCookies } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // getUser() also refreshes the session when the access token is expiring.
  // Must be called before any redirect so the refreshed token cookie is set.
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Rule 1 — not logged in, trying to reach a protected route → /login
  if (!user && pathname.startsWith('/feed')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    const redirect = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach(({ name, value, ...rest }) =>
      redirect.cookies.set(name, value, rest),
    )
    return redirect
  }

  // Rule 2 — logged in, trying to reach login or signup → /feed
  if (user && (pathname === '/login' || pathname === '/signup')) {
    const url = request.nextUrl.clone()
    url.pathname = '/feed'
    const redirect = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach(({ name, value, ...rest }) =>
      redirect.cookies.set(name, value, rest),
    )
    return redirect
  }

  // Public pages (/status, /changelog) and everything else — pass through
  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
