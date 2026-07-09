import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import PlayerModal from './PlayerModal.vue'

describe('PlayerModal', () => {
  it('supports backend players without a name and selects another source', async () => {
    const players = [
      { key: 'KPMIRROR>1', source: 'KPMIRROR', translate: 'KPMIRROR' },
      { key: 'OBRUT>1', source: 'OBRUT', translate: 'OBRUT' }
    ]
    const wrapper = mount(PlayerModal, {
      props: { players, selectedPlayer: players[0] }
    })

    const buttons = wrapper.findAll('button.player-item')
    expect(buttons).toHaveLength(2)
    await buttons[1].trigger('click')

    expect(wrapper.emitted('select')?.[0]).toEqual([players[1]])
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
