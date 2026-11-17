import { describe, expect, it } from 'vitest'
import { browserAndSystem } from '../components/BugReport'

describe('browserAndSystem', () => {
  it('names the browser and system', () => {
    const android = 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'
    expect(browserAndSystem(android)).toBe('Chrome 130 on Android 15')
    const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'
    expect(browserAndSystem(iphone)).toBe('Safari 18 on iOS 18')
  })
})
