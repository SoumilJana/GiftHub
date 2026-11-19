/** Invite codes use 31 characters with no 0/O, 1/I/L (matches the database check). */
const CODE = /^[A-HJKMNP-Z2-9]{6}$/

/**
 * Reads an invite code from whatever the person pasted: the bare code,
 * the code with spaces or a dash, or a full join link.
 * Returns null when it isn't a valid code.
 */
export function normalizeInviteCode(input: string): string | null {
  const trimmed = input.trim()
  const fromLink = trimmed.match(/\/join\/([^/?#\s]+)/i)
  const raw = (fromLink ? fromLink[1] : trimmed).replace(/[\s-]/g, '').toUpperCase()
  return CODE.test(raw) ? raw : null
}

/** The join link; with the inviter's first name, the invite screen can say who sent it. */
export function inviteLink(code: string, from?: string | null, origin: string = window.location.origin): string {
  const first = from?.trim().split(/\s+/)[0]
  return `${origin}/join/${code}${first ? `?from=${encodeURIComponent(first)}` : ''}`
}

const PENDING_KEY = 'gifthub.pendingJoin'

/** Remembers a join code across sign-in (per browser; safe to lose). */
export function savePendingJoin(code: string) {
  try {
    localStorage.setItem(PENDING_KEY, code)
  } catch {
    /* storage unavailable: the person can open the link again */
  }
}

export function readPendingJoin(): string | null {
  try {
    const v = localStorage.getItem(PENDING_KEY)
    return v ? normalizeInviteCode(v) : null
  } catch {
    return null
  }
}

export function clearPendingJoin() {
  try {
    localStorage.removeItem(PENDING_KEY)
  } catch {
    /* nothing to clear */
  }
}
