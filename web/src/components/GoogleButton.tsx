import { useEffect, useRef, useState } from 'react'
import { GOOGLE_CLIENT_ID, loadGoogle, makeNonce } from '../lib/google'
import { GoogleMark } from './AuthFrame'
import { Button } from './ui'

/**
 * Google's own "Continue with Google" button. If Google's script can't load
 * (blocked or offline), falls back to the redirect sign-in through Supabase.
 */
export function GoogleButton({
  onToken,
  onFallback,
  busy,
}: {
  onToken: (idToken: string, rawNonce: string) => void
  onFallback: () => void
  busy: boolean
}) {
  const box = useRef<HTMLDivElement>(null)
  const handler = useRef(onToken)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    handler.current = onToken
  }, [onToken])

  useEffect(() => {
    let cancelled = false
    Promise.all([loadGoogle(), makeNonce()])
      .then(([google, nonce]) => {
        const el = box.current
        if (cancelled || !el) return
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          nonce: nonce.hashed,
          use_fedcm_for_button: true,
          callback: ({ credential }) => handler.current(credential, nonce.raw),
        })
        el.replaceChildren()
        google.accounts.id.renderButton(el, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          logo_alignment: 'center',
          width: Math.min(400, Math.max(200, Math.round(el.getBoundingClientRect().width))),
        })
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (failed) {
    return (
      <Button variant="ghost" className="w-full" busy={busy} onClick={onFallback}>
        <GoogleMark />
        Continue with Google
      </Button>
    )
  }

  return (
    <div className="relative">
      <div ref={box} className="flex min-h-11 w-full justify-center [color-scheme:light]" aria-busy={busy} />
      {busy && <div className="absolute inset-0 rounded-full bg-print/70" aria-hidden="true" />}
    </div>
  )
}
