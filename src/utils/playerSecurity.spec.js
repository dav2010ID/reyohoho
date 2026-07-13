import { describe, expect, it } from 'vitest'
import { assessPlayerIframe, getPersistablePlayerKey } from './playerSecurity'

describe('player iframe security assessment', () => {
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

  it('persists only a normalized non-torrent player key', () => {
    expect(getPersistablePlayerKey({ key: ' alloha>1 ', iframe: 'https://player/?token=x' })).toBe(
      'ALLOHA>1'
    )
    expect(getPersistablePlayerKey({ key: 'TORRENTS>1' })).toBeNull()
    expect(getPersistablePlayerKey({ iframe: 'https://player/?token=x' })).toBeNull()
  })
})
