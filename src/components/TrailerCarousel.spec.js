import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/store/main', () => ({ useMainStore: () => ({ isMobile: false }) }))

const video = (videoId, name) => ({
  videoId,
  name,
  iframeUrl: `https://www.youtube.com/embed/${videoId}`
})

afterEach(() => vi.unstubAllGlobals())

describe('TrailerCarousel', () => {
  it('plays the trailer that was clicked when an earlier one is unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => ({ ok: !String(url).includes('gone0000000') }))
    )
    const TrailerCarousel = (await import('./TrailerCarousel.vue')).default
    const wrapper = mount(TrailerCarousel, {
      props: { videos: [video('gone0000000', 'Удалён'), video('wPiyAoTY8Ys', 'Трейлер 2')] }
    })
    await flushPromises()
    const items = wrapper.findAll('.carousel-item')
    expect(items).toHaveLength(1)
    expect(wrapper.find('.trailers-count').text()).toBe('1')
    await items[0].trigger('click')
    expect(wrapper.find('iframe').attributes('src')).toBe(
      'https://www.youtube.com/embed/wPiyAoTY8Ys'
    )
    expect(wrapper.emitted('select')[0][0].videoId).toBe('wPiyAoTY8Ys')
    expect(items[0].classes()).toContain('is-active')
    wrapper.unmount()
  })
})
