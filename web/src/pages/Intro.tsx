import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { GiftMark } from '../components/GiftMark'
import { Hearts, Photo } from '../components/ItemViews'
import { CirclesIcon, ListIcon, ReceivedIcon } from '../components/NavIcons'
import { Avatar, Button } from '../components/ui'
import { useAuth } from '../lib/auth'
import type { Claim } from '../lib/claims'
import { CIRCLE_TAB, markIntroSeen } from '../lib/intro'
import { isCalm } from '../lib/motion'
import type { Item } from '../lib/wishlist'

/** A made-up wish for the intro's pictures: real frames, never real data. */
const sample = (n: number, title: string, priority: number): Item => ({
  id: `intro-${n}`,
  owner_id: 'intro',
  title,
  url: null,
  image_url: null,
  domain: null,
  price: null,
  currency: 'USD',
  original_price: null,
  priority,
  notes: null,
  created_at: new Date().toISOString(),
  occasions: [],
  circle_ids: [],
})

const cards: { stage: 'save' | 'share' | 'tab' | 'surprise'; title: string; body: string }[] = [
  {
    stage: 'save',
    title: 'Save wishes from any store',
    body: 'Paste a link from any shop and GiftHub fills in the photo, name and price. Mark how much you want each one.',
  },
  {
    stage: 'share',
    title: 'Share with your Circle',
    body: 'Start a private Circle with your partner, or with friends and family. You see each other’s lists, and you choose which wishes each Circle sees.',
  },
  {
    stage: 'tab',
    ...CIRCLE_TAB,
  },
  {
    stage: 'surprise',
    title: 'Gifts stay a surprise',
    body: 'When someone reserves or buys from your list, nothing changes on your screen. You find out who gave what when you mark it received.',
  },
]

