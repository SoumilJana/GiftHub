import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { AuthFrame } from '../components/AuthFrame'
import { LockIcon, Notice, Spinner } from '../components/ui'
import { useAuth } from '../lib/auth'
import { friendlyError } from '../lib/errors'
import { inviterFromSearch, markIntroSeen } from '../lib/intro'
import { clearPendingJoin, normalizeInviteCode, savePendingJoin } from '../lib/invite'
import { useJoinCircle } from '../lib/queries'
import { useToast } from '../lib/toast'

/** /join/$code: joins straight away when signed in; otherwise remembers the code through sign-in. */
export function JoinPage() {
  const { code: raw } = useParams({ strict: false }) as { code?: string }
  const code = normalizeInviteCode(raw ?? '')
  const from = inviterFromSearch((useSearch({ strict: false }) as { from?: unknown }).from)
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
    // An invite is its own introduction, so the general intro cards are skipped.
    markIntroSeen()
    return (
      <AuthFrame
        title={from ? `${from} invited you to GiftHub` : 'You’re invited to GiftHub'}
        lead="A private wishlist for the people who buy each other gifts."
      >
        <ul className="flex flex-col gap-3">
          <li>
            <strong className="font-extrabold">See {from ? `${from}’s` : 'their'} wishes</strong>, and add your own from any store.
          </li>
          <li>
            <strong className="font-extrabold">Reserve or buy a gift</strong> so no one else gets the same thing.
          </li>
        </ul>
        <div className="mt-4">
          <Notice>
            <LockIcon />
            Gifts stay a surprise: {from ?? 'they'} won’t see what you reserve or buy.
          </Notice>
        </div>
        <Link
          to="/sign-in"
          search={{ mode: 'sign-up' }}
          className="mt-5 flex h-[46px] w-full items-center justify-center rounded-full bg-plum font-semibold text-white hover:bg-plum-hover"
        >
          Create an account to join
        </Link>
        <p className="mt-4 text-center text-small text-plum-soft">
          Already on GiftHub?{' '}
          <Link to="/sign-in" className="font-semibold text-plum underline underline-offset-3">
            Sign in
          </Link>{' '}
          and you’ll join straight away.
        </p>
      </AuthFrame>
    )
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
