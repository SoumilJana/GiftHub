import { Link, useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { AuthFrame } from '../components/AuthFrame'
import { Button, Notice, TextField } from '../components/ui'
import { useAuth } from '../lib/auth'
import { friendlyError } from '../lib/errors'
import { supabase } from '../lib/supabase'

export function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    })
    setBusy(false)
    if (error) setError(friendlyError(error))
    else setSent(true)
  }

  return (
    <AuthFrame title="Reset your password" lead="We’ll email you a link to choose a new one.">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <TextField label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        {error && <Notice tone="alert">{error}</Notice>}
        {sent && <Notice>If there’s an account for {email}, a reset link is on its way.</Notice>}
        <Button type="submit" className="w-full" busy={busy}>
          Send reset link
        </Button>
      </form>
      <Link to="/sign-in" className="mt-4 inline-block px-1 py-1.5 text-small text-plum-soft underline underline-offset-3 hover:text-plum">
        Back to sign in
      </Link>
    </AuthFrame>
  )
}

export function UpdatePasswordPage() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) return setError('Use a longer password: at least 8 characters.')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) setError(friendlyError(error))
    else navigate({ to: '/', replace: true })
  }

  if (!loading && !session) {
    return (
      <AuthFrame title="Link expired" lead="This reset link has expired or was already used.">
        <Link to="/reset-password" className="font-semibold text-plum underline underline-offset-3">
          Send a new reset link
        </Link>
      </AuthFrame>
    )
  }

  return (
    <AuthFrame title="Choose a new password">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <Notice tone="alert">{error}</Notice>}
        <Button type="submit" className="w-full" busy={busy}>
          Save password
        </Button>
      </form>
    </AuthFrame>
  )
}
