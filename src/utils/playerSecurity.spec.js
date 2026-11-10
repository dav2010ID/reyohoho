import { describe, expect, it } from 'vitest'
import {
  assessPlayerIframe,
  getPersistablePlayerKey,
  getPlayerIframeSandbox,
  getSafePlayerUrl
} from './playerSecurity'

describe('player iframe security assessment', () => {
  it.each([
    'javascript:alert(1)',
    'java\nscript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'blob:https://app.example/id',
    'file:///etc/passwd',
    'http://untrusted.example',
    'https://user:password@player.example'
  ])('rejects unsafe iframe %s', (url) => {
    expect(getSafePlayerUrl(url, 'https://app.example')).toBeNull()
  })
  it.each([
    'https://player.example/embed/301?token=x',
    '//player.example/embed/301',
    '/player/301',
    'http://localhost:5173/player'
  ])('accepts compatible player %s', (url) => {
    expect(getSafePlayerUrl(url, 'https://app.example')).toBe(url)
  })
  it('recognizes same-origin and reviewed players', () => {
    expect(
      assessPlayerIframe({
        iframeUrl: '/player/301',
        currentOrigin: 'https://app.example'
      }).status
    ).toBe('same-origin')
    expect(
      assessPlayerIframe({
        iframeUrl: 'https://player.example/embed/301',
        currentOrigin: 'https://app.example',
        env: { VITE_REVIEWED_PLAYER_ORIGINS: 'https://player.example' }
      }).status
    ).toBe('reviewed')
  })

  it('reports unreviewed and insecure origins without exposing URL details', () => {
    expect(
      assessPlayerIframe({
        iframeUrl: 'https://unknown.example/embed?token=secret',
        currentOrigin: 'https://app.example',
        env: {}
      })
    ).toEqual({ status: 'unreviewed', origin: 'https://unknown.example' })
    expect(
      assessPlayerIframe({
        iframeUrl: 'http://unknown.example/embed',
        currentOrigin: 'https://app.example',
        env: {}
      }).status
    ).toBe('insecure')
  })

  it('keeps the iframe unsandboxed unless the build opts in', () => {
    // null removes the attribute; '' would silently apply the strictest sandbox.
    expect(getPlayerIframeSandbox({})).toBeNull()
    expect(getPlayerIframeSandbox({ VITE_PLAYER_IFRAME_SANDBOX: 'false' })).toBeNull()
    expect(getPlayerIframeSandbox({ VITE_PLAYER_IFRAME_SANDBOX: '1' })).toBeNull()

    const sandbox = getPlayerIframeSandbox({ VITE_PLAYER_IFRAME_SANDBOX: 'true' })
    expect(sandbox.split(' ')).toEqual(
      expect.arrayContaining(['allow-scripts', 'allow-same-origin', 'allow-presentation'])
    )
    expect(sandbox).not.toMatch(/allow-top-navigation/)
  })

  it('persists only a normalized non-torrent player key', () => {
    expect(getPersistablePlayerKey({ key: ' alloha>1 ', iframe: 'https://player/?token=x' })).toBe(
      'ALLOHA>1'
    )
    expect(getPersistablePlayerKey({ key: 'TORRENTS>1' })).toBeNull()
    expect(getPersistablePlayerKey({ iframe: 'https://player/?token=x' })).toBeNull()
  })
})
