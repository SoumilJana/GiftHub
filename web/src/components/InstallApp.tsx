import { useState } from 'react'
import { useInstall, type InstallMode } from '../lib/install'
import { useToast } from '../lib/toast'
import { useDismissed } from '../lib/view'
import { Button, Panel } from './ui'

const INSTALL_CARD = 'install-app'

/** The share-sheet icon Safari uses, so the step matches what people see. */
function ShareIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="inline size-[1.05em] -translate-y-px align-middle" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.75v8.5M5 4.5l3-3 3 3M5.5 7H4a1 1 0 0 0-1 1v5.25a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-1.5" />
    </svg>
  )
}

/** Step-by-step for browsers that have no install dialog. */
function Steps({ mode }: { mode: InstallMode }) {
  if (mode === 'ios')
    return (
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-small">
        <li>
          Tap Share <ShareIcon /> in the browser bar. On newer iPhones it’s in the ••• menu.
        </li>
        <li>
          Choose <strong className="font-semibold">Add to Home Screen</strong>.
        </li>
        <li>
          Tap <strong className="font-semibold">Add</strong>.
        </li>
      </ol>
    )
  if (mode === 'ios-in-app')
    return <p className="mt-3 text-small">This page is open inside another app. Open it in Safari first (the ••• or compass button), then use Share → Add to Home Screen.</p>
  if (mode === 'mac-safari')
    return (
      <p className="mt-3 text-small">
        In the menu bar, choose <strong className="font-semibold">File → Add to Dock</strong>.
      </p>
    )
  return null
}

function useInstallAction() {
  const { mode, install } = useInstall()
  const toast = useToast()
  const [showSteps, setShowSteps] = useState(false)
  async function start() {
    if (mode === 'prompt') {
      if (await install()) toast('GiftHub is on your home screen.')
    } else setShowSteps((s) => !s)
  }
  return { mode, showSteps, start }
}

/** Profile: always there, so people can install later. */
export function InstallPanel() {
  const { mode, showSteps, start } = useInstallAction()
  if (mode === 'none') return null
  return (
    <Panel>
      <h2 className="font-extrabold">Install the app</h2>
      {mode === 'installed' ? (
        <p className="mt-1 text-small text-plum-soft">You’re using the installed app.</p>
      ) : (
        <>
          <p className="mt-1 mb-4 text-small text-plum-soft">Opens from your home screen, full screen, like any other app. Nothing to download from a store.</p>
          <Button variant="ghost" aria-expanded={mode === 'prompt' ? undefined : showSteps} onClick={start}>
            {mode === 'prompt' ? 'Install GiftHub' : 'Show me how'}
          </Button>
          {showSteps && <Steps mode={mode} />}
        </>
      )}
    </Panel>
  )
}

/** My list: a one-time nudge on phones, once someone has a wish saved. Dismissed for good. */
export function InstallCard() {
  const { mode, showSteps, start } = useInstallAction()
  const [dismissed, dismiss] = useDismissed(INSTALL_CARD)
  const [phone] = useState(() => typeof matchMedia === 'function' && matchMedia('(max-width: 899px)').matches)
  if (dismissed || !phone || (mode !== 'prompt' && mode !== 'ios')) return null
  return (
    <div className="mt-5 max-w-[72ch] rounded-panel bg-sky-wash px-4 py-3 text-small text-sky-ink">
      <p>
        <strong className="font-extrabold">Put GiftHub on your home screen.</strong> It opens full screen, like an app.
      </p>
      {showSteps && <Steps mode={mode} />}
      <div className="mt-2 flex gap-4">
        <button type="button" onClick={start} aria-expanded={mode === 'prompt' ? undefined : showSteps} className="font-semibold underline underline-offset-3 hover:text-plum">
          {mode === 'prompt' ? 'Install' : showSteps ? 'Hide steps' : 'Show me how'}
        </button>
        <button type="button" onClick={dismiss} className="font-semibold underline underline-offset-3 hover:text-plum">
          Not now
        </button>
      </div>
    </div>
  )
}
