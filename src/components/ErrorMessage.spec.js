import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ErrorMessage from './ErrorMessage.vue'

describe('ErrorMessage', () => {
  it('emits retry only when retry is enabled', async () => {
    const wrapper = mount(ErrorMessage, {
      props: { message: 'Не удалось загрузить', showRetry: true },
      global: {
        stubs: { RouterLink: { template: '<a><slot /></a>' } }
      }
    })

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('hides retry for non-retryable errors', () => {
    const wrapper = mount(ErrorMessage, {
      props: { message: 'Ошибка' },
      global: {
        stubs: { RouterLink: { template: '<a><slot /></a>' } }
      }
    })

    expect(wrapper.find('button').exists()).toBe(false)
  })
})
