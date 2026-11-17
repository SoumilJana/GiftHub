/** Turns Supabase/Postgres errors into plain sentences that say what to do next. */
export function friendlyError(error: unknown): string {
  const message = (error as { message?: string } | null)?.message ?? ''
  const m = message.toLowerCase()

  if (m.includes('invalid login credentials')) return 'That email and password don’t match. Try again, or reset your password.'
  if (m.includes('user already registered') || m.includes('already been registered'))
    return 'There’s already an account with this email. Sign in instead.'
  if (m.includes('email not confirmed')) return 'Confirm your email first: open the link we sent you, then sign in.'
  if (m.includes('password should be') || m.includes('weak password')) return 'Use a longer password: at least 8 characters.'
  if (m.includes('rate limit') || m.includes('too many requests') || m.includes('security purposes'))
    return 'Too many attempts just now. Wait a minute, then try again.'
  if (m.includes('unable to validate email') || m.includes('invalid email')) return 'Check the email address and try again.'
  if (m.includes('provider is not enabled')) return 'Google sign-in isn’t set up yet. Use email for now.'
  if (m.includes('failed to fetch') || m.includes('network')) return 'Can’t reach GiftHub. Check your connection and try again.'

  // Messages raised by our own database functions are already written for people.
  if (message && /[.!]$/.test(message) && !m.includes('violates') && !m.includes('syntax')) return message

  return 'Something went wrong. Try again in a moment.'
}
