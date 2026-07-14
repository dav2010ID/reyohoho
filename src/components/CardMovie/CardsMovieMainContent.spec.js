import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import CardsMovieMainContent from './CardsMovieMainContent.vue'

const movie = {
  kp_id: '123',
  title: 'Test movie',
  poster: 'https://example.com/poster.jpg'
}

const mountComponent = ({ priority = false } = {}) => {
  const lazyMounted = vi.fn((element, binding) => {
    element.src = binding.value
  })
  const wrapper = mount(CardsMovieMainContent, {
    props: { movie, priority, showDelete: false },
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn })],
      directives: {
        lazy: { mounted: lazyMounted }
      }
    }
  })

  return { wrapper, lazyMounted }
}

describe('CardsMovieMainContent image loading', () => {
  it('renders priority posters directly without the lazy-loading rewrite', () => {
    const { wrapper, lazyMounted } = mountComponent({ priority: true })
    const image = wrapper.get('img.movie-poster')

    expect(lazyMounted).not.toHaveBeenCalled()
    expect(image.attributes('src')).toBe(movie.poster)
    expect(image.attributes('loading')).toBe('eager')
    expect(image.attributes('fetchpriority')).toBe('high')
  })

  it('keeps lazy loading for non-priority posters', () => {
    const { wrapper, lazyMounted } = mountComponent()

    expect(lazyMounted).toHaveBeenCalledOnce()
    expect(wrapper.get('img.movie-poster').attributes('loading')).toBe('lazy')
  })
})
