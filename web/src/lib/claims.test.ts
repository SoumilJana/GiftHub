import { describe, expect, it } from 'vitest'
import { dayLabel, localDate } from './claims'

describe('hand-off dates', () => {
  it('formats the device date as YYYY-MM-DD', () => {
    expect(localDate(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
  it('reads YYYY-MM-DD as a local day', () => {
    expect(dayLabel('2026-11-24', 'short')).toMatch(/24/)
  })
})
