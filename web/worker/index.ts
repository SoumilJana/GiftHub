// GiftHub's Cloudflare Worker. The app itself is static files (served before this runs);
// only /api/* reaches this code.
//
// POST /api/parse { url } → reads a store page for the add form.
//   1. Signed-in users only (the Supabase session is checked with Supabase).
//   2. Per-person limit: 30 links a minute.
//   3. Cached for a day (blocked results for an hour).
//   4. Read from Cloudflare; if the store refuses, try once more from Supabase's servers,
//      which some stores (FirstCry, Croma) let through. That function only answers this Worker:
//      both hold the PARSE_URL_SECRET secret, so nobody can skip the limit by calling it directly.
//   5. Still refused: read it through scrape.do's Indian proxies (Myntra, Nykaa, Ajio...),
//      when the SCRAPEDO_TOKEN secret is set. Free plan: about 1,000 credits a month;
//      when they run out, the app shows the pre-filled form as before.

import { cleanUrl, extract, looksBlocked, readPage, safeTarget, storeName, type ReadResult } from '../../supabase/functions/_shared/parse.ts'

interface Env {
  ASSETS: { fetch: (req: Request) => Promise<Response> }
  PARSE_LIMIT?: { limit: (o: { key: string }) => Promise<{ success: boolean }> }
  SUPABASE_URL: string
  /** Secret shared with the Supabase `parse-url` function. Unset: that retry is skipped. */
  PARSE_URL_SECRET?: string
  /** Secret, set with `npx wrangler secret put SCRAPEDO_TOKEN`. Optional. */
  SCRAPEDO_TOKEN?: string
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

const DAY = 86400
// Bump the version when the parser improves, so pages read by the old one are read again.
const PARSER_VERSION = 2
const cacheKey = (url: string) => new Request(`https://parse-cache.gifthub.internal/v${PARSER_VERSION}/` + encodeURIComponent(url))
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

const UPDATE_COOLDOWN = 15 * 60_000

async function fromSupabase(env: Env, url: string, auth: string, apikey: string, trail: string[]): Promise<ReadResult | null> {
  if (!env.PARSE_URL_SECRET) {
    trail.push('supabase off')
    return null
  }
  try {
    const res = await fetch(`${env.SUPABASE_URL}/functions/v1/parse-url`, {
      method: 'POST',
      headers: { authorization: auth, apikey, 'x-gifthub-key': env.PARSE_URL_SECRET, 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      trail.push(`supabase ${res.status}`)
      return null
    }
    const r = (await res.json()) as ReadResult
    trail.push(r.ok ? 'supabase ok' : `supabase ${r.reason}`)
    return r
  } catch (e) {
    trail.push(`supabase ${e instanceof Error && e.name === 'TimeoutError' ? 'timeout' : 'error'}`)
    return null
  }
}

/** Stores whose pages need scrape.do's residential proxies (about 10 credits instead of 1). */
const RESIDENTIAL = /(^|\.)etsy\.com$/

/** Whether a second Supabase try could help: not when it's switched off, refused us (wrong secret) or timed out. */
const supabaseWorthRetry = (trail: string[]) => !/^supabase (off|401|403|timeout)$/.test(trail[trail.length - 1] ?? '')

/** scrape.do's own figures from its response headers, for the log line. */
type Credits = { cost?: number; left?: number }

async function fromScrapeDo(env: Env, url: string, trail: string[], credits: Credits): Promise<ReadResult | null> {
  if (!env.SCRAPEDO_TOKEN) {
    trail.push('scrapedo off')
    return null
  }
  const host = new URL(url).hostname
  const q = new URLSearchParams({ token: env.SCRAPEDO_TOKEN, url, geoCode: 'in', ...(RESIDENTIAL.test(host) ? { super: 'true' } : {}) })
  try {
    const res = await fetch('https://api.scrape.do/?' + q, { signal: AbortSignal.timeout(40_000) })
    const num = (h: string) => (res.headers.get(h) == null ? undefined : Number(res.headers.get(h)))
    credits.cost = num('Scrape.do-Request-Cost')
    credits.left = num('Scrape.do-Remaining-Credits')
    if (!res.ok) {
      // Refused, or out of credits. scrape.do passes on the store's own status.
      trail.push(`scrapedo ${res.status}`)
      // The store says the product is gone (Nykaa and Meesho refuse Cloudflare even for missing pages).
      if (res.status === 404 || res.status === 410) return { ok: false, reason: 'gone', url: cleanUrl(url), store: storeName(url), via: 'scrapedo' }
      return null
    }
    const html = (await res.text()).slice(0, 2_500_000)
    if (looksBlocked(200, html)) {
      trail.push('scrapedo blocked-page')
      return null
    }
    const found = extract(html, url)
    if (!found.title && !found.image) {
      trail.push('scrapedo empty')
      return null
    }
    trail.push('scrapedo ok')
    return { ok: true, data: { url: cleanUrl(url), ...found }, via: 'scrapedo' }
  } catch (e) {
    trail.push(`scrapedo ${e instanceof Error && e.name === 'TimeoutError' ? 'timeout' : 'error'}`)
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
  let fresh = false
  try {
    const body = (await req.json()) as { url?: unknown; fresh?: unknown }
    input = body.url
    // "Update from the store" asks for today's page, not the cached answer (still rate-limited above).
    fresh = body.fresh === true
  } catch {
    input = null
  }
  const target = typeof input === 'string' && input.length <= 2000 ? safeTarget(input) : null
  if (!target) return json(400, { ok: false, reason: 'bad-link', url: String(input ?? ''), store: null })

  const key = cacheKey(cleanUrl(target.toString()))
  const cached = await cache().match(key)
  const hit = cached ? ((await cached.json()) as { ok?: boolean; reason?: string; trail?: string[]; at?: number }) : null
  // "Update from the store" reads afresh, but not more than once every 15 minutes per link:
  // repeated taps get the recent answer, so they can't use up scrape.do credits.
  const recent = typeof hit?.at === 'number' && Date.now() - hit.at < UPDATE_COOLDOWN
  if (hit && (!fresh || recent)) {
    console.log(JSON.stringify({ read: target.hostname, cached: true, ok: hit.ok, reason: hit.reason, trail: hit.trail }))
    return json(200, { ...hit, cached: true })
  }

  let result = await readPage(target.toString(), 'cloudflare')
  // Which steps ran and how each ended, for the link test (no secrets in it).
  const trail = [result.ok ? 'cloudflare ok' : `cloudflare ${result.reason}`]
  // Refused, or an empty page shell (Myntra sends Cloudflare one): try Supabase's servers, then scrape.do.
  const retry = (r: ReadResult) => !r.ok && (r.reason === 'blocked' || r.reason === 'unreadable')
  // Supabase twice (its servers' addresses change between calls), then scrape.do, which costs credits.
  if (retry(result)) result = (await fromSupabase(env, target.toString(), auth, apikey, trail)) ?? result
  if (retry(result) && supabaseWorthRetry(trail)) result = (await fromSupabase(env, target.toString(), auth, apikey, trail)) ?? result
  const credits: Credits = {}
  if (retry(result)) result = (await fromScrapeDo(env, target.toString(), trail, credits)) ?? result
  if (!result.ok && !result.store) result.store = storeName(target.toString())

  const keep = result.ok ? DAY : result.reason === 'blocked' || result.reason === 'gone' ? 3600 : 0
  const answer = { ...result, trail, at: Date.now() }
  // One line per fresh read in Workers Logs: the store and how each step ended (no link path, no user, no secrets).
  const line = JSON.stringify({ read: target.hostname, ok: result.ok, reason: result.ok ? undefined : result.reason, trail, scrapedo: credits.left != null ? credits : undefined })
  // Running low on scrape.do's free credits shows up as a warning in Workers Logs.
  if (credits.left != null && credits.left < 100) console.warn(line)
  else console.log(line)
  if (keep) ctx.waitUntil(cache().put(key, new Response(JSON.stringify(answer), { headers: { 'cache-control': `max-age=${keep}` } })))
  return json(200, answer)
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    const { pathname } = new URL(req.url)
    if (pathname === '/api/parse') return parse(req, env, ctx)
    if (pathname.startsWith('/api/')) return json(404, { error: 'Not found.' })
    return env.ASSETS.fetch(req)
  },
}
