import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useUserId } from '../lib/auth'
import { circleTitle, useMyCircles, type MyCircle } from '../lib/queries'
import { Sheet } from './ItemSheet'
import { Avatar } from './ui'

const LAST_KEY = 'gifthub.lastCircle'

function readLast() {
  try {
    return localStorage.getItem(LAST_KEY)
  } catch {
    return null
  }
}

/** First names: "Maya", "Maya and Sam", "Maya, Sam and 3 others". */
function withNames(names: string[]) {
  const first = names.map((n) => n.trim().split(/\s+/)[0] || n)
  if (first.length <= 2) return first.join(' and ')
  return `${first[0]}, ${first[1]} and ${first.length - 2} other${first.length === 3 ? '' : 's'}`
}

/** The faces for a Circle: both partners in a couple Circle (or one other person, when `othersOnly`), else up to two other people. */
function Faces({ circle, uid, size, othersOnly = false }: { circle: MyCircle; uid?: string; size: number; othersOnly?: boolean }) {
  const others = circle.members.filter((m) => m.user_id !== uid)
  const me = circle.members.find((m) => m.user_id === uid)
  const faces = othersOnly ? others.slice(0, 1) : circle.kind === 'couple' ? [...(me ? [me] : []), ...others] : others.slice(0, 2)
  if (!faces.length) return null
  return (
    <span className="flex shrink-0 -space-x-1.5" aria-hidden="true">
      {faces.map((m) => (
        <span key={m.user_id} className="flex rounded-full ring-2 ring-print">
          <Avatar name={m.display_name} size={size} />
        </span>
      ))}
    </span>
  )
}

/**
 * Phone top bar: the Circle you're in (or opened last on this device), one tap from
 * switching to another. It only ever lists your own Circles, to you.
 */
export function CircleSwitcher() {
  const circles = useMyCircles()
  const uid = useUserId()
  const navigate = useNavigate()
  const path = useRouterState({ select: (s) => s.location.pathname })
  const [open, setOpen] = useState(false)
  const here = /^\/circles\/([^/]+)/.exec(path)?.[1]

  useEffect(() => {
    if (!here) return
    try {
      localStorage.setItem(LAST_KEY, here)
    } catch {
      /* private mode: not remembered */
    }
  }, [here])

  const list = circles.data ?? []
  if (circles.isPending) return <span className="h-[38px]" />
  if (!list.length) {
    return (
      <Link to="/circles" className={pill}>
        Start a Circle
      </Link>
    )
  }

  const last = here ?? readLast()
  const current = list.find((c) => c.id === last) ?? list.find((c) => c.kind === 'couple') ?? list[0]
  const title = circleTitle(current, current.members, uid)

  return (
    <>
      <button type="button" className={pill} aria-haspopup="dialog" onClick={() => setOpen(true)} aria-label={`${title}. Switch Circle`}>
        <Faces circle={current} uid={uid} size={26} othersOnly />
        <span className="min-w-0 truncate">{title}</span>
        <svg width="12" height="12" viewBox="0 0 10 6" aria-hidden="true" className="shrink-0 text-plum-soft">
          <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <Sheet title="Your Circles" onClose={() => setOpen(false)}>
          <ul className="-mx-2 flex flex-col">
            {list.map((c) => {
              const isCurrent = c.id === current.id
              const others = c.members.filter((m) => m.user_id !== uid)
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    aria-current={isCurrent ? 'true' : undefined}
                    onClick={() => {
                      setOpen(false)
                      navigate({ to: '/circles/$circleId', params: { circleId: c.id } })
                    }}
                    className="flex w-full items-center gap-3 rounded-panel px-2 py-2.5 text-left hover:bg-blush aria-[current]:bg-blush"
                  >
                    <span className="grid w-[52px] shrink-0 place-items-center">
                      <Faces circle={c} uid={uid} size={30} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-extrabold">{circleTitle(c, c.members, uid)}</span>
                      <span className="block truncate text-small text-plum-soft">
                        {c.kind === 'couple'
                          ? others.length
                            ? 'Couple Circle'
                            : 'Waiting for your partner'
                          : others.length
                            ? `With ${withNames(others.map((m) => m.display_name))}`
                            : 'Just you so far'}
                      </span>
                    </span>
                    {isCurrent && (
                      <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true" className="shrink-0 text-plum">
                        <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
          <Link
            to="/circles"
            onClick={() => setOpen(false)}
            className="tap mt-3 inline-flex h-[34px] items-center rounded-full px-[13px] text-small font-semibold text-plum shadow-[inset_0_0_0_1.5px_var(--color-edge)] hover:shadow-[inset_0_0_0_1.5px_var(--color-plum-soft)]"
          >
            Start or join a Circle
          </Link>
        </Sheet>
      )}
    </>
  )
}

const pill =
  'flex h-[38px] min-w-0 max-w-[60vw] items-center gap-2 rounded-full bg-print pr-3 pl-1.5 text-small font-semibold text-plum shadow-[inset_0_0_0_1.5px_var(--color-edge)] hover:shadow-[inset_0_0_0_1.5px_var(--color-plum-soft)] [&:not(:has(span))]:pl-3.5'
