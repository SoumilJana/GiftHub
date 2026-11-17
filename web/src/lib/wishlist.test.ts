import { describe, expect, it } from 'vitest'
import { applyFilter, dateStamp, defaultFilter, heartCount, normalizeUrl, storeOf, titleFromUrl, usedOccasions, type Item } from './wishlist'

const item = (over: Partial<Item>): Item => ({
  id: 'x',
  owner_id: 'o',
  title: 't',
  url: null,
  image_url: null,
  domain: null,
  price: null,
  currency: 'INR',
  original_price: null,
  priority: 5,
  notes: null,
  created_at: '2026-11-10T00:00:00Z',
  occasions: [],
  circle_ids: [],
  ...over,
})

const a = item({ id: 'a', priority: 9, price: 500, occasions: ['birthday'], created_at: '2026-11-01T00:00:00Z' })
const b = item({ id: 'b', priority: 3, price: 100, occasions: ['holiday'], created_at: '2026-11-03T00:00:00Z' })
const c = item({ id: 'c', priority: 7, price: null, occasions: ['birthday', 'holiday'], created_at: '2026-11-02T00:00:00Z' })
const ids = (xs: Item[]) => xs.map((x) => x.id)

describe('applyFilter', () => {
  it('sorts by priority by default', () => expect(ids(applyFilter([b, c, a], defaultFilter))).toEqual(['a', 'c', 'b']))
  it('sorts newest first', () => expect(ids(applyFilter([a, b, c], { ...defaultFilter, sort: 'newest' }))).toEqual(['b', 'c', 'a']))
  it('puts unpriced items last in both price sorts', () => {
    expect(ids(applyFilter([a, b, c], { ...defaultFilter, sort: 'price-low' }))).toEqual(['b', 'a', 'c'])
    expect(ids(applyFilter([a, b, c], { ...defaultFilter, sort: 'price-high' }))).toEqual(['a', 'b', 'c'])
  })
  it('filters by occasion, band and max price', () => {
    expect(ids(applyFilter([a, b, c], { ...defaultFilter, occasion: 'birthday' }))).toEqual(['a', 'c'])
    expect(ids(applyFilter([a, b, c], { ...defaultFilter, band: 'Would love' }))).toEqual(['c'])
    expect(ids(applyFilter([a, b, c], { ...defaultFilter, maxPrice: 200 }))).toEqual(['c', 'b'])
  })
})

describe('helpers', () => {
  it('lists used occasions in standard order', () => expect(usedOccasions([b, a])).toEqual(['birthday', 'holiday']))
  it('maps priority to hearts', () => expect([10, 9, 8, 6, 5, 1].map(heartCount)).toEqual([3, 3, 2, 2, 1, 1]))
  it('formats the date stamp', () => expect(dateStamp('2026-11-07T12:00:00')).toBe('’26 11 07'))
  it('normalizes pasted links', () => {
    expect(normalizeUrl('amazon.in/dp/B0F8')).toBe('https://amazon.in/dp/B0F8')
    expect(normalizeUrl(' https://Example.com/x ')).toBe('https://example.com/x')
    expect(normalizeUrl('a nice lamp')).toBeNull()
    expect(normalizeUrl('ftp://x.com')).toBeNull()
  })
  it('names the store', () => expect(storeOf('https://www.Amazon.in/x')).toBe('amazon.in'))
  it('guesses a title from the link', () => {
    expect(titleFromUrl('https://www.amazon.in/Philips-TAS2400BK-Bluetooth-Speaker/dp/B0F8W13YV4')).toBe('Philips TAS2400BK Bluetooth Speaker')
    expect(titleFromUrl('https://shop.com/products/linen-overshirt-sage-12345.html')).toBe('Linen overshirt sage')
    expect(titleFromUrl('https://www.amazon.in/dp/B0F8W13YV4')).toBe('')
  })
})
