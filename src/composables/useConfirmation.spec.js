import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
import ConfirmationHost from '@/components/ConfirmationHost.vue'
import { useConfirmation } from './useConfirmation'

describe('confirmation lifecycle', () => {
  it('resolves on approval and cancels when its owner unmounts', async () => {
    let ask
    const owner = mount(defineComponent({ setup() { ask = useConfirmation(); return () => null } }))
    const host = mount(ConfirmationHost, { attachTo: document.body })
    const approved = ask('Continue?')
    await host.vm.$nextTick()
    await host.get('button.danger').trigger('click')
    expect(await approved).toBe(true)
    const canceled = ask('Delete?')
    owner.unmount()
    expect(await canceled).toBe(false)
    host.unmount()
  })
})
