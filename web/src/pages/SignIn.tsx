import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { Redirect } from '../components/Redirect'
import { useState, type FormEvent } from 'react'
import { AuthFrame } from '../components/AuthFrame'
import { GoogleButton } from '../components/GoogleButton'
import { Button, Notice, TextField } from '../components/ui'
import { useAuth } from '../lib/auth'
import { detectUserCurrency } from '../lib/currency'
import { friendlyError } from '../lib/errors'
import { readPendingJoin } from '../lib/invite'
import { supabase } from '../lib/supabase'

type Mode = 'sign-in' | 'sign-up'

export function SignInPage() {
  const { session, loading } = useAuth()
  const search = useSearch({ strict: false }) as { redirect?: string; mode?: string }
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>(search.mode === 'sign-up' ? 'sign-up' : 'sign-in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState<'form' | 'link' | 'google' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const pending = readPendingJoin()

  // Only same-site paths are allowed as a destination after sign-in.
  const next = search.redirect && search.redirect.startsWith('/') && !search.redirect.startsWith('//') ? search.redirect : '/'

  if (!loading && session) return pending ? <Redirect to="/join/$code" params={{ code: pending }} /> : <Redirect href={next} />

  const goNext = () =>
    pending ? navigate({ to: '/join/$code', params: { code: pending }, replace: true }) : navigate({ href: next, replace: true })

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    if (mode === 'sign-up' && password.length < 8) return setError('Use a longer password: at least 8 characters.')
    setBusy('form')
    try {
      if (mode === 'sign-up') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name.trim(), currency: detectUserCurrency() },
            emailRedirectTo: `${window.location.origin}/welcome`,
          },
        })
        if (error) throw error
        if (data.session) goNext()
        else setInfo(`Check your inbox: we sent a link to ${email} to confirm your account.`)
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        goNext()
      }
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(null)
    }
  }

  async function emailLink() {
    setError(null)
    setInfo(null)
    if (!email) return setError('Enter your email first.')
    setBusy('link')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}${next}`, data: { currency: detectUserCurrency() } },
    })
    setBusy(null)
    if (error) setError(friendlyError(error))
    else setInfo(`Check your inbox: we sent a sign-in link to ${email}.`)
  }

  async function googleToken(token: string, nonce: string) {
    setError(null)
    setInfo(null)
    setBusy('google')
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token, nonce })
    if (error) {
      setBusy(null)
      setError(friendlyError(error))
    } else goNext()
  }

  async function google() {
    setError(null)
    setBusy('google')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${next}` },
    })
    if (error) {
      setBusy(null)
      setError(friendlyError(error))
    }
  }

  const signUp = mode === 'sign-up'

  return (
    <AuthFrame
      title={signUp ? 'Create your account' : 'Welcome back'}
      lead={signUp ? 'Make a wishlist and share it with the people who buy you gifts.' : 'Sign in to see your lists and Circles.'}
    >
      {pending && (
        <div className="mb-4">
          <Notice>You’re joining a Circle with code {pending}. Sign in or create an account to finish.</Notice>
        </div>
      )}

      <GoogleButton busy={busy === 'google'} onToken={googleToken} onFallback={google} />

      <div className="my-5 flex items-center gap-3 text-small text-plum-soft" aria-hidden="true">
        <span className="h-px flex-1 bg-blush-deep" />
        or with email
        <span className="h-px flex-1 bg-blush-deep" />
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {signUp && (
          <TextField label="Your name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
        )}
        <TextField label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <TextField
          label="Password"
          type="password"
          autoComplete={signUp ? 'new-password' : 'current-password'}
          hint={signUp ? 'At least 8 characters.' : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <Notice tone="alert">{error}</Notice>}
        {info && <Notice>{info}</Notice>}
        <Button type="submit" className="w-full" busy={busy === 'form'}>
          {signUp ? 'Create account' : 'Sign in'}
        </Button>
      </form>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <Button variant="text" busy={busy === 'link'} onClick={emailLink}>
          Email me a sign-in link
        </Button>
        {!signUp && (
          <Link to="/reset-password" className="px-1 py-1.5 text-small text-plum-soft underline underline-offset-3 hover:text-plum">
            Forgot password?
          </Link>
        )}
      </div>

      <p className="mt-5 border-t border-blush pt-4 text-small text-plum-soft">
        {signUp ? 'Already have an account?' : 'New to GiftHub?'}{' '}
        <button
          type="button"
          className="font-semibold text-plum underline underline-offset-3"
          onClick={() => {
            setMode(signUp ? 'sign-in' : 'sign-up')
            setError(null)
            setInfo(null)
          }}
        >
          {signUp ? 'Sign in' : 'Create an account'}
        </button>
      </p>
      <p className="mt-4 text-small text-plum-soft">
        By continuing, you agree to the{' '}
        <Link to="/terms" className="underline underline-offset-3 hover:text-plum">
          Terms
        </Link>{' '}
        and{' '}
        <Link to="/privacy" className="underline underline-offset-3 hover:text-plum">
          Privacy Policy
        </Link>
        .
      </p>
    </AuthFrame>
  )
}
