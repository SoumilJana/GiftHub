/**
 * Update notes ("what's new") for people who already had an account. Each note has a number;
 * the profile's `news_seen` holds the highest one seen, on any device. Welcome sets it to
 * LATEST_NEWS, so new people never get notes about things the intro already showed them.
 * Add a note: give it the next number and bump LATEST_NEWS.
 */
import { CIRCLE_TAB } from './intro'

export type NewsNote = {
  id: number
  title: string
  body: string
  stage: 'circle-tab' | 'add-button'
  /** Phone-only features skip desktop; notes about Circles skip people with none. */
  phoneOnly?: boolean
  needsCircle?: boolean
}

export const NEWS: NewsNote[] = [
  { id: 1, ...CIRCLE_TAB, stage: 'circle-tab', phoneOnly: true, needsCircle: true },
  {
    id: 2,
    title: 'Add a wish from anywhere',
    body: 'The paste bar moved to the + in the middle of the bottom bar. Tap it on any tab, paste a link, and GiftHub fills in the rest.',
    stage: 'add-button',
  },
]

export const LATEST_NEWS = Math.max(...NEWS.map((n) => n.id))

/** Before news_seen existed, the Circles-tab card was remembered on the device. */
const LEGACY_KEY = 'gifthub.dismissed.news-circle-tab'

/** The highest note this person has seen: from the profile, or the old device flag. */
export function seenUpTo(profileSeen: number): number {
  let legacy = 0
  try {
    legacy = localStorage.getItem(LEGACY_KEY) === '1' ? 1 : 0
  } catch {
    /* storage blocked */
  }
  return Math.max(profileSeen, legacy)
}

/** Notes still to show, in order. Pure, so it's easy to test. */
export function unseenNotes(seen: number, opts: { phone: boolean; hasCircle: boolean }): NewsNote[] {
  return NEWS.filter((n) => n.id > seen && (!n.phoneOnly || opts.phone) && (!n.needsCircle || opts.hasCircle))
}

// New people: after Welcome, one pointer at the + ("Add wishes from here"), on this device.
const POINTER_KEY = 'gifthub.pointer.add'

export function requestAddPointer() {
  try {
    localStorage.setItem(POINTER_KEY, '1')
  } catch {
    /* storage blocked: no pointer */
  }
}

export function addPointerPending(): boolean {
  try {
    return localStorage.getItem(POINTER_KEY) === '1'
  } catch {
    return false
  }
}

export function clearAddPointer() {
  try {
    localStorage.removeItem(POINTER_KEY)
  } catch {
    /* storage blocked */
  }
}