/** /intro: three cards before sign-up. Swipe, tap Next, or use the arrow keys. */
export function IntroPage() {
  const { session } = useAuth()
  const search = useSearch({ strict: false }) as { redirect?: string }
  const navigate = useNavigate()
  const track = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const last = active === cards.length - 1

  // The card most in view is the current one, however it got there.
  useEffect(() => {
    const el = track.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index))
      },
      { root: el, threshold: 0.6 },
    )
    el.querySelectorAll('[data-index]').forEach((s) => io.observe(s))
    return () => io.disconnect()
  }, [])

  function go(i: number) {
    const el = track.current
    if (!el) return
    const n = Math.max(0, Math.min(cards.length - 1, i))
    el.scrollTo({ left: n * el.clientWidth, behavior: isCalm() ? 'auto' : 'smooth' })
    setActive(n)
  }

  function finish(mode: 'sign-up' | 'sign-in') {
    markIntroSeen()
    if (session) navigate({ to: '/', replace: true })
    else navigate({ to: '/sign-in', search: { redirect: search.redirect, mode: mode === 'sign-up' ? 'sign-up' : undefined }, replace: true })
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-4 pt-6 pb-8">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-3 text-[32px] leading-none font-extrabold tracking-[-0.03em]">
          <GiftMark size={40} />
          GiftHub
        </span>
        <Button
          variant="text"
          className={`transition-opacity duration-150 ${last ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
          tabIndex={last ? -1 : 0}
          aria-hidden={last || undefined}
          onClick={() => finish('sign-up')}
        >
          Skip
        </Button>
      </div>

      <div
        ref={track}
        role="region"
        aria-roledescription="carousel"
        aria-label="What GiftHub does"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') go(active + 1)
          else if (e.key === 'ArrowLeft') go(active - 1)
          else return
          e.preventDefault()
        }}
        className="-mx-4 mt-6 flex flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] focus-visible:outline-offset-[-3px] [&::-webkit-scrollbar]:hidden"
      >
        {cards.map((c, i) => (
          <section
            key={c.title}
            data-index={i}
            data-active={active === i || undefined}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${cards.length}: ${c.title}`}
            aria-hidden={active !== i}
            className="intro-slide flex w-full shrink-0 snap-center snap-always flex-col justify-center px-4"
          >
            <div className="grid h-[300px] place-items-center" aria-hidden="true">
              {c.stage === 'save' ? <SaveStage /> : c.stage === 'share' ? <ShareStage /> : c.stage === 'tab' ? <CircleTabStage on={active === i} /> : <SurpriseStage on={active === i} />}
            </div>
            <h1 className="mt-6 text-display leading-none font-extrabold tracking-[-0.035em] text-balance">{c.title}</h1>
            <p className="mt-3 text-plum-soft">{c.body}</p>
          </section>
        ))}
      </div>

      <div className="mt-6 flex justify-center">
        <div className="flex gap-1" role="group" aria-label="Cards">
          {cards.map((c, i) => (
            <button
              key={c.title}
              type="button"
              aria-label={`Card ${i + 1}: ${c.title}`}
              aria-current={active === i || undefined}
              onClick={() => go(i)}
              className="tap grid h-6 place-items-center px-1"
            >
              <span className={`block h-2 rounded-full transition-[width,background-color] duration-300 ${active === i ? 'w-6 bg-plum' : 'w-2 bg-plum-soft/40'}`} />
            </button>
          ))}
        </div>
      </div>

      {/* One button that stays put: "Next" crossfades into the last card's action, so nothing jumps. */}
      <div className="mt-4 flex flex-col gap-2">
        <Button className="h-[46px]! w-full" onClick={() => (last ? finish('sign-up') : go(active + 1))}>
          <span className="grid">
            <span className={`col-start-1 row-start-1 transition-opacity duration-150 ${last ? 'opacity-0' : 'opacity-100'}`} aria-hidden={last}>
              Next
            </span>
            <span className={`col-start-1 row-start-1 transition-opacity duration-150 ${last ? 'opacity-100' : 'opacity-0'}`} aria-hidden={!last}>
              {session ? 'Done' : 'Create an account'}
            </span>
          </span>
        </Button>
        {!session && (
          <Button
            variant="text"
            className={`self-center transition-opacity duration-150 ${last ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
            tabIndex={last ? 0 : -1}
            aria-hidden={!last || undefined}
            onClick={() => finish('sign-in')}
          >
            I already have an account
          </Button>
        )}
      </div>

      <p className="mt-4 text-center text-small text-plum-soft">
        <Link to="/help" className="underline underline-offset-3 hover:text-plum">
          Help
        </Link>
      </p>
    </div>
  )
}

function Print({ item, claim, children, className = '' }: { item: Item; claim?: Claim | null; children?: ReactNode; className?: string }) {
  return (
    <div className={`w-[150px] rounded-print bg-print px-[7px] pt-[7px] pb-3 shadow-[0_2px_6px_rgba(59,29,63,.12)] ${className}`}>
      <Photo item={item} claim={claim} />
      <div className="flex flex-col gap-1 px-[3px] pt-2.5">{children}</div>
    </div>
  )
}

/** Card 1: a link goes in, a print slides out of the booth. */
function SaveStage() {
  const lamp = sample(1, 'Marble table lamp', 10)
  return (
    <div className="flex w-full max-w-[300px] flex-col items-center">
      <div className="flex h-[46px] w-full items-center gap-2 rounded-full bg-print pr-1.5 pl-[18px] shadow-[inset_0_0_0_1.5px_var(--color-edge)]">
        <span className="min-w-0 flex-1 truncate text-plum-soft">shop.example/marble-lamp</span>
        <span className="grid h-[34px] place-items-center rounded-full bg-plum px-3.5 text-small font-semibold text-white">Add</span>
      </div>
      <div className="mt-5 h-1.5 w-[190px] rounded-full bg-plum" />
      <div className="-mt-0.5 overflow-hidden px-3 pb-3">
        <Print item={lamp} className="print-out">
          <span className="text-small text-plum-soft">shop.example</span>
          <span className="leading-tight font-semibold">{lamp.title}</span>
          <Hearts priority={lamp.priority} className="mt-0.5 h-[1.25em]" />
        </Print>
      </div>
    </div>
  )
}

/** Card 2: two people, their prints dealt between them. */
function ShareStage() {
  const prints = [sample(2, 'Film camera', 9), sample(3, 'Wool scarf', 6), sample(4, 'Cookbook', 4)]
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-3">
        <Person name="You" />
        <span className="h-0.5 w-10 rounded-full bg-edge" />
        <Person name="Maya" />
      </div>
      <div className="relative mt-6 h-[170px] w-[280px]">
        {prints.map((p, i) => (
          <div key={p.id} className="deal absolute top-0 left-1/2" style={{ ['--i' as string]: i - 1 }}>
            <div className="w-[104px] rounded-print bg-print p-1.5 pb-3 shadow-[0_2px_6px_rgba(59,29,63,.12)]">
              <Photo item={p} />
              <span className="mt-2 block truncate px-0.5 text-small font-semibold">{p.title}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Person({ name }: { name: string }) {
  return (
    <span className="flex flex-col items-center gap-1.5">
      <span className="rounded-full ring-3 ring-print">
        <Avatar name={name} size={48} />
      </span>
      <span className="text-small font-semibold">{name}</span>
    </span>
  )
}

/** Card 3: the giver's view wraps in ribbon; the owner's view stays the same. */
function SurpriseStage({ on }: { on: boolean }) {
  const watch = sample(5, 'Leather watch', 8)
  // The ribbon wraps a moment after the card arrives, and unwraps when it leaves.
  const [wrapped, setWrapped] = useState(false)
  useEffect(() => {
    if (!on) return
    const t = setTimeout(() => setWrapped(true), 450)
    return () => {
      clearTimeout(t)
      setWrapped(false)
    }
  }, [on])
  const claim: Claim | null = on && wrapped ? { status: 'reserved', mine: true } : null
  return (
    <div className="flex gap-3">
      <figure className="flex flex-col items-center gap-2">
        <Print item={watch} claim={claim} className="w-[136px]!">
          <span className="leading-tight font-semibold">{watch.title}</span>
          <span className={`text-small font-semibold text-ribbon-deep transition-opacity duration-300 ${claim ? 'opacity-100 delay-700' : 'opacity-0'}`}>Reserved by you</span>
        </Print>
        <figcaption className="text-small text-plum-soft">What Sam sees</figcaption>
      </figure>
      <figure className="flex flex-col items-center gap-2">
        <Print item={watch} className="w-[136px]!">
          <span className="leading-tight font-semibold">{watch.title}</span>
          <span className="text-small text-plum-soft">On your list</span>
        </Print>
        <figcaption className="text-small text-plum-soft">What you see</figcaption>
      </figure>
    </div>
  )
}

/**
 * The Circles tab card: a small phone. Family is picked at the top right; a tap on the
 * Circles tab opens Family's wishes straight away, with no list of Circles in between.
 */
export function CircleTabStage({ on }: { on: boolean }) {
  // 0: on My list. 1: Family is picked at the top. 2: the tab is tapped. 3: Family is open.
  const [beat, setBeat] = useState(0)
  useEffect(() => {
    if (!on) return
    const ts = [500, 1300, 1550].map((ms, i) => setTimeout(() => setBeat(i + 1), ms))
    return () => {
      ts.forEach(clearTimeout)
      setBeat(0)
    }
  }, [on])
  const open = beat >= 3
  const views = [
    { key: 'mine', title: 'My list', items: [sample(8, 'Running shoes', 9), sample(9, 'Desk lamp', 4)], shown: !open },
    { key: 'family', title: 'Family', items: [sample(6, 'Ceramic mug', 7), sample(7, 'Plant stand', 5)], shown: open },
  ]
  const tabs = [
    { label: 'My list', icon: <ListIcon />, on: !open },
    { label: 'Circles', icon: <CirclesIcon />, on: open },
    { label: 'Received', icon: <ReceivedIcon />, on: false },
  ]
  return (
    <div className="flex h-[292px] w-[224px] flex-col overflow-hidden rounded-[28px] bg-blush shadow-[inset_0_0_0_1.5px_var(--color-edge),0_2px_6px_rgba(59,29,63,.12)]">
      <div className="flex items-center justify-between rounded-b-[16px] bg-print px-3 pt-3 pb-2.5">
        <GiftMark size={20} />
        <span
          className={`flex h-7 items-center gap-1.5 rounded-full bg-print pr-2.5 pl-1 text-[11px] font-semibold transition-shadow duration-300 ${
            beat >= 1 ? 'shadow-[inset_0_0_0_2px_var(--color-plum)]' : 'shadow-[inset_0_0_0_1.5px_var(--color-edge)]'
          }`}
        >
          <Avatar name="Maya" size={20} />
          Family
          <svg width="8" height="5" viewBox="0 0 10 6" className="text-plum-soft">
            <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>

      <div className="relative flex-1">
        {views.map((v) => (
          <div
            key={v.key}
            className={`absolute inset-0 px-3 pt-3 transition-[opacity,transform] duration-300 ${v.shown ? 'opacity-100' : 'pointer-events-none opacity-0'} ${
              v.key === 'family' && !v.shown ? 'tab-stage-rise' : ''
            }`}
          >
            <span className="flex items-center gap-1.5 text-[15px] leading-none font-extrabold tracking-[-0.02em]">
              {v.title}
              {v.key === 'family' && (
                <span className="flex -space-x-1.5">
                  {['Maya', 'Sam'].map((n) => (
                    <span key={n} className="flex rounded-full ring-2 ring-blush">
                      <Avatar name={n} size={18} />
                    </span>
                  ))}
                </span>
              )}
            </span>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              {v.items.map((it) => (
                <div key={it.id} className="rounded-print bg-print p-1 pb-2 shadow-[0_1px_3px_rgba(59,29,63,.1)]">
                  <Photo item={it} />
                  <span className="mt-1.5 block truncate px-0.5 text-[10px] leading-tight font-semibold">{it.title}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex rounded-t-[16px] bg-print px-1 pt-1.5 pb-2">
        {tabs.map((t) => (
          <span key={t.label} className={`flex flex-1 flex-col items-center gap-0.5 text-[9px] font-semibold ${t.on ? 'text-plum' : 'text-plum-soft'}`}>
            <span className={`relative grid h-6 w-11 place-items-center rounded-full transition-colors duration-300 [&_svg]:size-[17px] ${t.on ? 'bg-plum text-white' : ''}`}>
              {t.icon}
              {t.label === 'Circles' && beat >= 2 && <span className="tab-tap absolute inset-0 rounded-full" />}
            </span>
            {t.label}
          </span>
        ))}
      </div>
    </div>
  )
}
