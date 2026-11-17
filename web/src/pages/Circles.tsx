import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { EmptyState, Page } from '../components/Page'
import { Avatar, LockIcon, Notice, Spinner } from '../components/ui'
import { useUserId } from '../lib/auth'
import { friendlyError } from '../lib/errors'
import { roleLabel, useMyCircles, type MyCircle } from '../lib/queries'
import { StartCircle } from './Welcome'

const MAX_FACES = 4

/** "Maya", "Maya and Sam", "Maya, Sam and Priya", "Maya, Sam and 3 others". */
function withNames(names: string[]) {
  const first = names.map((n) => n.split(/\s+/)[0] || n)
  if (first.length <= 2) return first.join(' and ')
  if (first.length === 3) return `${first[0]}, ${first[1]} and ${first[2]}`
  return `${first[0]}, ${first[1]} and ${first.length - 2} others`
}

function CircleCard({ circle, uid, featured }: { circle: MyCircle; uid: string | undefined; featured: boolean }) {
  const others = circle.members.filter((m) => m.user_id !== uid)
  const faces = others.slice(0, MAX_FACES)
  const extra = others.length - faces.length
  const role = circle.role === 'member' ? null : roleLabel[circle.role]

  const size = featured ? 40 : 34

  return (
    <li>
      <Link
        to="/circles/$circleId"
        params={{ circleId: circle.id }}
        className="group flex h-full flex-col rounded-panel bg-print p-5 transition-shadow hover:shadow-[inset_0_0_0_1.5px_var(--color-edge)]"
      >
        <span className="flex items-center gap-3">
          <span className="min-w-0 flex-1 font-extrabold break-words">{circle.name}</span>
          {role && <span className="shrink-0 rounded-full bg-blush px-2.5 py-0.5 text-small text-plum-soft">{role}</span>}
          <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true" className="shrink-0 text-plum-soft transition-transform group-hover:translate-x-0.5 group-hover:text-plum">
            <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>

        {faces.length > 0 && (
          <span className="mt-4 flex -space-x-2">
            {faces.map((m) => (
              <span key={m.user_id} className="flex rounded-full ring-2 ring-print">
                <Avatar name={m.display_name} size={size} />
              </span>
            ))}
            {extra > 0 && (
              <span
                aria-hidden="true"
                style={{ width: size, height: size }}
                className="inline-grid place-items-center rounded-full bg-blush text-small font-extrabold text-plum-soft ring-2 ring-print"
              >
                +{extra}
              </span>
            )}
          </span>
        )}

        <span className={`text-plum-soft ${faces.length ? 'mt-3' : 'mt-1.5'}`}>
          {others.length ? `With ${withNames(others.map((m) => m.display_name))}` : 'Just you so far. Open it to invite someone.'}
        </span>
      </Link>
    </li>
  )
}

export function CirclesPage() {
  const circles = useMyCircles()
  const uid = useUserId()
  const navigate = useNavigate()
  const [adding, setAdding] = useState<'create' | 'join' | null>(null)
  const openCircle = (id: string) => navigate({ to: '/circles/$circleId', params: { circleId: id } })

  const privacy = (
    <Notice>
      <LockIcon />
      Each Circle is private. Members only see the Circles they share with you, never your other ones.
    </Notice>
  )

  if (circles.isPending) return <Spinner />
  if (circles.error) return <Notice tone="alert">{friendlyError(circles.error)}</Notice>

  const list = circles.data

  if (list.length === 0) {
    return (
      <Page title="Circles" lead="Private groups where you see each other’s lists.">
        <div className="mt-5">{privacy}</div>
        <EmptyState title="You’re not in a Circle yet.">Start one below, or join with a code someone sent you.</EmptyState>
        <StartCircle compact onDone={openCircle} />
      </Page>
    )
  }

  const single = list.length === 1

  return (
    <Page
      title={single ? 'Your Circle' : 'Your Circles'}
      lead={single ? 'The people whose lists you can see.' : `You’re in ${list.length} Circles. Pick one to see everyone’s lists.`}
    >
      <ul className={`mt-6 grid max-w-[900px] gap-4 ${single ? '' : 'sm:grid-cols-2'}`}>
        {list.map((c) => (
          <CircleCard key={c.id} circle={c} uid={uid} featured={single} />
        ))}
      </ul>

      <section aria-labelledby="add-circle" className="mt-10 max-w-[900px] border-t border-edge pt-6">
        <h2 id="add-circle" className="font-extrabold">
          Add another Circle
        </h2>
        <p className="mt-1 text-small text-plum-soft">Each Circle is private. People in one never learn about your others.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(['create', 'join'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-expanded={adding === mode}
              aria-controls="add-circle-form"
              onClick={() => setAdding((a) => (a === mode ? null : mode))}
              className="h-[34px] rounded-full px-[13px] text-small font-semibold text-plum shadow-[inset_0_0_0_1.5px_var(--color-edge)] hover:shadow-[inset_0_0_0_1.5px_var(--color-plum-soft)] aria-expanded:bg-print aria-expanded:shadow-[inset_0_0_0_1.5px_var(--color-plum)]"
            >
              {mode === 'create' ? 'Start a new Circle' : 'Join with a code'}
            </button>
          ))}
        </div>
        <div id="add-circle-form">{adding && <StartCircle key={adding} compact only={adding} onDone={openCircle} />}</div>
      </section>
    </Page>
  )
}
