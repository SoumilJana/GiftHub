/**
 * The intro cards are the front door: every signed-out visit starts there, and once someone
 * moves on to sign-in they aren't sent back for the rest of that visit (this browser tab).
 */
const KEY = 'gifthub.introSeen'

export function introSeen(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    // Storage blocked: don't trap people in the intro.
    return true
  }
}

export function markIntroSeen() {
  try {
    sessionStorage.setItem(KEY, '1')
  } catch {
    /* storage blocked: introSeen() already lets them through */
  }
}

/** First name for an invite link's "Maya invited you". Display only; never trusted. */
export function inviterFromSearch(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const name = raw.replace(/[\p{C}<>]/gu, '').trim().split(/\s+/)[0] ?? ''
  return name && name.length <= 30 ? name : null
}

/** The Circles-tab card: in the intro, and shown on its own once to people who signed up before it (components/WhatsNew.tsx). */
export const CIRCLE_TAB = {
  title: 'Your Circle, one tap away',
  body: 'Pick a Circle at the top right and the Circles tab opens straight to it. In just one Circle? It opens right away.',
}

/** Dismissed-key for that card. New people mark it seen in Welcome, since the intro already showed it. */
export const CIRCLE_TAB_NEWS = 'news-circle-tab'
