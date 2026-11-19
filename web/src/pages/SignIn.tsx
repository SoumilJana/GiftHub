import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { Redirect } from '../components/Redirect'
import { useState, type FormEvent } from 'react'
import { AuthFrame } from '../components/AuthFrame'
import { useCaptcha } from '../components/Captcha'
import { GoogleButton } from '../components/GoogleButton'
import { Button, Notice, Spinner, TextField } from '../components/ui'
import { useAuth } from '../lib/auth'
import { detectUserCurrency } from '../lib/currency'
import { friendlyError } from '../lib/errors'
import { introSeen } from '../lib/intro'
import { readPendingJoin } from '../lib/invite'
import { supabase } from '../lib/supabase'

type Mode = 'sign-in' | 'sign-up'

/**
 * Safety net after a successful sign-in: if the page is still on /sign-in a moment
 * later (it once stayed blank there on a phone after Google sign-in), load the
 * destination directly, as a refresh would. A plain timer, so it runs even if the
 * page has stopped rendering.
 */
let leaving = false
function leaveSignIn(target: string) {
  if (leaving) return
  leaving = true
  setTimeout(() => {
    leaving = false
    if (window.location.pathname.startsWith('/sign-in')) window.location.replace(target)
  }, 2500)
}

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
  // After an email goes out, the form gives way to a clear "check your inbox" screen.
  const [sent, setSent] = useState<{ to: string; kind: 'confirm' | 'link' } | null>(null)
  const pending = readPendingJoin()
  const captcha = useCaptcha()

  // Only same-site paths are allowed as a destination after sign-in.
  const next = search.redirect && /^\/(?![/\\])/.test(search.redirect) && !/[\\\s]/.test(search.redirect) ? search.redirect : '/'

  const target = pending ? `/join/${encodeURIComponent(pending)}` : next

  if (!loading && session) {
    leaveSignIn(target)
    return (
      <>
        <Spinner full label="Signing you in" />
        {pending ? <Redirect to="/join/$code" params={{ code: pending }} /> : <Redirect href={next} />}
      </>
    )
  }

  // First visit on this device: the three intro cards come first (an invite link has its own screen).
  if (!loading && !session && !pending && !introSeen()) return <Redirect to="/intro" search={{ redirect: search.redirect }} />

  const goNext = () => {
    if (pending) navigate({ to: '/join/$code', params: { code: pending }, replace: true })
    else navigate({ href: next, replace: true })
    leaveSignIn(target)
  }

  function showSent(to: string, kind: 'confirm' | 'link') {
    setSent({ to, kind })
    window.scrollTo({ top: 0 })
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    if (mode === 'sign-up' && password.length < 8) return setError('Use a longer password: at least 8 characters.')
    setBusy('form')
    try {
      const captchaToken = await captcha.take()
      if (mode === 'sign-up') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            captchaToken,
            data: { full_name: name.trim(), currency: detectUserCurrency() },
            emailRedirectTo: `${window.location.origin}/welcome`,
          },
        })
        if (error) throw error
        if (data.session) goNext()
        else showSent(email, 'confirm')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password, options: { captchaToken } })
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
    try {
      const captchaToken = await captcha.take()
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { captchaToken, emailRedirectTo: `${window.location.origin}${next}`, data: { currency: detectUserCurrency() } },
      })
      if (error) throw error
      showSent(email, 'link')
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(null)
    }
  }

  async function googleToken(token: string, nonce: string) {
    setError(null)
    setInfo(null)
    setBusy('google')
    try {
      const captchaToken = await captcha.take()
      const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token, nonce, options: { captchaToken } })
      if (error) throw error
      goNext()
    } catch (err) {
      setBusy(null)
      setError(friendlyError(err))
    }
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
      title={sent ? 'Check your inbox' : signUp ? 'Create your account' : 'Welcome back'}
      lead={
        sent
          ? sent.kind === 'confirm'
            ? 'One more step to finish your account.'
            : 'Your sign-in link is on its way.'
          : signUp
            ? 'Make a wishlist and share it with the people who buy you gifts.'
            : 'Sign in to see your lists and Circles.'
      }
    >
      {sent && (
        <div role="status" className="flex flex-col items-start gap-4">
          <MailIcon />
          <p>
            We sent {sent.kind === 'confirm' ? 'a link to confirm your account' : 'a sign-in link'} to
            <strong className="my-1 block font-extrabold [overflow-wrap:anywhere]">{sent.to}</strong>
            Open it on this device to {sent.kind === 'confirm' ? 'finish signing up' : 'sign in'}.
          </p>
          <p className="text-small text-plum-soft">It usually arrives within a minute. Not there? Check Spam or Promotions.</p>
          <Button
            variant="ghost"
            onClick={() => {
              setSent(null)
              setInfo(null)
              setError(null)
            }}
          >
            Use a different email
          </Button>
        </div>
      )}
      {/* Hidden, not removed, so the Turnstile check stays ready for another try. */}
      <div hidden={!!sent}>
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
          {signUp && <TextField label="Your name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />}
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
          {captcha.widget}
          {error && <Notice tone="alert">{error}</Notice>}
          {info && <Notice>{info}</Notice>}
          <Button type="submit" className="w-full" busy={busy === 'form'}>
            {busy === 'form' ? (signUp ? 'Creating your account…' : 'Signing in…') : signUp ? 'Create account' : 'Sign in'}
          </Button>
        </form>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <Button variant="text" busy={busy === 'link'} disabled={busy === 'form'} onClick={emailLink}>
            {busy === 'link' ? 'Sending link…' : 'Email me a sign-in link'}
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
      </div>
    </AuthFrame>
  )
}

function MailIcon() {
  return (
    <span className="grid size-12 place-items-center rounded-full bg-blush text-plum" aria-hidden="true">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="14" rx="2.5" />
        <path d="m4 7 8 6 8-6" />
      </svg>
    </span>
  )
}
