/**
 * Cloudflare Turnstile: a free, mostly invisible "are you a person?" check.
 * Supabase Auth verifies the token on sign-up, sign-in, email links and password resets.
 * GiftHub's own site key is built in (see below).
 */

/**
 * Public site key (not a secret). The secret key lives only in the Supabase dashboard.
 * It is written here, not only in .env.local, because the automatic deploy on every push
 * builds without .env.local: a build without the key would break sign-in while Supabase
 * requires the check. Set VITE_TURNSTILE_SITE_KEY to override it (Cloudflare's test key locally).
 */
export const TURNSTILE_SITE_KEY =
  (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() || '0x4AAAAAAGILWAuXiVVhrVlm'

export type Turnstile = {
  render(
    el: HTMLElement,
    options: {
      sitekey: string
      action?: string
      appearance?: 'always' | 'execute' | 'interaction-only'
      size?: 'normal' | 'compact' | 'flexible'
      theme?: 'light' | 'dark' | 'auto'
      callback?: (token: string) => void
      'expired-callback'?: () => void
      'error-callback'?: () => void
    },
  ): string
  reset(id: string): void
  remove(id: string): void
}

declare global {
  interface Window {
    turnstile?: Turnstile
  }
}

let loading: Promise<Turnstile> | null = null

/** Loads Cloudflare's script once. Rejects if it is blocked or offline. */
export function loadTurnstile(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  loading ??= new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('The person check did not load')))
    script.onerror = () => {
      loading = null
      script.remove()
      reject(new Error('The person check did not load'))
    }
    document.head.append(script)
  })
  return loading
}
