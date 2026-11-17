import { Link, Outlet } from '@tanstack/react-router'
import { useMyCircles, useProfile } from '../lib/queries'
import { GiftMark } from './GiftMark'
import { Avatar } from './ui'

const sections = [
  { to: '/', label: 'My list' },
  { to: '/circles', label: 'Circles' },
  { to: '/received', label: 'Received' },
] as const

const phoneSections = [...sections, { to: '/profile', label: 'Profile' }] as const

const railLink =
  'flex items-center justify-between gap-2 rounded-full px-2.5 py-[9px] font-semibold hover:bg-blush data-[status=active]:bg-plum data-[status=active]:text-white'

export function AppShell() {
  const circles = useMyCircles()
  const profile = useProfile()
  const name = profile.data?.display_name ?? ''

  return (
    <div className="min-h-dvh shell:grid shell:grid-cols-[240px_1fr]">
      <aside
        aria-label="Main"
        className="sticky top-0 hidden h-dvh flex-col gap-6 overflow-y-auto rounded-r-sheet bg-print px-3.5 py-[22px] shell:flex"
      >
        <Wordmark />
        <nav aria-label="Sections" className="flex flex-col gap-0.5">
          {sections.map((s) => (
            <Link key={s.to} to={s.to} activeOptions={{ exact: s.to === '/' }} className={railLink}>
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
                <span className="truncate">{c.name}</span>
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

      <header className="flex items-center justify-between px-4 pt-5 shell:hidden">
        <Wordmark small />
        <Link to="/profile" aria-label="Profile">
          <Avatar name={name} size={32} />
        </Link>
      </header>

      <main className="min-w-0 px-4 pt-[18px] pb-28 shell:px-[clamp(16px,3.4vw,44px)] shell:pt-7">
        <Outlet />
      </main>

      <nav
        aria-label="Sections"
        className="fixed inset-x-0 bottom-0 z-10 flex rounded-t-sheet bg-print pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_3px_rgba(59,29,63,0.06)] shell:hidden"
      >
        {phoneSections.map((s) => (
          <Link
            key={s.to}
            to={s.to}
            activeOptions={{ exact: s.to === '/' }}
            className="flex-1 pt-3.5 pb-4 text-center text-small font-semibold text-plum-soft data-[status=active]:font-extrabold data-[status=active]:text-plum"
          >
            {s.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}

function Wordmark({ small = false }: { small?: boolean }) {
  return (
    <Link to="/" className={`flex items-center gap-2.5 font-extrabold leading-none tracking-[-0.03em] ${small ? 'text-[26px]' : 'px-2 text-[28px]'}`}>
      <GiftMark size={small ? 32 : 34} />
      GiftHub
    </Link>
  )
}
