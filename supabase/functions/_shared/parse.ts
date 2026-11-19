// Reads a product page: name, photo, price and currency.
// Shared by the Cloudflare Worker (/api/parse) and the Supabase Edge Function (parse-url),
// so it uses only web-standard APIs and has no imports.

export type Parsed = {
  /** Clean link to save: tracking removed, short links resolved. */
  url: string
  store: string
  title: string | null
  image: string | null
  price: number | null
  currency: string | null
  /** 0–1: name, photo and price found = 1. */
  confidence: number
}

export type ReadResult =
  | { ok: true; data: Parsed; via: string }
  | { ok: false; reason: 'blocked' | 'unreadable' | 'bad-link' | 'gone'; url: string; store: string | null; via: string }

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const MAX_BYTES = 2_500_000
const TIMEOUT_MS = 10_000

/** Query parameters that only track where a click came from. */
const TRACKING = [
  /^utm_/, /^pf_rd_/, /^pd_rd_/, /^_encoding$/, /^ref_?$/, /^refRID$/, /^tag$/, /^linkCode$/, /^linkId$/, /^ascsubtag$/,
  /^psc$/, /^smid$/, /^th$/, /^qid$/, /^sr$/, /^keywords$/, /^crid$/, /^sprefix$/, /^content-id$/, /^dib(_tag)?$/,
  /^spLa$/, /^sp_csd$/, /^gclid$/, /^fbclid$/, /^gad_source$/, /^srsltid$/, /^mc_[a-z]+$/, /^igshid$/, /^si$/,
  /^lid$/, /^marketplace$/, /^store$/, /^srno$/, /^otracker\d*$/, /^fm$/, /^iid$/, /^ppt$/, /^ppn$/, /^ssid$/,
  /^qH$/, /^ov_redirect$/, /^affid$/, /^affExtParam\d$/, /^cmpid$/, /^_branch_match_id$/, /^_branch_referrer$/,
]

export function storeName(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return null
  }
}

/** Only public https/http pages on ordinary hostnames: no IP addresses, local names or odd ports. */
export function safeTarget(input: string): URL | null {
  let u: URL
  try {
    u = new URL(input.trim())
  } catch {
    return null
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
  if (u.username || u.password) return null
  if (u.port && u.port !== '80' && u.port !== '443') return null
  const host = u.hostname.toLowerCase()
  if (!host.includes('.') || host.endsWith('.')) return null
  if (/^[\d.]+$/.test(host) || host.startsWith('[')) return null
  if (/(^|\.)(localhost|local|internal|lan|home|arpa|test|invalid|example)$/.test(host)) return null
  return u
}

/** Is this a public internet address? False for private, local, link-local, shared and reserved ranges. */
export function isPublicIp(ip: string): boolean {
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip)
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])]
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false
    if (a === 100 && b >= 64 && b <= 127) return false // carrier-grade NAT
    if (a === 169 && b === 254) return false // link-local, cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return false
    if (a === 192 && b === 168) return false
    if (a === 192 && b === 0) return false
    if (a === 198 && (b === 18 || b === 19)) return false
    return true
  }
  const v6 = ip.toLowerCase()
  if (!v6.includes(':')) return false
  if (v6 === '::' || v6 === '::1') return false
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v6)
  if (mapped) return isPublicIp(mapped[1])
  if (/^::ffff:/.test(v6)) return false
  if (/^f[cd]/.test(v6) || /^fe[89ab]/.test(v6) || /^ff/.test(v6)) return false // private, link-local, multicast
  if (/^64:ff9b:/.test(v6) || /^2001:db8:/.test(v6)) return false
  return true
}

