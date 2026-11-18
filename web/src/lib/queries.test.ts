import { describe, expect, it } from 'vitest'
import { circleRef, circleTitle } from './queries'
import { usedOccasions, type Item } from './wishlist'

const me = { user_id: 'me', display_name: 'Sam Rivera' }
const maya = { user_id: 'maya', display_name: 'Maya Chen' }

describe('circle names', () => {
  it('uses a set name', () => expect(circleTitle({ name: 'Us', kind: 'couple' }, [me, maya], 'me')).toBe('Us'))
  it('shows an unnamed couple Circle from each side', () => {
    expect(circleTitle({ name: null, kind: 'couple' }, [me, maya], 'me')).toBe('You and Maya')
    expect(circleTitle({ name: null, kind: 'couple' }, [me, maya], 'maya')).toBe('You and Sam')
  })
  it('waits for the partner', () => expect(circleTitle({ name: null, kind: 'couple' }, [me], 'me')).toBe('Your couple Circle'))
  it('names the partner inside a sentence', () => {
    expect(circleRef({ name: null, kind: 'couple' }, [me, maya], 'me')).toBe('Maya')
    expect(circleRef({ name: 'Family', kind: 'group' }, [me, maya], 'me')).toBe('Family')
  })
})

describe('couple occasion order', () => {
  const item = { occasions: ['birthday', 'valentines_day', 'anniversary'] } as Item
  it('puts a couple’s own days first', () => expect(usedOccasions([item], true)).toEqual(['anniversary', 'valentines_day', 'birthday']))
  it('keeps the standard order for groups', () => expect(usedOccasions([item])).toEqual(['birthday', 'anniversary', 'valentines_day']))
})
