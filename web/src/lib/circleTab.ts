/** The Circle picked in the phone's top-right switcher (or opened last), remembered on this device. */
const LAST_KEY = 'gifthub.lastCircle'

export function readLastCircle(): string | null {
  try {
    return localStorage.getItem(LAST_KEY)
  } catch {
    return null
  }
}

export function rememberCircle(id: string) {
  try {
    localStorage.setItem(LAST_KEY, id)
  } catch {
    /* private mode: not remembered */
  }
}

/**
 * The Circle shown in the phone's top-right switcher, and where the Circles tab goes: the one
 * picked (or opened) last if you're still in it, else your couple Circle, else the first.
 * No Circles: null, and the tab shows the page for starting or joining one.
 */
export function currentCircle<C extends { id: string; kind: string }>(circles: C[], last: string | null): C | null {
  return circles.find((c) => c.id === last) ?? circles.find((c) => c.kind === 'couple') ?? circles[0] ?? null
}
