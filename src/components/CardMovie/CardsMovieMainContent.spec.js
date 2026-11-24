import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import CardsMovieMainContent from './CardsMovieMainContent.vue'
import noPosterImage from '@/assets/image-no-poster.gif'

const movie = {
  kp_id: '123',
  title: 'Test movie',
  poster: 'https://example.com/poster.jpg'
}
const cdnPoster = 'https://avatars.mds.yandex.net/get-kinopoisk-image/123/poster/300x450'
const mountComponent = (props = {}) =>
  mount(CardsMovieMainContent, {
    props: { movie, showDelete: false, ...props },
    global: { plugins: [createTestingPinia({ createSpy: vi.fn })] }
  })

describe('CardsMovieMainContent image loading', () => {
  it('makes priority posters discoverable without a client directive', () => {
    const wrapper = mountComponent({ priority: true })
    const image = wrapper.get('img.movie-poster')
    expect(image.attributes('src')).toBe(movie.poster)
    expect(image.attributes('loading')).toBe('eager')
    expect(image.attributes('fetchpriority')).toBe('high')
    expect(image.attributes('srcset')).toBeUndefined()
  })

  it('uses native lazy loading with responsive sizes for supported posters', () => {
    const wrapper = mountComponent({ movie: { ...movie, poster: cdnPoster } })
    const image = wrapper.get('img.movie-poster')
    expect(image.attributes('loading')).toBe('lazy')
    expect(image.attributes('sizes')).toMatch(/^\(max-width: 620px\) calc\(\(100vw - 44px\) \/ 3\)/)
    expect(image.attributes('srcset')).toContain('/100x150 100w')
    expect(image.attributes('srcset')).toContain('/600x900 600w')
  })

  it('keeps related posters larger than the mobile list thumbnails', () => {
    const wrapper = mountComponent({ movie: { ...movie, poster: cdnPoster }, variant: 'related' })
    expect(wrapper.get('img.movie-poster').attributes('sizes')).toMatch(/156px/)
  })

  it('replaces failed responsive sources and accepts a new movie after failure', async () => {
    const wrapper = mountComponent({ movie: { ...movie, poster: cdnPoster } })
    const image = wrapper.get('img.movie-poster')
    await image.trigger('error')
    expect(image.attributes('src')).toBe(noPosterImage)
    expect(image.attributes('srcset')).toBeUndefined()
    await wrapper.setProps({
      movie: { ...movie, poster: cdnPoster.replace('/poster/', '/other/') }
    })
    expect(image.attributes('src')).toContain('/other/300x450')
    expect(image.attributes('srcset')).toContain('/other/100x150 100w')
  })
})
