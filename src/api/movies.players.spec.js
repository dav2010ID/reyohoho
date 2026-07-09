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
