import { useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { clearAddPointer, LATEST_NEWS, seenUpTo, unseenNotes, type NewsNote } from '../lib/news'
import { useMyCircles, useProfile, useUpdateProfile } from '../lib/queries'
import { CircleTabStage } from '../pages/Intro'
import { PlusIcon } from './NavIcons'
import { Button } from './ui'

/**
 * Update notes for people who already had an account: the ones they haven't seen (lib/news.ts),
 * in one card they page through, once. Closing records the latest note on the profile, so
 * other devices skip them too. New people never get here: Welcome marks every note seen.
 */
export function WhatsNew({ onClose }: { onClose: (shown: NewsNote[]) => void }) {
  const profile = useProfile()
  const circles = useMyCircles()
  const update = useUpdateProfile()
  const path = useRouterState({ select: (s) => s.location.pathname })
  const [phone] = useState(() => typeof matchMedia === 'function' && matchMedia('(max-width: 899px)').matches)
  // The list is fixed once the data is in, so saving "seen" doesn't empty it mid-way.
  const [notes, setNotes] = useState<NewsNote[] | null>(null)
  const [page, setPage] = useState(0)
  const [closing, setClosing] = useState(false)
  const [playingPage, setPlayingPage] = useState(-1)

  const ready = !!profile.data?.display_name && circles.isSuccess && path !== '/welcome'
  if (ready && notes === null && profile.data) setNotes(unseenNotes(seenUpTo(profile.data.news_seen ?? 0), { phone, hasCircle: !!circles.data?.length }))

  const note = notes?.[page]
  // Each page's picture starts moving a moment after it appears.
  useEffect(() => {
    if (!note) return
    const t = setTimeout(() => setPlayingPage(page), 250)
    return () => clearTimeout(t)
  }, [note, page])
  const playing = playingPage === page

  if (!notes?.length || !note) return null
  const last = page === notes.length - 1

  // Fade out, then hand over to the app, which points at what changed.
  function close() {
    if (closing || !notes) return
    setClosing(true)
    clearAddPointer()
    update.mutate({ news_seen: LATEST_NEWS })
    setTimeout(() => {
      setNotes([])
      onClose(notes)
    }, 340)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="whats-new-title"
      data-closing={closing || undefined}
      onKeyDown={(e) => e.key === 'Escape' && close()}
      className="whats-new fixed inset-0 z-30 flex flex-col overflow-y-auto bg-blush px-4 pt-[max(24px,env(safe-area-inset-top))] pb-[max(32px,env(safe-area-inset-bottom))]"
    >
      <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center">
        <div className="grid h-[300px] place-items-center" aria-hidden="true">
          {note.stage === 'circle-tab' ? <CircleTabStage on={playing} /> : <AddButtonStage phone={phone} on={playing} />}
        </div>
        {notes.length > 1 && (
          <p className="mt-6 text-small font-semibold text-plum-soft">
            New {page + 1} of {notes.length}
          </p>
        )}
        <h2 id="whats-new-title" className={`${notes.length > 1 ? 'mt-1' : 'mt-6'} text-display leading-none font-extrabold tracking-[-0.035em] text-balance`}>
          {note.title}
        </h2>
        <p className="mt-3 text-plum-soft">
          {phone || note.stage !== 'add-button' ? note.body : 'The paste bar moved to Add a wish, at the top of the sidebar. Click it, or press N, on any page.'}
        </p>
        <Button key={page} autoFocus className="mt-8 h-[46px]! w-full" onClick={last ? close : () => setPage(page + 1)}>
          {last ? 'Got it' : 'Next'}
        </Button>
      </div>
    </div>
  )
}

/** The bottom bar (phones) or the sidebar button (computers), with the + lighting up. */
function AddButtonStage({ phone, on }: { phone: boolean; on: boolean }) {
  if (!phone)
    return (
      <div className="flex w-[240px] flex-col gap-3 rounded-sheet bg-print p-4 shadow-[0_2px_8px_rgba(59,29,63,0.08)]">
        <div className="h-3 w-24 rounded-full bg-edge" />
        <span className={`flex items-center justify-center gap-2 rounded-full bg-plum px-4 py-[11px] font-extrabold text-white transition-transform duration-500 ${on ? 'scale-105' : ''}`}>
          <PlusIcon size={20} />
          Add a wish
        </span>
        <div className="h-3 w-32 rounded-full bg-edge" />
        <div className="h-3 w-28 rounded-full bg-edge" />
      </div>
    )
  return (
    <div className="flex w-[300px] items-start justify-around rounded-t-sheet bg-print px-2 pt-3 pb-4 shadow-[0_-1px_3px_rgba(59,29,63,0.06)]">
      {['My list', 'Circles'].map((l) => (
        <span key={l} className="flex flex-col items-center gap-1 text-[11px] font-semibold text-plum-soft">
          <span className="size-[22px] rounded-md bg-edge" />
          {l}
        </span>
      ))}
      <span
        className={`-mt-5 grid size-14 place-items-center rounded-full bg-plum text-white shadow-[0_3px_10px_rgba(59,29,63,0.28),0_0_0_4px_var(--color-print)] transition-transform duration-500 ${on ? 'scale-110' : ''}`}
      >
        <PlusIcon />
      </span>
      {['Received', 'Profile'].map((l) => (
        <span key={l} className="flex flex-col items-center gap-1 text-[11px] font-semibold text-plum-soft">
          <span className="size-[22px] rounded-md bg-edge" />
          {l}
        </span>
      ))}
    </div>
  )
}