/** Does this hostname point only at public addresses? Asked over DNS-over-HTTPS; any doubt means no. */
export async function resolvesPublic(host: string): Promise<boolean> {
  try {
    const answers = await Promise.all(
      ['A', 'AAAA'].map(async (type) => {
        const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`, {
          headers: { accept: 'application/dns-json' },
          signal: AbortSignal.timeout(3000),
        })
        if (!res.ok) throw new Error('dns')
        const d = (await res.json()) as { Answer?: { type: number; data: string }[] }
        return (d.Answer ?? []).filter((x) => x.type === 1 || x.type === 28).map((x) => x.data)
      }),
    )
    const ips = answers.flat()
    return ips.length > 0 && ips.every(isPublicIp)
  } catch {
    return false
  }
}

/** Fetch, following up to 5 redirects by hand so every hop is checked: a public page can't bounce us inward. */
async function fetchChecked(start: URL, init: RequestInit): Promise<{ res: Response; url: string } | null> {
  let at = start
  for (let hop = 0; hop <= 5; hop++) {
    if (!(await resolvesPublic(at.hostname))) return null
    const res = await fetch(at.toString(), { ...init, redirect: 'manual' })
    if (res.status < 300 || res.status >= 400) return { res, url: at.toString() }
    res.body?.cancel().catch(() => {})
    const loc = res.headers.get('location')
    const next = loc ? safeTarget(new URL(loc, at).toString()) : null
    if (!next) return null
    at = next
  }
  return null
}

/** The link worth saving: tracking removed, and Amazon and Flipkart cut down to the product. */
export function cleanUrl(input: string): string {
  const u = new URL(input)
  u.hash = ''
  const host = u.hostname.toLowerCase()
  if (/(^|\.)amazon\.[a-z.]+$/.test(host)) {
    const asin = /\/(?:dp|gp\/product|gp\/aw\/d|exec\/obidos\/asin)\/([A-Z0-9]{10})/i.exec(u.pathname)?.[1]
    if (asin) return `https://${host}/dp/${asin.toUpperCase()}`
  }
  if (/(^|\.)flipkart\.com$/.test(host)) {
    const pid = u.searchParams.get('pid')
    u.search = pid ? `?pid=${pid}` : ''
    u.hostname = 'www.flipkart.com'
    return u.toString()
  }
  for (const key of [...u.searchParams.keys()]) if (TRACKING.some((re) => re.test(key))) u.searchParams.delete(key)
  return u.toString()
}

const ENTITIES: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', '#39': "'", '#x27': "'", rsquo: '’', lsquo: '‘', ndash: '–', mdash: '—', reg: '®', trade: '™' }
function decode(s: string) {
  return s
    .replace(/&([a-z0-9#]+);/gi, (m, e: string) => {
      const k = e.toLowerCase()
      if (ENTITIES[k]) return ENTITIES[k]
      if (k.startsWith('#x')) return String.fromCodePoint(parseInt(k.slice(2), 16) || 32)
      if (k.startsWith('#')) return String.fromCodePoint(parseInt(k.slice(1), 10) || 32)
      return m
    })
    .replace(/\s+/g, ' ')
    .trim()
}

function attr(tag: string, name: string) {
  const m = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(tag)
  return m ? (m[2] ?? m[3]) : undefined
}

function metaContent(html: string, keys: string[]) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const k = (attr(tag, 'property') ?? attr(tag, 'name') ?? attr(tag, 'itemprop'))?.toLowerCase()
    if (k && keys.includes(k)) {
      const v = attr(tag, 'content')
      if (v && v.trim()) return decode(v)
    }
  }
  return undefined
}

/** "₹1,699.00", "1.699,00", "1699" → 1699. */
export function toPrice(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : null
  if (typeof v !== 'string') return null
  let s = v.replace(/[^\d.,]/g, '')
  if (!/\d/.test(s)) return null
  const lastComma = s.lastIndexOf(','), lastDot = s.lastIndexOf('.')
  if (lastComma > lastDot && s.length - lastComma - 1 <= 2) s = s.replace(/\./g, '').replace(',', '.') // 1.699,00
  else s = s.replace(/,/g, '')
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 && n < 1e10 ? Math.round(n * 100) / 100 : null
}

function absolute(src: string | undefined, base: string) {
  if (!src) return null
  try {
    const u = new URL(decode(src), base)
    if (u.protocol === 'http:') u.protocol = 'https:'
    return u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

type Found = { title?: string; image?: string; price?: number | null; currency?: string }

function fromJsonLd(html: string): Found {
  const out: Found = {}
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown
    try {
      data = JSON.parse(m[1].trim())
    } catch {
      continue
    }
    const stack: unknown[] = [data]
    while (stack.length) {
      const n = stack.pop()
      if (!n || typeof n !== 'object') continue
      if (Array.isArray(n)) {
        stack.push(...n)
        continue
      }
      const o = n as Record<string, unknown>
      if (o['@graph']) stack.push(o['@graph'])
      const t = o['@type']
      const isProduct = t === 'Product' || t === 'ProductGroup' || (Array.isArray(t) && t.includes('Product'))
      if (!isProduct) continue
      if (typeof o.name === 'string' && !out.title) out.title = decode(o.name)
      const img = Array.isArray(o.image) ? o.image[0] : o.image
      if (!out.image) out.image = typeof img === 'string' ? img : (img as { url?: string; contentUrl?: string } | undefined)?.url ?? (img as { contentUrl?: string } | undefined)?.contentUrl
      const offerList = Array.isArray(o.offers) ? o.offers : o.offers ? [o.offers] : []
      for (const raw of offerList) {
        const of = raw as Record<string, unknown>
        const spec = (Array.isArray(of.priceSpecification) ? of.priceSpecification[0] : of.priceSpecification) as Record<string, unknown> | undefined
        const p = toPrice(of.price ?? of.lowPrice ?? spec?.price)
        if (p != null && out.price == null) {
          out.price = p
          const c = of.priceCurrency ?? spec?.priceCurrency
          if (typeof c === 'string') out.currency = c
        }
      }
      if (Array.isArray(o.hasVariant)) stack.push(o.hasVariant)
    }
  }
  return out
}

function fromAmazon(html: string): Found {
  const title = /id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i.exec(html)?.[1]
  const whole = /class=["']a-price-whole["'][^>]*>([\d,.]+)/i.exec(html)?.[1]
  const fraction = /class=["']a-price-fraction["'][^>]*>(\d+)/i.exec(html)?.[1]
  const symbol = /class=["']a-price-symbol["'][^>]*>([^<]+)</i.exec(html)?.[1]
  const image =
    /data-old-hires=["'](https[^"']+)["']/i.exec(html)?.[1] ??
    /id=["']landingImage["'][^>]*?\ssrc=["'](https[^"']+)["']/i.exec(html)?.[1] ??
    /id=["']imgBlkFront["'][^>]*?\ssrc=["'](https[^"']+)["']/i.exec(html)?.[1]
  const price = whole ? toPrice(whole.replace(/[.,]$/, '') + (fraction ? '.' + fraction : '')) : null
  const SYMBOLS: Record<string, string> = { '₹': 'INR', $: 'USD', '£': 'GBP', '€': 'EUR', 'AED': 'AED' }
  return { title: title ? decode(title) : undefined, image, price, currency: symbol ? SYMBOLS[symbol.trim()] : undefined }
}

/** Stores that keep the price outside JSON-LD and meta tags. */
function fromStoreData(html: string, store: string, pageUrl: string): Found {
  // Croma: the page state carries "pdpPriceData":{"sellingPrice":{"value":"4694.00"}
  if (store === 'croma.com') {
    const v = /"pdpPriceData"\s*:\s*\{\s*"sellingPrice"\s*:\s*\{\s*"value"\s*:\s*"?([\d.]+)/.exec(html)?.[1]
    return v ? { price: toPrice(v), currency: 'INR' } : {}
  }
  // FirstCry: each product on the page has "mrp" and "Dis" (percent off) just before its "pid".
  if (store === 'firstcry.com') {
    const pid = /\/(\d+)\/product-detail/.exec(pageUrl)?.[1]
    const at = pid ? html.indexOf(`"pid":${pid}`) : -1
    if (at < 0) return {}
    const before = html.slice(Math.max(0, at - 800), at)
    const mrp = [...before.matchAll(/"mrp":([\d.]+)/g)].pop()?.[1]
    const dis = [...before.matchAll(/"Dis":([\d.]+)/g)].pop()?.[1]
    if (!mrp) return {}
    const price = Math.round(Number(mrp) * (1 - (Number(dis) || 0) / 100))
    return price > 0 ? { price, currency: 'INR' } : {}
  }
  return {}
}

/** Tata CLiQ pages are empty shells filled in by the browser; its product API has everything. */
async function fromTataCliq(target: URL): Promise<Omit<Parsed, 'url'> | null> {
  const id = /\/p-(mp\d+)/i.exec(target.pathname)?.[1]?.toUpperCase()
  if (!id) return null
  try {
    const res = await fetch(`https://www.tatacliq.com/marketplacewebservices/v2/mpl/products/productDetails/${id}?isPwa=true&isMDE=true`, {
      headers: { 'user-agent': UA, accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) return null
    const d = (await res.json()) as {
      productName?: string
      winningSellerPrice?: { doubleValue?: number }
      mrpPrice?: { doubleValue?: number }
      galleryImagesList?: { galleryImages?: { key: string; value: string }[] }[]
    }
    if (!d.productName) return null
    const img = d.galleryImagesList?.[0]?.galleryImages?.find((g) => g.key === 'superZoom' || g.key === 'zoom' || g.key === 'product')?.value
    const price = toPrice(d.winningSellerPrice?.doubleValue ?? d.mrpPrice?.doubleValue)
    const title = tidyTitle(decode(d.productName), 'tatacliq.com')
    const image = img ? (img.startsWith('//') ? 'https:' + img : img) : null
    const confidence = (title ? 0.4 : 0) + (image ? 0.3 : 0) + (price != null ? 0.3 : 0)
    return { store: 'tatacliq.com', title, image, price, currency: price != null ? 'INR' : null, confidence: Math.round(confidence * 10) / 10 }
  } catch {
    return null
  }
}

const BLOCK_TEXT = [
  'api-services-support@amazon.com', 'to discuss automated access', 'enter the characters you see below', 'robot check',
  'pardon our interruption', 'are you a human', 'access denied', 'request blocked', 'unusual traffic', 'px-captcha',
  'verify you are human', 'site maintenance', 'attention required! | cloudflare', 'just a moment...',
]

/** Did the store refuse us, rather than show a page? */
export function looksBlocked(status: number, html: string) {
  if (status === 403 || status === 429 || status === 503 || status === 520 || status === 999) return true
  const head = html.slice(0, 20000).toLowerCase()
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1] ?? ''
  return BLOCK_TEXT.some((t) => title.includes(t) || (head.length < 15000 && head.includes(t)))
}

/** Store-specific title tidying: "Buy X Online at Best Price | Flipkart.com" → "X". */
function tidyTitle(t: string, store: string) {
  let s = t
  const name = store.split('.')[0]
  s = s.replace(new RegExp(`\\s*[|:–-]\\s*(buy online at )?${name}(\\.[a-z.]+)?\\s*$`, 'i'), '')
  s = s.replace(/^buy\s+/i, '').replace(/\s+online at (best|low) prices? in india.*$/i, '').replace(/\s+online in india.*$/i, '')
  s = s.replace(/^amazon\.[a-z.]+\s*:\s*/i, '')
  return s.trim().slice(0, 300) || null
}

export function extract(html: string, pageUrl: string): Omit<Parsed, 'url'> {
  const store = storeName(pageUrl) ?? ''
  const ld = fromJsonLd(html)
  const amz: Found = /(^|\.)amazon\./.test(store) ? fromAmazon(html) : {}
  const sd = fromStoreData(html, store, pageUrl)
  const og: Found = {
    title: metaContent(html, ['og:title', 'twitter:title']),
    image: metaContent(html, ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src']),
    price: toPrice(metaContent(html, ['product:price:amount', 'og:price:amount', 'price'])),
    currency: metaContent(html, ['product:price:currency', 'og:price:currency', 'pricecurrency']),
  }
  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]
  const rawTitle = ld.title ?? amz.title ?? og.title ?? (titleTag ? decode(titleTag) : undefined)
  const title = rawTitle ? tidyTitle(rawTitle, store) : null
  const image = absolute(ld.image ?? amz.image ?? og.image, pageUrl)
  const price = ld.price ?? amz.price ?? sd.price ?? og.price ?? null
  const cur = (price != null ? (ld.price != null ? ld.currency : amz.price != null ? amz.currency : sd.price != null ? sd.currency : og.currency) : undefined)?.toUpperCase()
  const currency = cur && /^[A-Z]{3}$/.test(cur) ? cur : null
  const confidence = (title ? 0.4 : 0) + (image ? 0.3 : 0) + (price != null ? 0.3 : 0)
  return { store, title, image, price, currency, confidence: Math.round(confidence * 10) / 10 }
}

async function readCapped(res: Response) {
  if (!res.body) return ''
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    size += value.byteLength
  }
  reader.cancel().catch(() => {})
  const all = new Uint8Array(Math.min(size, MAX_BYTES))
  let at = 0
  for (const c of chunks) {
    const part = c.subarray(0, Math.min(c.byteLength, all.length - at))
    all.set(part, at)
    at += part.byteLength
    if (at >= all.length) break
  }
  return new TextDecoder().decode(all)
}

function isHomeShell(html: string, pageUrl: string) {
  const path = new URL(pageUrl).pathname.replace(/\/+$/, '')
  if (!path) return false
  const canon =
    /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i.exec(html)?.[1] ??
    /<meta[^>]+property=["']og:url["'][^>]*content=["']([^"']+)["']/i.exec(html)?.[1]
  if (!canon) return false
  try {
    return new URL(canon, pageUrl).pathname.replace(/\/+$/, '') === ''
  } catch {
    return false
  }
}

/** Fetch a page and read it. `via` names where it ran, for logs. */
export async function readPage(input: string, via: string): Promise<ReadResult> {
  const target = safeTarget(input)
  if (!target) return { ok: false, reason: 'bad-link', url: input, store: null, via }
  if (/(^|\.)tatacliq\.com$/.test(target.hostname)) {
    const found = await fromTataCliq(target)
    if (found) return { ok: true, data: { url: cleanUrl(target.toString()), ...found }, via }
  }
  let got: { res: Response; url: string } | null
  try {
    got = await fetchChecked(target, {
      headers: {
        'user-agent': UA,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-IN,en;q=0.9',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    got = null
  }
  // Unreachable, or it pointed (or redirected) somewhere that isn't the public internet.
  if (!got) return { ok: false, reason: 'unreadable', url: cleanUrl(target.toString()), store: storeName(target.toString()), via }
  const { res, url: finalUrl } = got
  const url = cleanUrl(finalUrl)
  const store = storeName(finalUrl)
  const type = res.headers.get('content-type') ?? ''
  if (type && !/html|xml/i.test(type)) {
    res.body?.cancel().catch(() => {})
    return { ok: false, reason: 'unreadable', url, store, via }
  }
  // A removed product: say so, and don't spend retries on it.
  if (res.status === 404 || res.status === 410) {
    res.body?.cancel().catch(() => {})
    return { ok: false, reason: 'gone', url, store, via }
  }
  const html = await readCapped(res)
  if (looksBlocked(res.status, html)) return { ok: false, reason: 'blocked', url, store, via }
  const found = extract(html, finalUrl)
  if (!found.title && !found.image) return { ok: false, reason: res.ok ? 'unreadable' : 'blocked', url, store, via }
  // A product link answered with the shop's home page (an empty app shell): not a product read.
  const sentHome = new URL(finalUrl).pathname.replace(/\/+$/, '') === '' && target.pathname.replace(/\/+$/, '') !== ''
  if (found.price == null && (sentHome || isHomeShell(html, finalUrl))) return { ok: false, reason: 'unreadable', url, store, via }
  return { ok: true, data: { url, ...found }, via }
}
