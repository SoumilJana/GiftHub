import { describe, expect, it } from 'vitest'
import { applyFilter, dateStamp, defaultFilter, heartCount, linkFromText, normalizeUrl, sharedWish, shortName, storeOf, titleFromUrl, usedOccasions, type Item } from './wishlist'

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
  it('formats the date stamp', () => expect(dateStamp('2026-11-07T12:00:00')).toBe('07·11·26'))
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

describe('shortName', () => {
  it('keeps short names as they are', () => {
    expect(shortName('Samsung Original 25W Travel Adapter, Black')).toEqual({ name: 'Samsung Original 25W Travel Adapter, Black', details: null })
    expect(shortName('Apple iPhone 15 (128 GB) - Black')).toEqual({ name: 'Apple iPhone 15 (128 GB) - Black', details: null })
    expect(shortName('  boAt   Airdopes 141 ')).toEqual({ name: 'boAt Airdopes 141', details: null })
  })
  it('cuts long store titles where the specs start', () => {
    expect(shortName('Samsung Galaxy M35 5G (Moonlight Blue, 8GB RAM, 128GB Storage) | 6000mAh Battery | 50MP Triple Camera')).toEqual({
      name: 'Samsung Galaxy M35 5G',
      details: 'Moonlight Blue, 8GB RAM, 128GB Storage · 6000mAh Battery · 50MP Triple Camera',
    })
    expect(shortName('Philips TAS2400BK Bluetooth Speaker | 10W Output | IPX7 Waterproof | 12 Hours Playtime').name).toBe('Philips TAS2400BK Bluetooth Speaker')
    expect(shortName('Milton Thermosteel Flip Lid Flask, 1000 ml, Silver | 24 Hours Hot and Cold | Easy to Carry').name).toBe('Milton Thermosteel Flip Lid Flask')
    expect(shortName('Noise Buds VS104 Truly Wireless Earbuds with 45H of Playtime, Quad Mic with ENC, Instacharge').name).toBe('Noise Buds VS104 Truly Wireless Earbuds')
  })
  it('caps a long title with no separators on a whole word', () => {
    const r = shortName('Lenovo IdeaPad Slim 3 13th Gen Intel Core i5-13420H 15.3 inch WUXGA IPS Laptop 16GB 512GB SSD Windows 11 Office')
    expect(r.name).toBe('Lenovo IdeaPad Slim 3 13th Gen Intel Core i5-13420H 15.3')
    expect(r.details).toBe('inch WUXGA IPS Laptop 16GB 512GB SSD Windows 11 Office')
  })
})

describe('linkFromText', () => {
  it('finds the link in text shared by store apps', () => {
    expect(linkFromText('Samsung Original 25W Travel Adapter, Black https://amzn.in/d/1aBcD2e')).toEqual({
      url: 'https://amzn.in/d/1aBcD2e',
      title: 'Samsung Original 25W Travel Adapter, Black',
    })
    expect(linkFromText('Check out this product on Flipkart: Noise TWO Earbuds\nhttps://dl.flipkart.com/s/abc123.')).toEqual({
      url: 'https://dl.flipkart.com/s/abc123',
      title: 'Noise TWO Earbuds',
    })
    expect(linkFromText('Amazon.in: OnePlus Nord Buds 3r https://www.amazon.in/dp/B0FMDL81GS?ref=x')?.title).toBe('OnePlus Nord Buds 3r')
  })
  it('handles a bare link, with or without https', () => {
    expect(linkFromText('  https://www.myntra.com/x/123/buy ')).toEqual({ url: 'https://www.myntra.com/x/123/buy', title: null })
    expect(linkFromText('www.ajio.com/shirt/p/1')).toEqual({ url: 'https://www.ajio.com/shirt/p/1', title: null })
  })
  it('gives no name when the words are only filler', () => {
    expect(linkFromText('Check this out: https://amzn.in/d/xyz')).toEqual({ url: 'https://amzn.in/d/xyz', title: null })
  })
  it('returns nothing without a link', () => {
    expect(linkFromText('just some words')).toBeNull()
    expect(linkFromText('')).toBeNull()
  })
})

describe('sharedWish', () => {
  it('takes the link and name from store-app share text', () => {
    expect(sharedWish({ title: 'Amazon', text: 'Samsung Original 25W Travel Adapter, Black https://amzn.in/d/1aBcD2e' })).toEqual({
      url: 'https://amzn.in/d/1aBcD2e',
      title: 'Samsung Original 25W Travel Adapter, Black',
    })
  })
  it('prefers the url field and uses a real title', () => {
    expect(sharedWish({ title: 'Marble table lamp', url: 'https://www.ikea.com/in/en/p/evedal-lamp-123/' })).toEqual({
      url: 'https://www.ikea.com/in/en/p/evedal-lamp-123/',
      title: 'Marble table lamp',
    })
  })
  it('ignores a title that is only the store or app name', () => {
    expect(sharedWish({ title: 'Flipkart: Online Shopping App', text: 'https://dl.flipkart.com/s/abc123' })?.title).toBeNull()
    expect(sharedWish({ title: 'https://dl.flipkart.com/s/abc123', url: 'https://dl.flipkart.com/s/abc123' })?.title).toBeNull()
  })
  it('returns nothing when no link was shared', () => {
    expect(sharedWish({ title: 'A photo', text: 'look at this' })).toBeNull()
    expect(sharedWish({})).toBeNull()
  })
})
