import { supabase } from './supabase'

/** What the Worker's /api/parse returns (see supabase/functions/_shared/parse.ts). */
export type LinkRead =
  | { ok: true; data: { url: string; store: string; title: string | null; image: string | null; price: number | null; currency: string | null } }
  | { ok: false; reason: 'blocked' | 'unreadable' | 'bad-link' | 'gone' | 'busy' | 'offline'; store: string | null }

/** Ask the server to read a store page. Never throws: failures come back as `ok: false`. */
/** `fresh`: skip the Worker's one-day cache (Update from the store). */
export async function readLink(url: string, signal?: AbortSignal, fresh = false): Promise<LinkRead> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const store = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, '')
    } catch {
      return null
    }
  })()
  if (!token) return { ok: false, reason: 'unreadable', store }
  try {
    const res = await fetch('/api/parse', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify(fresh ? { url, fresh: true } : { url }),
      signal,
    })
    if (res.status === 429) return { ok: false, reason: 'busy', store }
    const body = (await res.json()) as LinkRead
    return body.ok ? body : { ok: false, reason: body.reason ?? 'unreadable', store: body.store ?? store }
  } catch (err) {
    if (signal?.aborted) throw err
    return { ok: false, reason: navigator.onLine ? 'unreadable' : 'offline', store }
  }
}
