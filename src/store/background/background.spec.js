import starsBackground from '@/assets/image-back-stars.png'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useBackgroundStore } from './background'

describe('Тесты store background', () => {
  beforeEach(() => {
    setActivePinia(
      createTestingPinia({
        createSpy: vi.fn,
        stubActions: false
      })
    )
  })

  it('Имеет начальное состояние по умолчанию', () => {
    const store = useBackgroundStore()

    expect(store.backgroundUrl).toBe(starsBackground)
    expect(store.topMoviePoster).toBe('')
    expect(store.moviePoster).toBe('')
    expect(store.isBlurActive).toBe(false)
    expect(store.backgroundType).toBe('disabled')
    expect(store.defaultBackground).toBe(starsBackground)
    expect(store.isCardBorder).toBe(false)
    expect(store.isCardHoverDisabled).toBe(false)
  })

  it('Обновляет moviePoster и backgroundUrl, если фон не stars/disabled', () => {
    const store = useBackgroundStore()

    store.SET_BACKGROUND_TYPE('dynamic')
    store.updateMoviePoster('movie.jpg')

    expect(store.moviePoster).toBe('movie.jpg')
    expect(store.backgroundUrl).toBe('movie.jpg')
  })

  it('Обновляет topMoviePoster и backgroundUrl, если фон не stars/disabled', () => {
    const store = useBackgroundStore()

    store.SET_BACKGROUND_TYPE('dynamic')
    store.updateTopMoviePoster('top.jpg')

    expect(store.topMoviePoster).toBe('top.jpg')
    expect(store.backgroundUrl).toBe('top.jpg')
  })

  it('Не обновляет poster если фон stars или disabled', () => {
    const store = useBackgroundStore()

    store.SET_BACKGROUND_TYPE('stars')
    store.updateMoviePoster('movie.jpg')
    expect(store.moviePoster).toBe('') // ничего не меняется

    store.SET_BACKGROUND_TYPE('disabled')
    store.updateTopMoviePoster('top.jpg')
    expect(store.topMoviePoster).toBe('') // тоже ничего не меняется
  })

  it('Включает блюр если фон не stars/disabled', () => {
    const store = useBackgroundStore()

    store.SET_BACKGROUND_TYPE('dynamic')
    store.toggleBlur(true)
    expect(store.isBlurActive).toBe(true)
  })

  it('Не включает блюр если фон stars или disabled', () => {
    const store = useBackgroundStore()

    store.SET_BACKGROUND_TYPE('stars')
    store.toggleBlur(true)
    expect(store.isBlurActive).toBe(false)
  })

  it('Переключает рамку карточки', () => {
    const store = useBackgroundStore()

    store.toggleCardBorder(true)
    expect(store.isCardBorder).toBe(true)
  })

  it('ResetBackground сбрасывает фон к stars и выключает блюр', () => {
    const store = useBackgroundStore()

    store.SET_BACKGROUND_TYPE('dynamic')
    store.toggleBlur(true)

    store.resetBackground()
    expect(store.backgroundType).toBe('stars')
    expect(store.isBlurActive).toBe(false)
    expect(store.backgroundUrl).toBe(starsBackground)
  })

  it('SET_BACKGROUND_TYPE работает корректно', () => {
    const store = useBackgroundStore()

    store.topMoviePoster = 'top.jpg'
    store.SET_BACKGROUND_TYPE('dynamic')

    expect(store.backgroundType).toBe('dynamic')
    expect(store.backgroundUrl).toBe('top.jpg')
    expect(store.isBlurActive).toBe(true)

    store.SET_BACKGROUND_TYPE('disabled')
    expect(store.backgroundUrl).toBe('')
    expect(store.isBlurActive).toBe(false)

    store.SET_BACKGROUND_TYPE('stars')
    expect(store.backgroundUrl).toBe(starsBackground)
    expect(store.isBlurActive).toBe(false)
  })
})
