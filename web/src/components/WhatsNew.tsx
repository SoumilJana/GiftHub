import { useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useMyCircles, useProfile } from '../lib/queries'
import { useDismissed } from '../lib/view'
import { CIRCLE_TAB, CIRCLE_TAB_NEWS } from '../lib/intro'
import { CircleTabStage } from '../pages/Intro'
import { Button } from './ui'

/**
 * For people who signed up before the Circles tab learned to open your Circle: the one new
 * intro card, once, on a phone. "Got it" fades it away and the real Circles tab gives a small pulse.
 */
export function WhatsNew({ onClose }: { onClose: () => void }) {
  const [seen, dismiss] = useDismissed(CIRCLE_TAB_NEWS)
  const profile = useProfile()
  const circles = useMyCircles()
  const path = useRouterState({ select: (s) => s.location.pathname })
  const [phone] = useState(() => typeof matchMedia === 'function' && matchMedia('(max-width: 899px)').matches)
  const [closing, setClosing] = useState(false)
  const [playing, setPlaying] = useState(false)

  const show = !seen && phone && !!profile.data?.display_name && !!circles.data?.length && path !== '/welcome'

  useEffect(() => {
    if (!show) return
    const t = setTimeout(() => setPlaying(true), 250)
    return () => clearTimeout(t)
  }, [show])

  if (!show) return null

  // Fade out, then hand over to the app; the Circles tab pulses once.
  function close() {
    if (closing) return
    setClosing(true)
    setTimeout(() => {
      dismiss()
      onClose()
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
          <CircleTabStage on={playing} />
        </div>
        <h2 id="whats-new-title" className="mt-6 text-display leading-none font-extrabold tracking-[-0.035em] text-balance">
          {CIRCLE_TAB.title}
        </h2>
        <p className="mt-3 text-plum-soft">{CIRCLE_TAB.body}</p>
        <Button autoFocus className="mt-8 h-[46px]! w-full" onClick={close}>
          Got it
        </Button>
      </div>
    </div>
  )
}
