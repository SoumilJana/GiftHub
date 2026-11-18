import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useUserId } from '../lib/auth'
import { circleTitle, useMyCircles, useProfile } from '../lib/queries'
import { CircleSwitcher } from './CircleSwitcher'
import { GiftMark } from './GiftMark'
import { CirclesIcon, ListIcon, ReceivedIcon } from './NavIcons'
import { SlidingPill } from './SlidingPill'
import { Avatar } from './ui'

const sections: { to: '/' | '/circles' | '/received'; label: string; icon: ReactNode }[] = [
  { to: '/', label: 'My list', icon: <ListIcon /> },
  { to: '/circles', label: 'Circles', icon: <CirclesIcon /> },
  { to: '/received', label: 'Received', icon: <ReceivedIcon /> },
]

const railLink =
  'flex items-center justify-between gap-2 rounded-full px-2.5 py-[9px] font-semibold hover:bg-blush data-[status=active]:bg-plum data-[status=active]:text-white'
// Section links: the plum pill slides behind the current one, so they don't fill themselves.
const railSection =
  'relative flex items-center gap-2.5 rounded-full px-2.5 py-[9px] font-semibold transition-colors duration-200 hover:bg-blush data-[status=active]:text-white data-[status=active]:hover:bg-transparent'
const ACTIVE = '[data-status="active"]'

export function AppShell() {
  const circles = useMyCircles()
  const uid = useUserId()
  const profile = useProfile()
  const name = profile.data?.display_name ?? ''
  const path = useRouterState({ select: (s) => s.location.pathname })

  return (
    <div className="min-h-dvh shell:grid shell:grid-cols-[240px_1fr]">
      <aside
        aria-label="Main"
        className="sticky top-0 hidden h-dvh flex-col gap-6 overflow-y-auto rounded-r-sheet bg-print px-3.5 py-[22px] shell:flex"
      >
        <Wordmark />
        <nav aria-label="Sections" className="relative flex flex-col gap-0.5">
          <SlidingPill active={ACTIVE} watch={path} />
          {sections.map((s) => (
            <Link key={s.to} to={s.to} activeOptions={{ exact: s.to === '/' }} className={railSection}>
              <span className="flex" data-fly-target={s.to === '/received' ? 'received' : undefined}>
                {s.icon}
              </span>
              {s.label}
            </Link>
          ))}
        </nav>
        {!!circles.data?.length && (
          <nav aria-labelledby="rail-circles" className="flex flex-col gap-0.5">
            <h2 id="rail-circles" className="mx-2.5 mb-1.5 text-small font-semibold text-plum-soft">
              Your Circles
            </h2>
            {circles.data.map((c) => (
              <Link key={c.id} to="/circles/$circleId" params={{ circleId: c.id }} className={railLink}>
                <span className="truncate">{circleTitle(c, c.members, uid)}</span>
                <span className="text-small opacity-75">{c.memberCount}</span>
              </Link>
            ))}
          </nav>
        )}
        <Link to="/profile" className={`mt-auto ${railLink} justify-start`}>
          <Avatar name={name} size={28} />
          <span className="truncate">{name || 'Profile'}</span>
        </Link>
      </aside>

      <header className="flex items-center justify-between gap-3 rounded-b-sheet bg-print px-4 pt-[max(12px,env(safe-area-inset-top))] pb-3 shadow-[0_1px_3px_rgba(59,29,63,0.06)] shell:hidden">
        <Wordmark small />
        <CircleSwitcher />
      </header>

      <main className="min-w-0 px-4 pt-7 pb-28 shell:px-[clamp(16px,3.4vw,44px)] shell:pt-7">
        <Outlet />
      </main>

      <nav
        aria-label="Sections"
        className="fixed inset-x-0 bottom-0 z-10 flex rounded-t-sheet bg-print px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_3px_rgba(59,29,63,0.06)] shell:hidden"
      >
        <SlidingPill active={ACTIVE} target=".nav-icon" watch={path} />
        {[...sections, { to: '/profile' as const, label: 'Profile', icon: <ProfileFace name={name} /> }].map((s) => (
          <Link key={s.to} to={s.to} activeOptions={{ exact: s.to === '/' }} className={bottomLink}>
            <span className={s.to === '/profile' ? 'nav-icon w-[30px]!' : 'nav-icon'} data-fly-target={s.to === '/received' ? 'received' : undefined}>
              {s.icon}
            </span>
            {s.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}

/** Your initials. When Profile is current the sliding pill shrinks to a plum ring around them. */
function ProfileFace({ name }: { name: string }) {
  return (
    <span className="flex rounded-full transition-shadow duration-200 group-data-[status=active]:shadow-[0_0_0_2px_var(--color-print)]">
      <Avatar name={name} size={22} />
    </span>
  )
}

const bottomLink =
  'group relative flex flex-1 flex-col items-center gap-0.5 pt-2 pb-2.5 text-[12px] leading-4 font-semibold text-plum-soft transition-colors duration-200 data-[status=active]:text-plum [&_.nav-icon]:grid [&_.nav-icon]:h-[30px] [&_.nav-icon]:w-14 [&_.nav-icon]:place-items-center [&_.nav-icon]:rounded-full [&_.nav-icon]:transition-colors [&_.nav-icon]:duration-200 data-[status=active]:[&_.nav-icon]:text-white'

function Wordmark({ small = false }: { small?: boolean }) {
  return (
    <Link to="/" className={`flex items-center font-extrabold leading-none tracking-[-0.03em] ${small ? 'gap-2 text-[22px]' : 'gap-2.5 px-2 text-[28px]'}`}>
      <GiftMark size={small ? 28 : 34} />
      GiftHub
    </Link>
  )
}
