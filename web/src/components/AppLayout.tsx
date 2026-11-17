import { useLocation } from '@tanstack/react-router'
import { Redirect } from './Redirect'
import { useAuth } from '../lib/auth'
import { readPendingJoin } from '../lib/invite'
import { useProfile } from '../lib/queries'
import { AppShell } from './AppShell'
import { Spinner } from './ui'

/** Signed-in area: sends signed-out people to sign-in, new people to Welcome, and finishes a pending join. */
export function AppLayout() {
  const { session, loading } = useAuth()
  const location = useLocation()
  const profile = useProfile()

  if (loading) return <Spinner />
  if (!session) return <Redirect to="/sign-in" search={{ redirect: location.href }} />

  const pending = readPendingJoin()
  if (pending && profile.data?.display_name) return <Redirect to="/join/$code" params={{ code: pending }} />

  if (profile.data && !profile.data.display_name && location.pathname !== '/welcome') return <Redirect to="/welcome" />

  return <AppShell />
}
