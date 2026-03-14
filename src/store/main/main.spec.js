import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolvePosterByMovie } from '@/utils/mediaUtils'
import { useMainStore } from './main'

describe('Тесты хранилища main', () => {
  beforeEach(() => {
    setActivePinia(
      createTestingPinia({
        createSpy: vi.fn,
        stubActions: false
      })
    )
  })

  it('Имеет начальное состояние по умолчанию', () => {
    const store = useMainStore()

    expect(store.history).toEqual([])
    expect(store.isHistoryAllowed).toBe(true)
    expect(store.isMobile).toBe(false)
    expect(store.dimmingEnabled).toBe(false)
  })

  it('Устанавливает isMobile', () => {
    const store = useMainStore()
    store.setIsMobile(true)
    expect(store.isMobile).toBe(true)
  })

  it('Переключает dimmingEnabled', () => {
    const store = useMainStore()
    expect(store.dimmingEnabled).toBe(false)

    store.toggleDimming()
    expect(store.dimmingEnabled).toBe(true)

    store.toggleDimming()
    expect(store.dimmingEnabled).toBe(false)
  })

  it('Устанавливает историю', () => {
    const store = useMainStore()
    const mockHistory = [{ kp_id: '1', addedAt: new Date().toISOString() }]
    store.setHistory(mockHistory)
    expect(store.history).toEqual(mockHistory)
  })

  it('Добавляет фильм в историю, если его нет', () => {
    const store = useMainStore()

    const movie = {
      kp_id: '123',
      title: 'Test Movie',
      year: 2024,
      type: 'FILM',
      poster: '',
      addedAt: new Date().toISOString()
    }

    store.addToHistory(movie)

    const currentMovie = store.history.find((m) => m.kp_id === movie.kp_id)

    expect(store.history.length).toBe(1)
    expect(currentMovie.kp_id).toBe('123')
    expect(currentMovie.poster).toBe(resolvePosterByMovie(movie))
  })

  it('Не добавляет фильм без kp_id', () => {
    const store = useMainStore()

    store.addToHistory({ title: 'Invalid Movie' })

    expect(store.history.length).toBe(0)
  })

  it('Обновляет добавленный фильм и перемещает его в начало, если уже есть', () => {
    const store = useMainStore()

    const oldDate = new Date('2000-01-01').toISOString()

    store.setHistory([
      {
        kp_id: '1',
        title: 'Existing Movie',
        year: 2000,
        type: 'FILM',
        poster: 'poster.jpg',
        addedAt: oldDate
      }
    ])

    store.addToHistory({
      kp_id: '1',
      title: 'Existing Movie',
      year: 2000,
      type: 'FILM',
      poster: 'poster.jpg'
    })

    expect(store.history.length).toBe(1)
    expect(new Date(store.history[0].addedAt).getTime()).toBeGreaterThan(
      new Date(oldDate).getTime()
    )
  })

  it('Удаляет фильм из истории по kp_id', () => {
    const store = useMainStore()

    store.setHistory([
      { kp_id: '1', addedAt: new Date().toISOString() },
      { kp_id: '2', addedAt: new Date().toISOString() }
    ])

    store.removeFromHistory('1')

    expect(store.history.length).toBe(1)
    expect(store.history[0].kp_id).toBe('2')
  })

  it('очищает историю', () => {
    const store = useMainStore()
    store.setHistory([
      { kp_id: '1', addedAt: new Date().toISOString() },
      { kp_id: '2', addedAt: new Date().toISOString() }
    ])

    store.clearAllHistory()
    expect(store.history).toEqual([])
  })

  it('Удаляет фильмы старше 30 дней', () => {
    const store = useMainStore()

    const now = new Date()
    const recentDate = new Date(now)
    recentDate.setDate(recentDate.getDate() - 5)

    const oldDate = new Date(now)
    oldDate.setDate(oldDate.getDate() - 40)

    store.setHistory([
      { kp_id: 'recent', addedAt: recentDate.toISOString() },
      { kp_id: 'old', addedAt: oldDate.toISOString() }
    ])

    store.cleanOldHistory()

    expect(store.history.length).toBe(1)
    expect(store.history[0].kp_id).toBe('recent')
  })

  it('Устанавливает разрешение на историю', () => {
    const store = useMainStore()
    store.setHistoryAllowed(false)
    expect(store.isHistoryAllowed).toBe(false)
  })
})
