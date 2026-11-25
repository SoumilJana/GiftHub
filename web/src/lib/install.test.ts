import { describe, expect, it } from 'vitest'
import { installMode } from './install'

const android = 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'
const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'
const iphoneChrome = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1'
const iphoneInstagram = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0'
const macSafari = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15'
const macChrome = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
const firefox = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0'

const base = { standalone: false, canPrompt: false, touch: false }

describe('installMode', () => {
  it('knows when it is already installed', () => {
    expect(installMode(android, { ...base, standalone: true, canPrompt: true })).toBe('installed')
  })
  it('uses the browser dialog when one is offered', () => {
    expect(installMode(android, { ...base, canPrompt: true })).toBe('prompt')
    expect(installMode(macChrome, { ...base, canPrompt: true })).toBe('prompt')
  })
  it('shows the Share steps on iPhone, in Safari and Chrome', () => {
    expect(installMode(iphone, { ...base, touch: true })).toBe('ios')
    expect(installMode(iphoneChrome, { ...base, touch: true })).toBe('ios')
  })
  it('treats an iPad that reports itself as a Mac as iOS', () => {
    expect(installMode(macSafari, { ...base, touch: true })).toBe('ios')
  })
  it('asks to open Safari first inside another app', () => {
    expect(installMode(iphoneInstagram, { ...base, touch: true })).toBe('ios-in-app')
  })
  it('offers Add to Dock in Safari on a Mac', () => {
    expect(installMode(macSafari, base)).toBe('mac-safari')
  })
  it('has nothing to offer otherwise', () => {
    expect(installMode(firefox, base)).toBe('none')
    expect(installMode(android, base)).toBe('none')
  })
})
