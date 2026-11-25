import { priorityBand, type PriorityBand } from './format'

export type Occasion = 'anniversary' | 'birthday' | 'holiday' | 'valentines_day' | 'just_because'

export const OCCASIONS: { value: Occasion; label: string }[] = [
  { value: 'birthday', label: 'Birthday' },
  { value: 'anniversary', label: 'Anniversary' },
  { value: 'holiday', label: 'Holiday' },
  { value: 'valentines_day', label: 'Valentine’s Day' },
  { value: 'just_because', label: 'Just because' },
]

export const occasionLabel = (o: Occasion) => OCCASIONS.find((x) => x.value === o)?.label ?? o

export type Item = {
  id: string
  owner_id: string
  title: string
  url: string | null
  image_url: string | null
  domain: string | null
  price: number | null
  currency: string
  original_price: number | null
  priority: number
  notes: string | null
  created_at: string
  occasions: Occasion[]
  circle_ids: string[]
}

export type SortKey = 'priority' | 'newest' | 'price-low' | 'price-high'

export const SORTS: { value: SortKey; label: string }[] = [
  { value: 'priority', label: 'Most wanted first' },
  { value: 'newest', label: 'Newest first' },
  { value: 'price-low', label: 'Price: low to high' },
  { value: 'price-high', label: 'Price: high to low' },
]

export type ListFilter = {
  occasion: Occasion | null
  band: PriorityBand | null
  maxPrice: number | null
  sort: SortKey
}

export const defaultFilter: ListFilter = { occasion: null, band: null, maxPrice: null, sort: 'priority' }

/** Filters and sorts a list. Items without a price sort last and pass a price limit. */
export function applyFilter(items: Item[], f: ListFilter): Item[] {
  const out = items.filter(
    (it) =>
      (!f.occasion || it.occasions.includes(f.occasion)) &&
      (!f.band || priorityBand(it.priority) === f.band) &&
      (f.maxPrice === null || it.price === null || it.price <= f.maxPrice),
  )
  const byNewest = (a: Item, b: Item) => b.created_at.localeCompare(a.created_at)
  const priced = (a: Item, b: Item, dir: 1 | -1) =>
    a.price === null ? (b.price === null ? 0 : 1) : b.price === null ? -1 : (a.price - b.price) * dir
  const cmp: Record<SortKey, (a: Item, b: Item) => number> = {
    priority: (a, b) => b.priority - a.priority || byNewest(a, b),
    newest: byNewest,
    'price-low': (a, b) => priced(a, b, 1) || byNewest(a, b),
    'price-high': (a, b) => priced(a, b, -1) || byNewest(a, b),
  }
  return out.sort(cmp[f.sort])
}

const COUPLE_ORDER: Occasion[] = ['anniversary', 'valentines_day', 'birthday', 'holiday', 'just_because']

/** Occasions used by at least one item, in the standard order (a couple's own days first in a couple Circle). */
export function usedOccasions(items: Item[], couple = false): Occasion[] {
  const used = new Set(items.flatMap((i) => i.occasions))
  return (couple ? COUPLE_ORDER : OCCASIONS.map((o) => o.value)).filter((o) => used.has(o))
}

/** 3 hearts = Must have, 2 = Would love, 1 = Nice to have. */
export function heartCount(priority: number): 1 | 2 | 3 {
  const band = priorityBand(priority)
  return band === 'Must have' ? 3 : band === 'Would love' ? 2 : 1
}

/** The photo-booth date stamp: ’26 11 17. */
export function dateStamp(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}·${p(d.getMonth() + 1)}·${p(d.getFullYear() % 100)}`
}

const TINTS = ['#E8EEFF', '#FFF0E6', '#E6F5EC', '#FFF6DD', '#F1EAFF', '#FFEAF0', '#E3F4FF']

/** A pale photo tint picked from the item id, so it stays the same everywhere. */
export function tintFor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return TINTS[h % TINTS.length]
}

/** Adds https:// when someone pastes "amazon.in/…". Returns null for things that aren't web links. */
export function normalizeUrl(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null
  const withScheme = /^https?:\/\//i.test(raw) ? raw : /^[\w-]+(\.[\w-]+)+(\/|$)/.test(raw) ? `https://${raw}` : null
  if (!withScheme) return null
  try {
    const u = new URL(withScheme)
    return u.hostname.includes('.') ? u.toString() : null
  } catch {
    return null
  }
}

/**
 * A link found inside pasted text, as store apps share it:
 * "Samsung 25W Adapter https://amzn.in/d/abc12" → the link, plus the words as a first guess at the name.
 */
