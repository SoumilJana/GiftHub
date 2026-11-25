import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect, useState, type MouseEvent, type ReactNode } from 'react'
import { useUserId } from '../lib/auth'
import { currentCircle, readLastCircle } from '../lib/circleTab'
import { circleTitle, useMyCircles, useProfile } from '../lib/queries'
import { CircleSwitcher } from './CircleSwitcher'
import { GiftMark } from './GiftMark'
import { EditItemSheet } from './ItemSheet'
import { CirclesIcon, ListIcon, PlusIcon, ReceivedIcon } from './NavIcons'
import { addPointerPending, clearAddPointer } from '../lib/news'
import { SlidingPill } from './SlidingPill'
import { WhatsNew } from './WhatsNew'
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
  const navigate = useNavigate()
  const [nudge, setNudge] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addNudge, setAddNudge] = useState(false)
  // New people, right after Welcome: one pointer at the + (set in Welcome).
  const [pointer, setPointer] = useState(addPointerPending)
  function hidePointer() {
    clearAddPointer()
    setPointer(false)
  }
  function openAdd() {
    if (pointer) hidePointer()
    setAdding(true)
  }

  // Desktop: N opens Add a wish, unless you're typing or a sheet is already open.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== 'n' || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return
      const t = e.target as HTMLElement | null
      if (t?.closest('input, textarea, select, [contenteditable="true"]') || document.querySelector('dialog[open]')) return
      e.preventDefault()
      setAdding(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Phone Circles tab: straight into the Circle shown at the top right (your only one, if you have one).
  // The page with all of them stays one tap away in the switcher ("Start or join a Circle").
  function openCirclesTab(e: MouseEvent) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const id = currentCircle(circles.data ?? [], readLastCircle())?.id
    if (!id) return
    e.preventDefault()
    if (path !== `/circles/${id}`) navigate({ to: '/circles/$circleId', params: { circleId: id } })
  }

  return (
    <div className="min-h-dvh shell:grid shell:grid-cols-[240px_1fr]">
      <aside
        aria-label="Main"
        className="sticky top-0 hidden h-dvh flex-col gap-6 overflow-y-auto rounded-r-sheet bg-print px-3.5 py-[22px] shell:flex"
      >
        <Wordmark />
        <button type="button" onClick={openAdd} aria-haspopup="dialog" aria-keyshortcuts="N" title="Add a wish (N)" className={`${railAdd} ${addNudge ? 'tab-nudge' : ''}`}>
          <PlusIcon size={20} />
          Add a wish
        </button>
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
        {/* Capped so wide monitors keep the tools next to the wishes they act on. */}
        <div className="mx-auto w-full max-w-[1320px]">
          <Outlet />
        </div>
      </main>

      <nav
        aria-label="Sections"
        className="fixed inset-x-0 bottom-0 z-10 flex rounded-t-sheet bg-print px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_3px_rgba(59,29,63,0.06)] shell:hidden"
      >
        <SlidingPill active={ACTIVE} target=".nav-icon" watch={path} />
        {[...sections, { to: '/profile' as const, label: 'Profile', icon: <ProfileFace name={name} /> }].map((s, i) => [
          // The + sits in the middle: My list, Circles, +, Received, Profile.
          i === 2 && (
            <div key="add" className="flex flex-1 items-start justify-center">
              <button type="button" onClick={openAdd} aria-label="Add a wish" aria-haspopup="dialog" data-add-wish className={`${bottomAdd} ${addNudge ? 'tab-nudge' : ''}`}>
                <PlusIcon />
              </button>
            </div>
          ),
          <Link key={s.to} to={s.to} activeOptions={{ exact: s.to === '/' }} className={bottomLink} onClick={s.to === '/circles' ? openCirclesTab : undefined}>
            <span
              className={`${s.to === '/profile' ? 'nav-icon w-[30px]!' : 'nav-icon'} ${s.to === '/circles' && nudge ? 'tab-nudge' : ''}`}
              data-fly-target={s.to === '/received' ? 'received' : undefined}
            >
              {s.icon}
            </span>
            {s.label}
          </Link>
        ])}
      </nav>

      {adding && (
        <EditItemSheet item={null} circles={circles.data ?? []} userCurrency={profile.data?.currency?.trim() || 'USD'} onClose={() => setAdding(false)} />
      )}

      <WhatsNew
        onClose={(shown) => {
          // Point at what changed: the Circles tab and/or the + give one pulse.
          if (shown.some((n) => n.stage === 'circle-tab')) setNudge(true)
          if (shown.some((n) => n.stage === 'add-button')) setAddNudge(true)
          setTimeout(() => {
            setNudge(false)
            setAddNudge(false)
          }, 1400)
        }}
      />

      {pointer && !adding && (
        <div
          role="status"
          className="fixed bottom-[calc(84px+env(safe-area-inset-bottom))] left-1/2 z-20 w-max max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-panel bg-plum px-4 py-3 text-small text-white shadow-[0_4px_14px_rgba(59,29,63,0.3)] shell:top-[76px] shell:bottom-auto shell:left-[254px] shell:translate-x-0"
        >
          <span aria-hidden="true" className="absolute -bottom-1.5 left-1/2 size-3 -translate-x-1/2 rotate-45 bg-plum shell:top-4 shell:bottom-auto shell:-left-1.5 shell:translate-x-0" />
          <span className="relative">
            <strong className="font-extrabold">Add wishes from here.</strong> Paste a link from any store.{' '}
            <button type="button" onClick={hidePointer} className="font-semibold underline underline-offset-3">
              Got it
            </button>
          </span>
        </div>
      )}
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

// Sidebar: the main action, above the sections.
const railAdd =
  'flex items-center justify-center gap-2 rounded-full bg-plum px-4 py-[11px] font-extrabold text-white shadow-[0_2px_6px_rgba(59,29,63,0.18)] transition-transform duration-150 hover:bg-plum-hover active:scale-[0.97]'
// Phone bar: a raised plum circle, so it reads as an action and not a fifth page.
const bottomAdd =
  '-mt-3 grid size-14 place-items-center rounded-full bg-plum text-white shadow-[0_3px_10px_rgba(59,29,63,0.28),0_0_0_4px_var(--color-print)] transition-transform duration-150 active:scale-[0.94] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-plum'

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
