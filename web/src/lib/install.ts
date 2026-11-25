import { useEffect, useState } from 'react'

/**
 * Installing GiftHub to the home screen.
 *
 * Chrome, Edge and Samsung Internet (Android and desktop) fire `beforeinstallprompt`,
 * which we keep so our own Install button can open the browser's dialog.
 * Safari on iPhone and iPad has no such event: people add it from the Share menu,
 * so we show the steps instead. Inside other apps' browsers (Instagram, Gmail…)
 * installing isn't possible until the page is opened in Safari or Chrome.
 */

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

export type InstallMode =
  | 'installed' // already running as the installed app
  | 'prompt' // the browser can show its install dialog
  | 'ios' // iPhone or iPad: Share → Add to Home Screen
  | 'ios-in-app' // inside another app's browser on iOS: open in Safari first
  | 'mac-safari' // Safari on a Mac: File → Add to Dock
  | 'none' // no way to install from here (Firefox on desktop, or already offered and declined)

let deferred: PromptEvent | null = null
let installedNow = false
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

/** Call once at startup, before React renders, so an early `beforeinstallprompt` isn't missed. */
export function startInstallCapture() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // we show our own button instead of the browser's mini bar
    deferred = e as PromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    installedNow = true
    notify()
  })
}

function isStandalone() {
  return (
    installedNow ||
    (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches) ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/** Which install route this browser has. Pure, so it can be tested with sample user agents. */
export function installMode(ua: string, opts: { standalone: boolean; canPrompt: boolean; touch: boolean }): InstallMode {
  if (opts.standalone) return 'installed'
  if (opts.canPrompt) return 'prompt'
  // iPadOS reports itself as a Mac; touch support tells them apart.
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && opts.touch)
  if (ios) {
    // Facebook, Instagram, Gmail, LinkedIn and similar in-app browsers can't add to the home screen.
    if (/FBAN|FBAV|Instagram|GSA\/|LinkedInApp|Line\/|Twitter|Snapchat|WhatsApp/.test(ua)) return 'ios-in-app'
    return 'ios'
  }
  const macSafari = /Macintosh/.test(ua) && /Version\/(\d+)/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|Edg|Firefox/.test(ua)
  if (macSafari && Number(/Version\/(\d+)/.exec(ua)?.[1]) >= 17) return 'mac-safari'
  return 'none'
}

function currentMode(): InstallMode {
  return installMode(navigator.userAgent, {
    standalone: isStandalone(),
    canPrompt: !!deferred,
    touch: (navigator.maxTouchPoints ?? 0) > 1,
  })
}

/** The install route for this browser, kept current, and a way to open the browser's dialog. */
export function useInstall(): { mode: InstallMode; install: () => Promise<boolean> } {
  const [mode, setMode] = useState(currentMode)
  useEffect(() => {
    const update = () => setMode(currentMode())
    listeners.add(update)
    update()
    return () => {
      listeners.delete(update)
    }
  }, [])
  return {
    mode,
    async install() {
      const e = deferred
      if (!e) return false
      deferred = null // a prompt event can only be used once
      await e.prompt()
      const { outcome } = await e.userChoice
      notify()
      return outcome === 'accepted'
    },
  }
}