export function linkFromText(text: string): { url: string; title: string | null } | null {
  const raw = text.trim()
  if (!raw) return null
  const m = /https?:\/\/[^\s<>"'“”]+/i.exec(raw)
  if (!m) {
    const url = /\s/.test(raw) ? null : normalizeUrl(raw)
    return url ? { url, title: null } : null
  }
  const url = normalizeUrl(m[0].replace(/[).,;:!?\]}>»]+$/, ''))
  if (!url) return null
  const words = (raw.slice(0, m.index) + ' ' + raw.slice(m.index + m[0].length))
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(hey[,!]?\s*)?(look at|check (this|it) out|check out( this)?( product| item| deal)?( on [\w.]+)?|i found this( on [\w.]+)?|sharing( this)?( product)?( from [\w.]+)?)\s*[:!-]*\s*/i, '')
    .replace(/^(amazon|flipkart|myntra)(\.[a-z.]+)?\s*:\s*/i, '')
    .replace(/\s*[-:|–]\s*$/, '')
    .trim()
  return { url, title: words.length >= 3 && /[a-z]{2,}/i.test(words) ? words.slice(0, 300) : null }
}

/**
 * What another app sent through the Share menu (the manifest's `share_target`). Apps differ:
 * some put the link in `url`, most Android store apps put "Product name https://…" in `text`,
 * and `title` is often just the app's or store's name. Returns the link and the best name guess.
 */
export function sharedWish(shared: { title?: string; text?: string; url?: string }): { url: string; title: string | null } | null {
  const fromText = shared.text ? linkFromText(shared.text) : null
  const fromUrl = shared.url ? linkFromText(shared.url) : null
  const url = fromUrl?.url ?? fromText?.url
  if (!url) return null
  const t = shared.title?.replace(/\s+/g, ' ').trim() ?? ''
  // A bare store or app name ("Amazon", "Flipkart: Online Shopping App") or a link is not a product name.
  const usableTitle = t.length >= 3 && !/^https?:\/\//i.test(t) && !/^(amazon|flipkart|myntra|ajio|nykaa|meesho|croma|share|shared)\b[^a-z]*(\.[a-z.]+)?(\s*[:|-].*app.*)?$/i.test(t) ? t.slice(0, 300) : null
  return { url, title: fromText?.title ?? usableTitle }
}

/**
 * Store listing titles pack the specs into the name ("Samsung Galaxy M35 5G (Moonlight Blue, 8GB RAM) | 6000mAh
 * Battery | …"). Keep the brand and model as the name, and hand back the rest as details for Notes.
 */
export function shortName(raw: string): { name: string; details: string | null } {
  const s = raw.replace(/\s+/g, ' ').trim()
  if (s.length <= 50 && !s.includes('|')) return { name: s, details: null }
  // Where the specs usually start. Commas and "with/for" only count once the name has some length.
  const cuts: number[] = []
  for (const m of s.matchAll(/ ?\| | \(| \[| [-–—] |, | with | for /gi)) {
    const min = /^(, | with | for )$/i.test(m[0]) ? 20 : 12
    if (m.index >= min) cuts.push(m.index)
  }
  let cut = cuts.length ? Math.min(...cuts) : s.length
  if (cut > 60) {
    const space = s.lastIndexOf(' ', 60)
    cut = space > 12 ? space : 60
  }
  const name = s.slice(0, cut).replace(/[\s,:;|\-–—([]+$/, '').trim()
  let details = s
    .slice(cut)
    .replace(/^[\s,:;|\-–—]+/, '')
    .replace(/^\(([^)]*)\)/, '$1')
    .replace(/^\[([^\]]*)\]/, '$1')
    .replace(/\s*\|\s*/g, ' · ')
    .trim()
  if (details.length > 300) details = details.slice(0, details.lastIndexOf(' ', 299)).replace(/[\s,·;:]+$/, '') + '…'
  return { name: name || s.slice(0, 60), details: details || null }
}

/** Store name shown on a frame: www.amazon.in → amazon.in. */
export function storeOf(url: string | null): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return null
  }
}

/**
 * A first guess at a product name from its link, until link reading arrives:
 * amazon.in/Philips-TAS2400BK-Bluetooth-Speaker/dp/B0F8 → "Philips TAS2400BK Bluetooth Speaker".
 */
export function titleFromUrl(url: string): string {
  let path: string
  try {
    path = new URL(url).pathname
  } catch {
    return ''
  }
  const best = path
    .split('/')
    .map((s) => {
      try {
        return decodeURIComponent(s)
      } catch {
        return s
      }
    })
    .map((s) => s.replace(/\.(html?|php|aspx?)$/i, ''))
    .filter((s) => /[-_+]/.test(s) && /[a-z]{3,}/i.test(s))
    .sort((a, b) => b.length - a.length)[0]
  if (!best) return ''
  const words = best.split(/[-_+]+/).filter(Boolean)
  // Drop trailing ids such as "p-12345" or "B0F8W13YV4".
  while (words.length > 1 && /\d/.test(words[words.length - 1]) && !/[a-z]{3,}/.test(words[words.length - 1])) words.pop()
  const text = words.join(' ').slice(0, 120).trim()
  return text ? text[0].toUpperCase() + text.slice(1) : ''
}
