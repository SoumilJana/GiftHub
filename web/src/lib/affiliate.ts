/**
 * Amazon Associates: GiftHub's tag is added to Amazon links at the moment someone opens one.
 * Each Amazon country is its own program with its own tag, so the tag follows the link's store
 * (amazon.in or amazon.com), not where the person is.
 * Saved wishes are never changed, so a tag can be changed or removed with one edit here.
 * Tags are public by design (they show in every tagged link), so they live in code, not in a secret.
 */
export const AMAZON_TAGS: Record<string, string> = {
  'amazon.in': 'gifthub0e-21',
  'amazon.com': 'gifthub0c-20',
}

/**
 * www.amazon.in → amazon.in, m.amazon.com → amazon.com; null for anything else.
 * amzn.in / amzn.to short links are not covered: Amazon doesn't reliably keep a tag on those.
 */
function amazonStore(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    const host = u.hostname.toLowerCase().replace(/^(?:www\.|m\.)/, '')
    return host in AMAZON_TAGS ? host : null
  } catch {
    return null
  }
}

/** True when this wish opens on an Amazon store GiftHub tags (used to show the disclosure line). */
export const isTaggedAmazon = (url: string | null | undefined) => amazonStore(url) !== null

/**
 * The link to open in the store. Amazon links get GiftHub's tag for that store; a link that
 * already carries a tag (someone else's) is left exactly as it is, and so is every other link.
 */
export function storeLink(url: string): string {
  const store = amazonStore(url)
  if (!store) return url
  const u = new URL(url)
  if (u.searchParams.has('tag')) return url
  u.searchParams.set('tag', AMAZON_TAGS[store])
  return u.toString()
}
