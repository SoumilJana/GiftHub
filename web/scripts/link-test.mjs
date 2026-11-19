// Phase 4 link test: sends each link in links.txt to the live /api/parse, the same way the app does,
// and reports how many came back with a name, photo and price.
//
// Needs your own session token in GIFTHUB_TOKEN (see the README in this folder). The token is only
// sent to GiftHub's own site and is never printed or saved.
//
//   node scripts/link-test.mjs            (from web/)
//
// Results go to ../.scratch/link-test-results.json. Links already read in the last day come from the
// cache and don't count against the rate limit; new ones are spaced 2.2 s apart (30 a minute).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const SITE = process.env.GIFTHUB_SITE ?? 'https://gifthub.grave07.workers.dev'
const token = process.env.GIFTHUB_TOKEN?.trim()
if (!token) {
  console.log('Set GIFTHUB_TOKEN first (see scripts/README.md).')
  process.exit(1)
}
const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const apikey = /^VITE_SUPABASE_PUBLISHABLE_KEY=(.+)$/m.exec(env)?.[1]?.trim()
if (!apikey) {
  console.log('No VITE_SUPABASE_PUBLISHABLE_KEY in web/.env.local.')
  process.exit(1)
}

const links = readFileSync(new URL('./links.txt', import.meta.url), 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'))

const results = []
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
for (const [i, url] of links.entries()) {
  const store = new URL(url).hostname.replace(/^www\./, '')
  const t = Date.now()
  let body
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${SITE}/api/parse`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, apikey },
        body: JSON.stringify({ url }),
        signal: AbortSignal.timeout(60000),
      })
      if (res.status === 401) {
        console.log('The token was refused. It lasts about an hour: copy a fresh one and run again.')
        process.exit(1)
      }
      if (res.status === 429) {
        await sleep(20000)
        continue
      }
      body = await res.json()
      break
    } catch (e) {
      body = { ok: false, reason: 'error', error: String(e).slice(0, 80) }
    }
  }
  const ms = Date.now() - t
  const d = body?.ok ? body.data : null
  const r = {
    url,
    store,
    ok: !!body?.ok,
    reason: body?.ok ? null : (body?.reason ?? 'error'),
    via: body?.via ?? d?.via ?? null,
    cached: !!body?.cached,
    trail: body?.trail ?? null,
    title: d?.title ?? null,
    image: d?.image ?? null,
    price: d?.price ?? null,
    currency: d?.currency ?? null,
    ms,
  }
  r.full = !!(r.title && r.image && r.price != null)
  results.push(r)
  const marks = `${r.title ? 'name' : '----'} ${r.image ? 'photo' : '-----'} ${r.price != null ? 'price' : '-----'}`
  console.log(`${String(i + 1).padStart(3)} ${store.padEnd(20).slice(0, 20)} ${r.ok ? marks : ('refused: ' + r.reason).padEnd(16)} ${String(ms).padStart(6)}ms ${r.cached ? 'cached' : ''} ${r.ok && r.full ? '' : (r.trail ?? []).join(' > ')}`)
  if (!r.cached) await sleep(Math.max(0, 2200 - ms))
}

const by = {}
for (const r of results) {
  const s = (by[r.store] ??= { links: 0, full: 0, some: 0, refused: 0 })
  s.links++
  if (r.full) s.full++
  else if (r.ok) s.some++
  else s.refused++
}
const full = results.filter((r) => r.full).length
console.log('\nStore                 links  full  partial  refused')
for (const [s, v] of Object.entries(by).sort((a, b) => b[1].links - a[1].links))
  console.log(`${s.padEnd(20).slice(0, 20)}  ${String(v.links).padStart(5)} ${String(v.full).padStart(5)} ${String(v.some).padStart(8)} ${String(v.refused).padStart(8)}`)
console.log(`\nName, photo and price: ${full} of ${results.length} (${Math.round((full / results.length) * 100)}%). Target: 80%.`)

mkdirSync(new URL('../../.scratch/', import.meta.url), { recursive: true })
writeFileSync(new URL('../../.scratch/link-test-results.json', import.meta.url), JSON.stringify(results, null, 2))
console.log('Saved to .scratch/link-test-results.json')
