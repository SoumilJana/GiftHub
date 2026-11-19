// GiftHub's Cloudflare Worker. The app itself is static files (served before this runs);
// only /api/* reaches this code.
//
// POST /api/parse { url } → reads a store page for the add form.
//   1. Signed-in users only (the Supabase session is checked with Supabase).
//   2. Per-person limit: 30 links a minute.
//   3. Cached for a day (blocked results for an hour).
//   4. Read from Cloudflare; if the store refuses, try once more from Supabase's servers,
//      which some stores (FirstCry, Croma) let through.

import { cleanUrl, readPage, safeTarget, storeName, type ReadResult } from '../../supabase/functions/_shared/parse.ts'

interface Env {
  ASSETS: { fetch: (req: Request) => Promise<Response> }
  PARSE_LIMIT?: { limit: (o: { key: string }) => Promise<{ success: boolean }> }
  SUPABASE_URL: string
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

const DAY = 86400
const cacheKey = (url: string) => new Request('https://parse-cache.gifthub.internal/' + encodeURIComponent(url))
const cache = () => (caches as unknown as { default: Cache }).default

/** Who is asking? Returns the user id, or null when the session isn't valid. */
const seen = new Map<string, { id: string; until: number }>()
async function userId(env: Env, auth: string, apikey: string) {
  const hit = seen.get(auth)
  if (hit && hit.until > Date.now()) return hit.id
  let user: { id?: string }
  try {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { authorization: auth, apikey }, signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    user = (await res.json()) as { id?: string }
  } catch {
    return null
  }
  if (!user.id) return null
  if (seen.size > 500) seen.clear()
  seen.set(auth, { id: user.id, until: Date.now() + 5 * 60_000 })
  return user.id
}

async function fromSupabase(env: Env, url: string, auth: string, apikey: string): Promise<ReadResult | null> {
  try {
    const res = await fetch(`${env.SUPABASE_URL}/functions/v1/parse-url`, {
      method: 'POST',
      headers: { authorization: auth, apikey, 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(15_000),
    })
    return res.ok ? ((await res.json()) as ReadResult) : null
  } catch {
    return null
  }
}

async function parse(req: Request, env: Env, ctx: ExecutionContext) {
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' })
  const auth = req.headers.get('authorization') ?? ''
  const apikey = req.headers.get('apikey') ?? ''
  if (!/^Bearer\s+\S+$/i.test(auth) || !apikey) return json(401, { error: 'Sign in first.' })
  const uid = await userId(env, auth, apikey)
  if (!uid) return json(401, { error: 'Sign in first.' })
  if (env.PARSE_LIMIT && !(await env.PARSE_LIMIT.limit({ key: uid })).success) return json(429, { error: 'Too many links at once. Try again in a minute.' })

  let input: unknown
  try {
    input = ((await req.json()) as { url?: unknown }).url
  } catch {
    input = null
  }
  const target = typeof input === 'string' && input.length <= 2000 ? safeTarget(input) : null
  if (!target) return json(400, { ok: false, reason: 'bad-link', url: String(input ?? ''), store: null })

  const key = cacheKey(cleanUrl(target.toString()))
  const cached = await cache().match(key)
  if (cached) return json(200, { ...((await cached.json()) as object), cached: true })

  let result = await readPage(target.toString(), 'cloudflare')
  if (!result.ok && result.reason === 'blocked') result = (await fromSupabase(env, target.toString(), auth, apikey)) ?? result
  if (!result.ok && !result.store) result.store = storeName(target.toString())

  const keep = result.ok ? DAY : result.reason === 'blocked' ? 3600 : 0
  if (keep) ctx.waitUntil(cache().put(key, new Response(JSON.stringify(result), { headers: { 'cache-control': `max-age=${keep}` } })))
  return json(200, result)
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    const { pathname } = new URL(req.url)
    if (pathname === '/api/parse') return parse(req, env, ctx)
    if (pathname.startsWith('/api/')) return json(404, { error: 'Not found.' })
    return env.ASSETS.fetch(req)
  },
}
