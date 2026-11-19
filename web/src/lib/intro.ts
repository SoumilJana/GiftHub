/** The three-card intro shows once per device (it's also linked from Help). */
const KEY = 'gifthub.introSeen'

export function introSeen(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    // Storage blocked: don't trap people in the intro on every visit.
    return true
  }
}

export function markIntroSeen() {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    /* private mode: it may show again next visit */
  }
}

/** First name for an invite link's "Maya invited you". Display only; never trusted. */
export function inviterFromSearch(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const name = raw.replace(/[\p{C}<>]/gu, '').trim().split(/\s+/)[0] ?? ''
  return name && name.length <= 30 ? name : null
}
