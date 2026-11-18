import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { Redirect } from '../components/Redirect'
import { useEffect, useRef, useState } from 'react'
import { AuthFrame } from '../components/AuthFrame'
import { Spinner } from '../components/ui'
import { useAuth } from '../lib/auth'
import { friendlyError } from '../lib/errors'
import { clearPendingJoin, normalizeInviteCode, savePendingJoin } from '../lib/invite'
import { useJoinCircle } from '../lib/queries'
import { useToast } from '../lib/toast'

/** /join/$code: joins straight away when signed in; otherwise remembers the code through sign-in. */
export function JoinPage() {
  const { code: raw } = useParams({ strict: false }) as { code?: string }
  const code = normalizeInviteCode(raw ?? '')
  const { session, loading } = useAuth()
  const join = useJoinCircle()
  const navigate = useNavigate()
  const toast = useToast()
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (loading || !session || !code || started.current) return
    started.current = true
    join
      .mutateAsync(code)
      .then((circle) => {
        clearPendingJoin()
        if (!circle) {
          setError('That code doesn’t match an open Circle. Check it with the person who sent it.')
          return
        }
        toast(circle.name ? `You joined ${circle.name}.` : 'You joined their couple Circle.')
        navigate({ to: '/circles/$circleId', params: { circleId: circle.id }, replace: true })
      })
      .catch((err) => {
        clearPendingJoin()
        setError(friendlyError(err))
      })
  }, [loading, session, code, join, navigate, toast])

  if (!code) {
    return (
      <AuthFrame title="That link doesn’t work" lead="The invite code in this link isn’t valid.">
        <p className="text-plum-soft">Ask the person who invited you to send the link again, or type their code on the Circles page.</p>
        <Link to="/circles" className="mt-4 inline-block font-semibold text-plum underline underline-offset-3">
          Go to Circles
        </Link>
      </AuthFrame>
    )
  }

  if (!loading && !session) {
    savePendingJoin(code)
    return <Redirect to="/sign-in" search={{ mode: 'sign-up' }} />
  }

  if (error) {
    return (
      <AuthFrame title="Couldn’t join" lead={error}>
        <Link to="/circles" className="font-semibold text-plum underline underline-offset-3">
          Go to Circles
        </Link>
      </AuthFrame>
    )
  }

  return (
    <AuthFrame title="Joining your Circle">
      <Spinner label={`Joining with code ${code}`} />
    </AuthFrame>
  )
}
