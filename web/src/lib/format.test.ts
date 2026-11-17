import { describe, expect, it } from 'vitest'
import { formatPrice, priorityBand } from './format'

describe('priorityBand', () => {
  it('maps each band boundary', () => {
    expect(priorityBand(10)).toBe('Must have')
    expect(priorityBand(9)).toBe('Must have')
    expect(priorityBand(8)).toBe('Would love')
    expect(priorityBand(6)).toBe('Would love')
    expect(priorityBand(5)).toBe('Nice to have')
    expect(priorityBand(1)).toBe('Nice to have')
  })

  it('rejects values outside 1–10', () => {
    expect(() => priorityBand(0)).toThrow(RangeError)
    expect(() => priorityBand(11)).toThrow(RangeError)
    expect(() => priorityBand(7.5)).toThrow(RangeError)
  })
})

describe('formatPrice', () => {
  it('uses the item currency', () => {
    expect(formatPrice(39.9, 'GBP', 'en-GB')).toBe('£39.90')
    expect(formatPrice(169, 'USD', 'en-US')).toBe('$169.00')
  })
})
