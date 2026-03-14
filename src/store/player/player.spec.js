import { usePlayerStore } from '@/store/player'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('Тесты хранилища player', () => {
  beforeEach(() => {
    setActivePinia(
      createTestingPinia({
        createSpy: vi.fn,
        stubActions: false
      })
    )
  })

  it('Имеет начальное состояние по умолчанию', () => {
    const store = usePlayerStore()
    expect(store.aspectRatio).toBe('16:9')
    expect(store.isCentered).toBe(false)
    expect(store.preferredPlayer).toBe(null)
  })

  it('Обновляет aspectRatio при вызове updateAspectRatio()', () => {
    const store = usePlayerStore()
    store.updateAspectRatio('4:3')
    expect(store.aspectRatio).toBe('4:3')
  })

  it('Обновляет isCentered при вызове updateCentering()', () => {
    const store = usePlayerStore()
    store.updateCentering(true)
    expect(store.isCentered).toBe(true)
  })

  it('Обновляет preferredPlayer при вызове updatePreferredPlayer()', () => {
    const store = usePlayerStore()
    store.updatePreferredPlayer('ALLOHA')
    expect(store.preferredPlayer).toBe('ALLOHA')
  })

  it('Очищает preferredPlayer при вызове clearPreferredPlayer()', () => {
    const store = usePlayerStore()
    store.updatePreferredPlayer('ALLOHA')
    expect(store.preferredPlayer).toBe('ALLOHA')
    store.clearPreferredPlayer()
    expect(store.preferredPlayer).toBe(null)
  })
})
