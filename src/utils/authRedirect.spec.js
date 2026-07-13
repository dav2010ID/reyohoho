import { beforeEach, describe, expect, it } from 'vitest'
import { consumeAuthRedirect, normalizeAuthRedirect, saveAuthRedirect } from './authRedirect'

describe('auth redirect', () => {
  beforeEach(() => window.sessionStorage.clear())

  it('preserves an internal path once', () => {
    saveAuthRedirect('/notifications?filter=unread#latest')

    expect(consumeAuthRedirect()).toBe('/notifications?filter=unread#latest')
    expect(consumeAuthRedirect()).toBe('/')
  })

  it('rejects external and recursive auth redirects', () => {
    expect(normalizeAuthRedirect('//attacker.example/path')).toBe('/')
    expect(normalizeAuthRedirect('https://attacker.example/path')).toBe('/')
    expect(normalizeAuthRedirect('/auth-success?token=value')).toBe('/')
    expect(normalizeAuthRedirect('/login')).toBe('/')
  })
})
