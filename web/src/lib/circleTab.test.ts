import { describe, expect, it } from 'vitest'
import { currentCircle } from './circleTab'

const group = (id: string) => ({ id, kind: 'group' })
const couple = (id: string) => ({ id, kind: 'couple' })

describe('currentCircle', () => {
  it('opens the picked Circle', () => expect(currentCircle([couple('a'), group('b')], 'b')?.id).toBe('b'))
  it('opens the only Circle', () => expect(currentCircle([group('a')], null)?.id).toBe('a'))
  it('falls back to the couple Circle when the picked one was left', () => expect(currentCircle([group('a'), couple('b')], 'gone')?.id).toBe('b'))
  it('falls back to the first Circle with no couple Circle', () => expect(currentCircle([group('a'), group('b')], null)?.id).toBe('a'))
  it('has nothing to open with no Circles', () => expect(currentCircle([], 'a')).toBeNull())
})
