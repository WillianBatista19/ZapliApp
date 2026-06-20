'use client'

import { useState } from 'react'
import Link from 'next/link'
import AuthCard from '@/components/AuthCard'
import { createClient } from '@/lib/supabase/client'
import { translateAuthError } from '@/lib/auth-errors'

type Status = 'idle' | 'loading' | 'success'

const SUFFIX_WORDS = ['pop', 'icon', 'bbb', 'real', 'vibe', 'br']

function generateUsernameSuggestions(base: string): string[] {
  const year    = new Date().getFullYear()
  const rand2   = String(Math.floor(Math.random() * 90) + 10)
  const randBirth = String(Math.floor(Math.random() * 30) + 80)
  const word    = SUFFIX_WORDS[Math.floor(Math.random() * SUFFIX_WORDS.length)]

  const seen = new Set<string>()
  const out: string[] = []
  for (const s of [`${base}${rand2}`, `${base}${year}`, `${base}_${word}`, `${base}${randBirth}`]) {
    if (!seen.has(s)) { seen.add(s); out.push(s) }
  }
  return out
}

export default function SignupPage() {
  const [username,    setUsername]    = useState('')
  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [confirm,     setConfirm]     = useState('')
  const [error,       setError]       = useState<string | null>(null)
  const [status,      setStatus]      = useState<Status>('idle')
  const [suggestions, setSuggestions] = useState<string[]>([])

  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuggestions([])

    if (password !== confirm) {
      setError('As senhas não batem. Confere aí!')
      return
    }

    const cleanUsername = username.trim().toLowerCase()

    if (cleanUsername.length < 3) {
      setError('Username precisa ter pelo menos 3 caracteres.')
      return
    }

    setStatus('loading')

    // Check if username is already taken before creating the auth user
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', cleanUsername)
      .maybeSingle()

    if (existing) {
      setSuggestions(generateUsernameSuggestions(cleanUsername))
      setStatus('idle')
      return
    }

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username:     cleanUsername,
          display_name: username.trim(),
        },
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    })

    if (authError) {
      setError(translateAuthError(authError.message))
      setStatus('idle')
      return
    }

    setStatus('success')
  }

  if (status === 'success') {
    return (
      <AuthCard title="Quase lá!" subtitle="">
        <div className="space-y-4 text-center">
          <div className="text-5xl">📬</div>
          <p className="text-sm text-zinc-300 leading-relaxed">
            Mandamos um link de confirmação para{' '}
            <span className="font-semibold text-pink">{email}</span>.
            <br />
            Checa tua caixa de entrada e clica no link para ativar sua conta!
          </p>
          <Link href="/login" className="block text-sm text-zinc-500 hover:text-pink transition-colors">
            Voltar para o login
          </Link>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Cria sua conta"
      subtitle="Bora entrar nessa vibe, incelica!"
    >
      {error && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="username" className="text-xs font-medium text-zinc-400">
            Username
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-zinc-500 select-none">
              @
            </span>
            <input
              id="username"
              type="text"
              autoComplete="username"
              required
              placeholder="seunome"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value.replace(/\s/g, ''))
                if (suggestions.length > 0) setSuggestions([])
              }}
              className="input-base pl-8"
            />
          </div>

          {/* Username taken — suggestions */}
          {suggestions.length > 0 && (
            <div className="pt-2">
              <p className="mb-2 text-xs text-zinc-400">
                Esse username já existe. Que tal um desses?
              </p>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => { setUsername(s); setSuggestions([]) }}
                    className="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-300 transition-colors hover:border-pink hover:text-pink active:scale-95"
                  >
                    @{s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="email" className="text-xs font-medium text-zinc-400">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            placeholder="seuemail@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-base"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="text-xs font-medium text-zinc-400">
            Senha
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            placeholder="Mínimo 6 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-base"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="confirm" className="text-xs font-medium text-zinc-400">
            Confirmar senha
          </label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            placeholder="Repete a senha"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={`input-base ${
              confirm && confirm !== password
                ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500'
                : ''
            }`}
          />
          {confirm && confirm !== password && (
            <p className="text-xs text-red-400 mt-1">As senhas não batem.</p>
          )}
        </div>

        <button
          type="submit"
          disabled={status === 'loading'}
          className="btn-primary mt-2"
        >
          {status === 'loading' ? 'Criando conta…' : 'Criar conta'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500">
        Já tem conta?{' '}
        <Link href="/login" className="font-medium text-pink hover:text-pink-hover transition-colors">
          Entrar
        </Link>
      </p>
    </AuthCard>
  )
}
