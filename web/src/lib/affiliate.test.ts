import { describe, expect, it } from 'vitest'
import { AMAZON_TAGS, isTaggedAmazon, storeLink } from './affiliate'

const IN = AMAZON_TAGS['amazon.in']
const US = AMAZON_TAGS['amazon.com']

describe('storeLink', () => {
  it('adds the India tag to amazon.in links', () => {
    expect(storeLink('https://www.amazon.in/dp/B0D2R2MXXJ')).toBe(`https://www.amazon.in/dp/B0D2R2MXXJ?tag=${IN}`)
    expect(storeLink('https://amazon.in/dp/B0F8')).toBe(`https://amazon.in/dp/B0F8?tag=${IN}`)
    expect(storeLink('https://m.amazon.in/dp/B0F8')).toBe(`https://m.amazon.in/dp/B0F8?tag=${IN}`)
  })

  it('adds the US tag to amazon.com links', () => {
    expect(storeLink('https://www.amazon.com/dp/B0F8')).toBe(`https://www.amazon.com/dp/B0F8?tag=${US}`)
    expect(IN).toMatch(/-21$/)
    expect(US).toMatch(/-20$/)
  })

  it('keeps other query parts', () => {
    expect(storeLink('https://www.amazon.in/dp/B0F8?th=1')).toBe(`https://www.amazon.in/dp/B0F8?th=1&tag=${IN}`)
  })

  it('leaves a link that already has a tag alone', () => {
    const theirs = 'https://www.amazon.in/dp/B0F8?tag=someone-21'
    expect(storeLink(theirs)).toBe(theirs)
  })

  it('leaves short links, other Amazons and other stores alone', () => {
    for (const url of [
      'https://amzn.in/d/1aBcD2e',
      'https://amzn.to/3xyz',
      'https://www.amazon.co.uk/dp/B0F8',
      'https://www.amazon.de/dp/B0F8',
      'https://www.flipkart.com/p/itm123',
      'https://www.amazon.in.example.com/dp/B0F8',
      'https://notamazon.in/dp/B0F8',
      'https://smile.amazon.co.jp/dp/B0F8',
    ]) {
      expect(storeLink(url)).toBe(url)
    }
  })

  it('leaves odd input alone', () => {
    expect(storeLink('not a link')).toBe('not a link')
    expect(storeLink('javascript:alert(1)')).toBe('javascript:alert(1)')
  })
})

describe('isTaggedAmazon', () => {
  it('spots amazon.in and amazon.com links only', () => {
    expect(isTaggedAmazon('https://www.amazon.in/dp/B0F8')).toBe(true)
    expect(isTaggedAmazon('https://www.amazon.com/dp/B0F8')).toBe(true)
    expect(isTaggedAmazon('https://amzn.in/d/x')).toBe(false)
    expect(isTaggedAmazon('https://www.amazon.co.uk/dp/B0F8')).toBe(false)
    expect(isTaggedAmazon(null)).toBe(false)
    expect(isTaggedAmazon('')).toBe(false)
  })
})
