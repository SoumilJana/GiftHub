import { describe, expect, it } from 'vitest'
import { cleanCode, inviteLink, normalizeInviteCode } from './invite'

describe('normalizeInviteCode', () => {
  it('accepts a bare code in any case', () => {
    expect(normalizeInviteCode('k7qx3m')).toBe('K7QX3M')
    expect(normalizeInviteCode('  K7QX3M ')).toBe('K7QX3M')
  })

  it('accepts codes with spaces or a dash', () => {
    expect(normalizeInviteCode('K7Q X3M')).toBe('K7QX3M')
    expect(normalizeInviteCode('K7Q-X3M')).toBe('K7QX3M')
  })

  it('reads the code out of a join link', () => {
    expect(normalizeInviteCode('https://gifthub.grave07.workers.dev/join/K7QX3M')).toBe('K7QX3M')
    expect(normalizeInviteCode('Join me: https://x.dev/join/k7qx3m?ref=1')).toBe('K7QX3M')
  })

  it('rejects ambiguous or wrong-length codes', () => {
    expect(normalizeInviteCode('K7QX30')).toBeNull() // 0 is not in the alphabet
    expect(normalizeInviteCode('K7QXIM')).toBeNull() // I is not in the alphabet
    expect(normalizeInviteCode('K7QX3')).toBeNull()
    expect(normalizeInviteCode('')).toBeNull()
  })
})

describe('inviteLink', () => {
  it('builds a join link', () => {
    expect(inviteLink('K7QX3M', null, 'https://gifthub.grave07.workers.dev')).toBe('https://gifthub.grave07.workers.dev/join/K7QX3M')
  })
  it('adds the inviter’s first name only', () => {
    expect(inviteLink('K7QX3M', '  Zoë Anne Smith ', 'https://x.dev')).toBe('https://x.dev/join/K7QX3M?from=Zo%C3%AB')
  })
})

describe('cleanCode', () => {
  it('keeps code characters, uppercased, up to six', () => {
    expect(cleanCode('k7q x3-m99')).toBe('K7QX3M')
  })
  it('drops look-alike characters the codes never use', () => {
    expect(cleanCode('O0I1L')).toBe('')
  })
  it('reads a pasted join link', () => {
    expect(cleanCode('https://gifthub.grave07.workers.dev/join/K7QX3M?from=Maya')).toBe('K7QX3M')
  })
})
