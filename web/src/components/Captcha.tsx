import { useCallback, useEffect, useRef } from 'react'
import { TURNSTILE_SITE_KEY, loadTurnstile } from '../lib/turnstile'

const NOT_CHECKED = 'We couldn’t check that you’re a person. Reload the page and try again.'

/**
 * The Turnstile check for an auth form. Usually invisible; it only shows a box when
 * Cloudflare wants a click. `take()` hands over a fresh token (each one works once)
 * and starts the next check. Without a site key it returns undefined and shows nothing.
 */
export function useCaptcha() {
  const box = useRef<HTMLDivElement>(null)
  const id = useRef<string | null>(null)
  const token = useRef<string | null>(null)
  const waiting = useRef<((t: string | null) => void)[]>([])

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return
    let cancelled = false
    const settle = (t: string | null) => waiting.current.splice(0).forEach((w) => w(t))
    loadTurnstile()
      .then((ts) => {
        if (cancelled || !box.current) return
        id.current = ts.render(box.current, {
          sitekey: TURNSTILE_SITE_KEY!,
          action: 'auth',
          appearance: 'interaction-only',
          size: 'flexible',
          theme: 'light',
          callback: (t) => {
            token.current = t
            settle(t)
          },
          'expired-callback': () => {
            token.current = null
          },
          'error-callback': () => {
            token.current = null
            settle(null)
          },
        })
      })
      .catch(() => settle(null))
    return () => {
      cancelled = true
      // Never let the widget's own cleanup break the page that replaces the form.
      try {
        if (id.current) window.turnstile?.remove(id.current)
      } catch {
        /* already gone */
      }
      id.current = null
    }
  }, [])

  const take = useCallback(async (): Promise<string | undefined> => {
    if (!TURNSTILE_SITE_KEY) return undefined
    const t =
      token.current ??
      (await new Promise<string | null>((resolve) => {
        waiting.current.push(resolve)
        setTimeout(() => resolve(null), 20_000)
      }))
    token.current = null
    try {
      if (id.current) window.turnstile?.reset(id.current)
    } catch {
      /* the form is closing */
    }
    if (!t) throw new Error(NOT_CHECKED)
    return t
  }, [])

  const widget = TURNSTILE_SITE_KEY ? <div ref={box} className="flex w-full justify-center [color-scheme:light]" /> : null
  return { widget, take }
}
