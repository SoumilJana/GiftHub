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
    <div className="min-h-dvh shell:grid shell:grid-cols-[248px_1fr]">
      <aside
        aria-label="Main"
        className="sticky top-0 hidden h-dvh flex-col gap-7 border-r border-hairline px-4 py-[22px] shell:flex"
      >
        <Wordmark />
        <nav aria-label="Sections" className="flex flex-col">
          {sections.map((s) => (
            <Link
              key={s.to}
              to={s.to}
              activeOptions={{ exact: true }}
              className="rounded-control p-2 font-medium hover:bg-quiet data-[status=active]:bg-surface data-[status=active]:shadow-[inset_0_0_0_1px_var(--color-hairline)]"
            >
              {s.label}
            </Link>
          ))}
        </nav>
      </aside>

      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-hairline bg-tissue px-4 py-3.5 shell:hidden">
        <Wordmark small />
      </header>

      <main className="min-w-0 px-4 pt-5 pb-28 shell:px-[clamp(16px,3.4vw,44px)] shell:pt-7">
        <Outlet />
      </main>

      <nav
        aria-label="Sections"
        className="fixed inset-x-0 bottom-0 z-10 flex border-t border-hairline bg-surface pb-[env(safe-area-inset-bottom)] shell:hidden"
      >
        {sections.map((s) => (
          <Link
            key={s.to}
            to={s.to}
            activeOptions={{ exact: true }}
            className="flex-1 py-3 text-center text-xs font-semibold text-muted data-[status=active]:text-ink"
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
      className={`flex items-center gap-2.5 font-extrabold tracking-[-0.02em] ${small ? 'text-[17px]' : 'px-2 text-[19px]'}`}
    >
      <GiftMark size={small ? 22 : 26} />
      GiftHub
    </Link>
  )
}
