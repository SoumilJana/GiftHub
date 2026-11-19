import { describe, expect, it } from 'vitest'
import { cleanUrl, extract, isPublicIp, looksBlocked, safeTarget, toPrice } from '../../../supabase/functions/_shared/parse.ts'

describe('cleanUrl', () => {
  it('cuts Amazon links down to the product', () => {
    expect(cleanUrl('https://www.amazon.in/Samsung-Original-Adapter/dp/B0D2R2MXXJ/ref=sr_1_3?crid=X&keywords=charger&qid=1&th=1')).toBe(
      'https://www.amazon.in/dp/B0D2R2MXXJ',
    )
    expect(cleanUrl('https://www.amazon.in/gp/product/b0ddhm6d3l?psc=1')).toBe('https://www.amazon.in/dp/B0DDHM6D3L')
  })
  it('keeps only the product id on Flipkart', () => {
    expect(cleanUrl('https://dl.flipkart.com/noise-two/p/itm8b9860f746f9a?pid=ACCGGXFHYJKAAFGD&lid=LST&marketplace=FLIPKART&srno=s_1_1')).toBe(
      'https://www.flipkart.com/noise-two/p/itm8b9860f746f9a?pid=ACCGGXFHYJKAAFGD',
    )
  })
  it('drops tracking parameters elsewhere but keeps the rest', () => {
    expect(cleanUrl('https://shop.example.co/products/mug?variant=42&utm_source=ig&fbclid=abc#reviews')).toBe('https://shop.example.co/products/mug?variant=42')
  })
})

describe('safeTarget', () => {
  it('accepts ordinary store pages', () => {
    expect(safeTarget('https://www.myntra.com/x/123/buy')).not.toBeNull()
  })
  it('refuses addresses that could reach private machines', () => {
    for (const bad of ['http://127.0.0.1/', 'http://10.0.0.1/admin', 'https://[::1]/', 'http://localhost:8787/', 'https://router.local/', 'https://intranet/', 'ftp://a.com/x', 'https://a.com:8443/', 'https://user:pw@a.com/', 'javascript:alert(1)'])
      expect(safeTarget(bad), bad).toBeNull()
  })
})

describe('toPrice', () => {
  it('reads common formats', () => {
    expect(toPrice('₹1,699.00')).toBe(1699)
    expect(toPrice('1.699,50')).toBe(1699.5)
    expect(toPrice(39.9)).toBe(39.9)
    expect(toPrice('Free')).toBeNull()
  })
})

const page = (head: string, body = '') => `<!doctype html><html><head>${head}</head><body>${body}</body></html>`

describe('extract', () => {
  it('prefers JSON-LD Product data', () => {
    const html = page(
      `<title>Buy Noise TWO Online at Best Price | Flipkart.com</title>
       <meta property="og:title" content="Something else">
       <script type="application/ld+json">[{"@context":"https://schema.org","@type":"Product","name":"Noise TWO &amp; Case","image":["https://img.example/n.jpg"],"offers":{"@type":"Offer","price":"1699","priceCurrency":"INR"}}]</script>`,
    )
    expect(extract(html, 'https://www.flipkart.com/noise/p/itm1')).toEqual({
      store: 'flipkart.com',
      title: 'Noise TWO & Case',
      image: 'https://img.example/n.jpg',
      price: 1699,
      currency: 'INR',
      confidence: 1,
    })
  })

  it('finds products inside @graph and offer lists', () => {
    const html = page(
      `<script type="application/ld+json">{"@graph":[{"@type":"WebPage"},{"@type":["Product"],"name":"Bottle","image":{"url":"/img/b.png"},"offers":[{"price":99,"priceCurrency":"inr"}]}]}</script>`,
    )
    const r = extract(html, 'https://www.decathlon.in/p/1/bottle')
    expect(r.title).toBe('Bottle')
    expect(r.image).toBe('https://www.decathlon.in/img/b.png')
    expect(r.price).toBe(99)
    expect(r.currency).toBe('INR')
  })

  it('reads Amazon pages without structured data', () => {
    const html = page(
      '<title>Amazon.in: Samsung 25W Adapter : Electronics</title>',
      `<span id="productTitle" class="a-size-large">   Samsung Original 25W Travel Adapter   </span>
       <span class="a-price-symbol">₹</span><span class="a-price-whole">1,299<span class="a-price-decimal">.</span></span><span class="a-price-fraction">00</span>
       <img id="landingImage" data-old-hires="https://m.media-amazon.com/images/I/512U.jpg" src="https://m.media-amazon.com/images/I/small.jpg">`,
    )
    expect(extract(html, 'https://www.amazon.in/dp/B0D2R2MXXJ')).toMatchObject({
      title: 'Samsung Original 25W Travel Adapter',
      image: 'https://m.media-amazon.com/images/I/512U.jpg',
      price: 1299,
      currency: 'INR',
    })
  })

  it('falls back to Open Graph and tidies store suffixes', () => {
    const html = page(`<meta property="og:title" content="Saregama Carvaan Mini Kids - FirstCry"><meta property="og:image" content="https://cdn.fcglcdn.com/a.jpg">`)
    expect(extract(html, 'https://www.firstcry.com/x/10293931/product-detail')).toMatchObject({
      title: 'Saregama Carvaan Mini Kids',
      image: 'https://cdn.fcglcdn.com/a.jpg',
      price: null,
      currency: null,
      confidence: 0.7,
    })
  })
})

describe('looksBlocked', () => {
  it('spots refusals and captcha pages', () => {
    expect(looksBlocked(403, '')).toBe(true)
    expect(looksBlocked(200, '<title>Amazon.in</title><p>Enter the characters you see below</p>')).toBe(true)
    expect(looksBlocked(200, '<title>Site Maintenance</title>')).toBe(true)
  })
  it('lets real product pages through', () => {
    expect(looksBlocked(200, page('<title>Noise TWO</title>', 'x'.repeat(20000) + ' access denied to reviews '))).toBe(false)
  })
})

describe('store data the page keeps outside tags', () => {
  it('reads the Croma selling price', () => {
    const html = '<title>Croma 30W Speaker</title><meta property="og:image" content="https://media.croma.com/a.png">'
      + '<script>{"pdpPriceReducer":{"pdpPriceData":{"sellingPrice":{"value":"4694.00"},"mrp":{"value":"8000.00"}}}}</script>'
    const x = extract(html, 'https://www.croma.com/croma-30w-speaker/p/303051')
    expect([x.price, x.currency]).toEqual([4694, 'INR'])
  })
  it('works out the FirstCry price for this product, not the ones recommended beside it', () => {
    const html = '<title>Labubu keychain</title><meta property="og:image" content="https://cdn.fcglcdn.com/a.jpg">'
      + '{"Dis":10,"mrp":5000,"pid":111}{"Dis":78.55,"SDis":0,"mrp":999,"pd":"Keychain toy","pid":20630432,"pn":"Labubu"}'
    expect(extract(html, 'https://www.firstcry.com/yamama/labubu/20630432/product-detail').price).toBe(214)
  })
})

describe('isPublicIp', () => {
  it('refuses private, local and cloud-metadata addresses', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', '::', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:7f00:1'])
      expect(isPublicIp(ip), ip).toBe(false)
  })
  it('allows ordinary public addresses', () => {
    for (const ip of ['8.8.8.8', '104.16.0.1', '172.32.0.1', '2606:4700::1111', '::ffff:8.8.8.8']) expect(isPublicIp(ip), ip).toBe(true)
  })
})
