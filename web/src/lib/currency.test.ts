import { describe, expect, it } from 'vitest'
import { currencyForNewItem, currencyFromUrl, currencyOptions, detectUserCurrency, isCurrencyCode } from './currency'

describe('currencyFromUrl', () => {
  it('reads the store country from the domain', () => {
    expect(currencyFromUrl('https://www.amazon.in/dp/B0DY2VVZWZ')).toBe('INR')
    expect(currencyFromUrl('https://www.amazon.co.uk/dp/X')).toBe('GBP')
    expect(currencyFromUrl('https://www.amazon.de/dp/X')).toBe('EUR')
    expect(currencyFromUrl('https://www.amazon.com.au/dp/X')).toBe('AUD')
    expect(currencyFromUrl('https://www.amazon.co.jp/dp/X')).toBe('JPY')
  })

  it('returns null when the domain does not say', () => {
    expect(currencyFromUrl('https://www.amazon.com/dp/X')).toBeNull()
    expect(currencyFromUrl('https://www.etsy.com/listing/1')).toBeNull()
    expect(currencyFromUrl('not a url')).toBeNull()
  })
})

describe('detectUserCurrency', () => {
  it('prefers the time zone over the browser language', () => {
    expect(detectUserCurrency(['en-US'], 'Asia/Kolkata')).toBe('INR')
  })

  it('falls back to the language region', () => {
    expect(detectUserCurrency(['en-GB'], 'UTC')).toBe('GBP')
    expect(detectUserCurrency(['de-DE', 'en'], 'UTC')).toBe('EUR')
  })

  it('falls back to USD when nothing matches', () => {
    expect(detectUserCurrency(['en'], 'UTC')).toBe('USD')
    expect(detectUserCurrency([], 'UTC')).toBe('USD')
  })
})

describe('currencyForNewItem', () => {
  it('uses the store currency when known, else the user currency', () => {
    expect(currencyForNewItem('https://www.amazon.in/dp/X', 'USD')).toBe('INR')
    expect(currencyForNewItem('https://www.etsy.com/listing/1', 'INR')).toBe('INR')
    expect(currencyForNewItem(null, 'GBP')).toBe('GBP')
  })
})

describe('isCurrencyCode / currencyOptions', () => {
  it('validates ISO codes', () => {
    expect(isCurrencyCode('INR')).toBe(true)
    expect(isCurrencyCode('inr')).toBe(false)
    expect(isCurrencyCode('RUPEES')).toBe(false)
  })

  it('lists readable currency names including INR', () => {
    const opts = currencyOptions('en')
    expect(opts.find((o) => o.code === 'INR')?.name).toBe('Indian Rupee')
    expect(opts.length).toBeGreaterThan(100)
  })
})
