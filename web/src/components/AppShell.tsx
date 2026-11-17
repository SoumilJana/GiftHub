import { Link, Outlet } from '@tanstack/react-router'
import { GiftMark } from './GiftMark'
import { UpdatePrompt } from './UpdatePrompt'

const sections = [
  { to: '/', label: 'My list' },
  { to: '/circles', label: 'Circles' },
  { to: '/activity', label: 'Activity' },
  { to: '/received', label: 'Received' },
] as const

export function AppShell() {
  return (
    <div className="min-h-dvh shell:grid shell:grid-cols-[240px_1fr]">
      <aside
        aria-label="Main"
        className="sticky top-0 hidden h-dvh flex-col gap-6 rounded-r-sheet bg-print px-3.5 py-[22px] shell:flex"
      >
        <Wordmark />
        <nav aria-label="Sections" className="flex flex-col gap-0.5">
          {sections.map((s) => (
            <Link
              key={s.to}
              to={s.to}
              activeOptions={{ exact: true }}
              className="rounded-full px-2.5 py-[9px] font-semibold hover:bg-blush data-[status=active]:bg-plum data-[status=active]:text-white"
            >
              {s.label}
            </Link>
          ))}
        </nav>
      </aside>

      <header className="flex items-center justify-between px-4 pt-4 shell:hidden">
        <Wordmark small />
      </header>

      <main className="min-w-0 px-4 pt-[18px] pb-28 shell:px-[clamp(16px,3.4vw,44px)] shell:pt-7">
        <Outlet />
      </main>

      <nav
        aria-label="Sections"
        className="fixed inset-x-0 bottom-0 z-10 flex rounded-t-sheet bg-print pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_3px_rgba(59,29,63,0.06)] shell:hidden"
      >
        {sections.map((s) => (
          <Link
            key={s.to}
            to={s.to}
            activeOptions={{ exact: true }}
            className="flex-1 pt-3.5 pb-4 text-center text-small font-semibold text-plum-soft data-[status=active]:font-extrabold data-[status=active]:text-plum"
          >
            {s.label}
          </Link>
        ))}
      </nav>

      <UpdatePrompt />
    </div>
  )
}

function Wordmark({ small = false }: { small?: boolean }) {
  return (
    <Link
      to="/"
      className={`flex items-center gap-[9px] font-extrabold tracking-[-0.02em] ${small ? 'text-[19px]' : 'px-2 text-xl'}`}
    >
      <GiftMark size={small ? 24 : 26} />
      GiftHub
    </Link>
  )
}
