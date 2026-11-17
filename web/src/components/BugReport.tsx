import { useRef, useState, type FormEvent } from 'react'
import { friendlyError } from '../lib/errors'
import { shrinkToWebp } from '../lib/photo'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import { Sheet } from './ItemSheet'
import { Button, Notice, TextArea } from './ui'

const SCREENSHOT_BYTES = 300_000

/** "Chrome 130 on Android 15" from a user agent string. */
export function browserAndSystem(ua: string) {
  const browser =
    /Edg\/(\d+)/.exec(ua)?.[0].replace('Edg/', 'Edge ') ??
    /Firefox\/(\d+)/.exec(ua)?.[0].replace('/', ' ') ??
    /Chrome\/(\d+)/.exec(ua)?.[0].replace('/', ' ') ??
    (/Version\/(\d+).*Safari/.exec(ua) ? `Safari ${/Version\/(\d+)/.exec(ua)![1]}` : 'Unknown browser')
  const os =
    /Android [\d.]+/.exec(ua)?.[0] ??
    (/iPhone|iPad/.test(ua) ? `iOS ${/OS (\d+)/.exec(ua)?.[1] ?? ''}`.trim() : null) ??
    (/Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Unknown system')
  return `${browser} on ${os}`
}

/** Short, readable device line, e.g. "Chrome 130 on Android 15, 412×915". */
function describeDevice() {
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches ? ', installed app' : ''
  return `${browserAndSystem(navigator.userAgent)}, ${window.innerWidth}×${window.innerHeight}${standalone}`
}

async function toBase64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

export function BugReportSheet({ onClose }: { onClose: () => void }) {
  const toast = useToast()
  const [what, setWhat] = useState('')
  const [expected, setExpected] = useState('')
  const [shot, setShot] = useState<{ blob: Blob; name: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const page = window.location.pathname
  const device = describeDevice()

  async function pick(file: File | undefined) {
    setError(null)
    if (!file) return
    if (!file.type.startsWith('image/')) return setError('Choose an image file for the screenshot.')
    try {
      setShot({ blob: await shrinkToWebp(file, SCREENSHOT_BYTES), name: file.name })
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!what.trim()) return setError('Say what happened, even in a few words.')
    setBusy(true)
    try {
      const { data, error: fnError } = await supabase.functions.invoke<{ id: string; emailed: boolean }>('report-bug', {
        body: {
          what_happened: what.trim(),
          expected: expected.trim() || null,
          page,
          app_version: __APP_VERSION__,
          device,
          screenshot: shot ? await toBase64(shot.blob) : null,
          screenshot_type: shot ? 'image/webp' : null,
        },
      })
      if (fnError) {
        const message = await fnError.context?.json?.().then((b: { error?: string }) => b.error).catch(() => null)
        throw new Error(message || 'The report couldn’t be sent. Check your connection and try again.')
      }
      if (!data) throw new Error('The report couldn’t be sent. Please try again.')
      toast('Thanks. Your report was sent.')
      onClose()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title="Report a bug" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <TextArea label="What happened?" rows={4} maxLength={4000} value={what} onChange={(e) => setWhat(e.target.value)} required data-autofocus />
        <TextArea label="What did you expect? (optional)" rows={2} maxLength={2000} value={expected} onChange={(e) => setExpected(e.target.value)} />

        <div className="flex flex-col items-start gap-1.5">
          <span className="px-1 text-small font-semibold">Screenshot (optional)</span>
          <input ref={fileInput} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => pick(e.target.files?.[0])} />
          {shot ? (
            <span className="flex flex-wrap items-center gap-2 px-1 text-small">
              <span className="max-w-[24ch] truncate">{shot.name}</span>
              <Button variant="text" onClick={() => setShot(null)}>
                Remove
              </Button>
            </span>
          ) : (
            <Button variant="ghost" onClick={() => fileInput.current?.click()}>
              Add a screenshot
            </Button>
          )}
        </div>

        <div className="rounded-panel bg-blush px-4 py-3 text-small text-plum-soft">
          <p className="font-semibold text-plum">We’ll also send</p>
          <ul className="mt-1 space-y-0.5">
            <li>Page: {page}</li>
            <li>App version: {__APP_VERSION__}</li>
            <li>Device: {device}</li>
            <li>Your email, so we can reply</li>
          </ul>
        </div>

        {error && <Notice tone="alert">{error}</Notice>}
        <Button type="submit" busy={busy} className="self-start">
          Send report
        </Button>
      </form>
    </Sheet>
  )
}
