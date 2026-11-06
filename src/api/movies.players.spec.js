import { describe, expect, it } from 'vitest'

import { mergePlayerMaps } from './movies'
import { toPlayersMap } from './movies.ddbb'
import { getProviderDisplayName } from '@/utils/playerUtils'

describe('player source aggregation', () => {
  it('keeps one entry per provider and removes exact iframe duplicates', () => {
    const normalized = toPlayersMap([
      {
        type: 'Alloha',
        iframeUrl: 'https://player.test/base',
        translations: [
          {
            id: 66,
            name: 'Дублированный',
            quality: 'WEBRip',
            iframeUrl: 'https://player.test/dub'
          },
          {
            id: 93,
            name: 'Оригинальный',
            quality: 'WEBRip',
            iframeUrl: 'https://player.test/original'
          }
        ]
      }
    ])
    const merged = mergePlayerMaps([
      normalized,
      { 'KINOBOX>Alloha': { iframe: 'https://player.test/base' } }
    ])

    expect(Object.keys(normalized)).toEqual(['DDBB>Alloha'])
    expect(Object.keys(merged)).toHaveLength(1)
    expect(getProviderDisplayName(normalized['DDBB>Alloha'])).toBe('Alloha')
  })

  it('prefers named providers over their local mirror aliases', () => {
    const merged = mergePlayerMaps([
      {
        'DDBB>Collaps': { iframe: 'https://api.ortified.ws/embed/movie/1', translate: 'Collaps' },
        'DDBB>Turbo': { iframe: 'https://one.obrut.show/embed/1', translate: 'Turbo' }
      },
      {
        'KPMIRROR>1': { iframe: 'https://namy.ws/embed/kp/1', source: 'kp_embed' },
        'OBRUT>1': { iframe: 'https://two.obrut.show/embed/1', source: 'obrut' }
      }
    ])

    expect(Object.keys(merged)).toEqual(['DDBB>Collaps', 'DDBB>Turbo'])
  })
})

describe('Vibix embed attributes', () => {
  const vibix = (iframeUrl, type = 'Vibix') =>
    toPlayersMap([{ type, iframeUrl }], { sourceLabel: 'DDBB LIVE' })

  it('builds the SDK iframe URL for movies and series without loading the SDK', () => {
    expect(
      vibix('data-publisher-id="667718341" data-type="movie" data-id="4469"')['DDBB LIVE>Vibix']
        .iframe
    ).toBe('https://river-3-329.kinescopecdn.net/667718341/embed/4469?lang=ru')
    expect(
      vibix('data-publisher-id="667718341" data-type="serial" data-id="77"')['DDBB LIVE>Vibix']
        .iframe
    ).toBe('https://river-3-329.kinescopecdn.net/667718341/embed-serials/77?lang=ru')
  })

  it.each([
    'data-publisher-id="667718341" data-type="movie" data-id="4469 onload=x"',
    'data-publisher-id="66771834a" data-type="movie" data-id="4469"',
    'data-publisher-id="667718341" data-type="trailer" data-id="4469"',
    'data-publisher-id="667718341" data-type="movie"',
    '<script src="https://evil.test"></script> data-publisher-id="1" data-type="movie" data-id="2"'
  ])('rejects malformed Vibix attributes: %s', (value) => {
    expect(vibix(value)).toEqual({})
  })

  it('keeps attribute text from other providers out of iframes', () => {
    expect(vibix('data-publisher-id="1" data-type="movie" data-id="2"', 'Alloha')).toEqual({})
    expect(vibix('/movie/301', 'Collaps')).toEqual({})
  })
})
