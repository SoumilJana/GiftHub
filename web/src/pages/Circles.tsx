import { Link, useNavigate } from '@tanstack/react-router'
import { EmptyState, Page } from '../components/Page'
import { LockIcon, Notice, Spinner } from '../components/ui'
import { friendlyError } from '../lib/errors'
import { roleLabel, useMyCircles } from '../lib/queries'
import { StartCircle } from './Welcome'


export function CirclesPage() {
  const circles = useMyCircles()
  const navigate = useNavigate()

  return (
    <Page title="Circles" lead="Private groups where you see each other’s lists.">
      <div className="mt-5">
        <Notice>
          <LockIcon />
          Each Circle is private. Members only see the Circles they share with you, never your other ones.
        </Notice>
      </div>

      {circles.isPending ? (
        <Spinner />
      ) : circles.error ? (
        <div className="mt-6">
          <Notice tone="alert">{friendlyError(circles.error)}</Notice>
        </div>
      ) : circles.data.length === 0 ? (
        <EmptyState title="You’re not in a Circle yet.">Start one below, or join with a code someone sent you.</EmptyState>
      ) : (
        <ul className="mt-6 max-w-[900px] rounded-panel bg-print px-5">
          {circles.data.map((c) => (
            <li key={c.id} className="border-b border-blush last:border-b-0">
              <Link
                to="/circles/$circleId"
                params={{ circleId: c.id }}
                className="flex items-center justify-between gap-4 py-4 hover:text-plum-hover"
              >
                <span className="min-w-0">
                  <span className="block truncate font-extrabold">{c.name}</span>
                  <span className="text-small text-plum-soft">
                    {c.memberCount} {c.memberCount === 1 ? 'member' : 'members'}, {c.role === 'member' ? 'you’re a member' : `you’re the ${roleLabel[c.role].toLowerCase()}`}
                  </span>
                </span>
                <span aria-hidden="true" className="text-plum-soft">
                  <svg width="18" height="18" viewBox="0 0 16 16">
                    <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <StartCircle compact onDone={(id) => navigate({ to: '/circles/$circleId', params: { circleId: id } })} />
    </Page>
  )
}
