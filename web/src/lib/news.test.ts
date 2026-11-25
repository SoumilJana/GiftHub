import { describe, expect, it } from 'vitest'
import { LATEST_NEWS, unseenNotes } from './news'

const ids = (seen: number, phone: boolean, hasCircle: boolean) => unseenNotes(seen, { phone, hasCircle }).map((n) => n.id)

describe('unseenNotes', () => {
  it('shows everything not yet seen, in order', () => {
    expect(ids(0, true, true)).toEqual([1, 2])
    expect(ids(1, true, true)).toEqual([2])
  })
  it('shows nothing once the latest is seen (new people, after Welcome)', () => {
    expect(ids(LATEST_NEWS, true, true)).toEqual([])
  })
  it('skips the Circles-tab note on a computer or without a Circle', () => {
    expect(ids(0, false, true)).toEqual([2])
    expect(ids(0, true, false)).toEqual([2])
  })
})
