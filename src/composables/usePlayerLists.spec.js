import { nextTick, reactive, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addToList, delFromList, getMovieListStatus } from '@/api/user'
import { usePlayerLists } from './usePlayerLists'

vi.mock('@/api/user', () => ({
  addToList: vi.fn(),
  delFromList: vi.fn(),
  getMovieListStatus: vi.fn()
}))

function setup() {
  const authStore = reactive({ token: 'test-session' })
  const kpId = ref('301')
  const movieInfo = ref({ title: 'Матрица', lists: { isLater: true } })
  const notificationRef = ref({ showNotification: vi.fn() })
  const openLogin = vi.fn()
  const onChanged = vi.fn()
  return {
    authStore,
    kpId,
    movieInfo,
    notificationRef,
    openLogin,
    onChanged,
    ...usePlayerLists({ authStore, kpId, movieInfo, notificationRef, openLogin, onChanged })
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  getMovieListStatus.mockResolvedValue({})
})

describe('movie list toggles without reloading the card', () => {
  it('loads membership on opening and deletes an existing favorite on first click', async () => {
    getMovieListStatus.mockResolvedValue({ favorite: true, later: true, watching: false })
    const state = setup()
    const original = state.movieInfo.value
    await state.loadStatus()
    expect(state.movieInfo.value).toBe(original)
    expect(state.getListStatus('favorite')).toBe(true)
    expect(await state.toggleList('favorite')).toBe(true)
    expect(delFromList).toHaveBeenCalledWith('301', 'favorite')
    expect(addToList).not.toHaveBeenCalled()
  })
  it('waits for membership before a click and does not overwrite the successful toggle', async () => {
    let finish
    getMovieListStatus.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      })
    )
    const state = setup()
    const click = state.toggleList('favorite')
    expect(addToList).not.toHaveBeenCalled()
    finish({ favorite: true })
    await click
    expect(delFromList).toHaveBeenCalledOnce()
    expect(state.getListStatus('favorite')).toBe(false)
  })
  it('clears membership on logout and ignores stale responses', async () => {
    let finish
    getMovieListStatus.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      })
    )
    const state = setup()
    state.authStore.token = null
    await nextTick()
    finish({ favorite: true, later: true })
    await nextTick()
    expect(state.getListStatus('favorite')).toBe(false)
    expect(state.getListStatus('later')).toBe(false)
  })
  it('does not write an unknown status after a read failure', async () => {
    getMovieListStatus.mockRejectedValue(new Error('offline'))
    const state = setup()
    await state.loadStatus()
    expect(await state.toggleList('favorite')).toBe(false)
    expect(addToList).not.toHaveBeenCalled()
  })
  it.each([
    ['favorite', 'isFavorite'],
    ['history', 'isHistory'],
    ['later', 'isLater'],
    ['watching', 'isWatching'],
    ['completed', 'isCompleted'],
    ['abandoned', 'isAbandoned']
  ])('updates %s in place and removes it on the second click', async (type, flag) => {
    const state = setup()
    state.movieInfo.value.lists[flag] = false
    const original = state.movieInfo.value
    expect(await state.toggleList(type)).toBe(true)
    expect(addToList).toHaveBeenCalledWith('301', type, original)
    expect(state.movieInfo.value).toBe(original)
    expect(state.getListStatus(type)).toBe(true)
    expect(await state.toggleList(type)).toBe(true)
    expect(delFromList).toHaveBeenCalledWith('301', type)
    expect(state.getListStatus(type)).toBe(false)
  })

  it('leaves flags unchanged on failure and allows retry', async () => {
    const state = setup()
    addToList.mockRejectedValueOnce(new Error('offline'))
    expect(await state.toggleList('favorite')).toBe(false)
    expect(state.getListStatus('favorite')).toBe(false)
    expect(state.getListStatus('later')).toBe(true)
    expect(state.onChanged).not.toHaveBeenCalled()
    expect(await state.toggleList('favorite')).toBe(true)
  })

  it('ignores repeat clicks while a write is pending', async () => {
    const state = setup()
    let finish
    addToList.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      })
    )
    const first = state.toggleList('favorite')
    await nextTick()
    expect(await state.toggleList('favorite')).toBe(false)
    expect(addToList).toHaveBeenCalledTimes(1)
    expect(state.getListStatus('favorite')).toBe(false)
    finish()
    await first
    expect(state.getListStatus('favorite')).toBe(true)
  })

  it.each(['movie', 'account', 'card'])(
    'ignores a late response after switching %s',
    async (change) => {
      const state = setup()
      let finish
      addToList.mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve
        })
      )
      const request = state.toggleList('favorite')
      await nextTick()
      if (change === 'movie') state.kpId.value = '123'
      if (change === 'account') state.authStore.token = 'another-session'
      if (change === 'card') state.movieInfo.value = { title: 'Another card' }
      finish()
      expect(await request).toBe(false)
      expect(state.getListStatus('favorite')).toBe(false)
      expect(state.onChanged).not.toHaveBeenCalled()
      expect(state.notificationRef.value.showNotification).not.toHaveBeenCalled()
    }
  )

  it('prompts unauthenticated users without writing', async () => {
    const state = setup()
    state.authStore.token = ''
    expect(await state.toggleList('favorite')).toBe(false)
    expect(addToList).not.toHaveBeenCalled()
    const [, , options] = state.notificationRef.value.showNotification.mock.calls[0]
    options.onClick()
    expect(state.openLogin).toHaveBeenCalled()
  })
})
