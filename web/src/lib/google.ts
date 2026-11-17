/**
 * Google's own sign-in button (Google Identity Services). Google hands the
 * signed ID token to this page, which passes it to Supabase, so Google's
 * account chooser names GiftHub's site instead of the Supabase address.
 */

/** Public OAuth client ID (not a secret). */
export const GOOGLE_CLIENT_ID =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ??
  '754266112949-ldtqu4jlptrftjuf4ppp4rg79quaoml7.apps.googleusercontent.com'

type GsiButtonOptions = {
  type?: 'standard' | 'icon'
  theme?: 'outline' | 'filled_blue' | 'filled_black'
  size?: 'large' | 'medium' | 'small'
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
  shape?: 'rectangular' | 'pill' | 'circle' | 'square'
  logo_alignment?: 'left' | 'center'
  width?: number
}

type Gsi = {
  accounts: {
    id: {
      initialize(config: {
        client_id: string
        callback: (response: { credential: string }) => void
        nonce?: string
        auto_select?: boolean
        use_fedcm_for_button?: boolean
      }): void
      renderButton(parent: HTMLElement, options: GsiButtonOptions): void
    }
  }
}

declare global {
  interface Window {
    google?: Gsi
  }
}

let loading: Promise<Gsi> | null = null

/** Loads Google's script once. Rejects if it is blocked or offline. */
export function loadGoogle(): Promise<Gsi> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google)
  loading ??= new Promise<Gsi>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => (window.google?.accounts?.id ? resolve(window.google) : reject(new Error('Google sign-in did not load')))
    script.onerror = () => {
      loading = null
      script.remove()
      reject(new Error('Google sign-in did not load'))
    }
    document.head.append(script)
  })
  return loading
}

/** A random nonce plus its SHA-256 hex digest: Google gets the hash, Supabase the raw value. */
export async function makeNonce(): Promise<{ raw: string; hashed: string }> {
  const raw = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  const hashed = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
  return { raw, hashed }
}
