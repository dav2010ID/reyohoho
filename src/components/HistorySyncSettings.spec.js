import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import HistorySyncSettings from './HistorySyncSettings.vue'
import { useMainStore } from '@/store/main'
import { useAuthStore } from '@/store/auth'

const mocks = vi.hoisted(() => ({ transfer: vi.fn(), importHistory: vi.fn(), request: vi.fn() }))
vi.mock('@/utils/historyTransfer', () => ({
  TRANSFER_URL: 'https://dav2010id.github.io/reyohoho-history-transfer/',
  startHistoryTransfer: mocks.transfer
}))
vi.mock('@/api/cloudHistory', () => ({
  cloudHistoryAvailable: true,
  isCloudHistoryEnabled: () => useAuthStore().isWorkerSession,
  importCloudHistory: mocks.importHistory,
  historyRequest: mocks.request
}))

describe('history transfer confirmation', () => {
  let main
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    setActivePinia(createPinia())
    main = useMainStore()
    main.setHistory([{ kp_id: '301', title: 'Current Matrix' }])
    mocks.transfer.mockImplementation((receive) => {
      receive([{ kp_id: '301', title: 'Old Matrix' }, { kp_id: '42', title: 'Imported' }])
      return vi.fn()
    })
  })
  afterEach(() => vi.restoreAllMocks())
  const button = (wrapper, text) => wrapper.findAll('button').find((item) => item.text() === text)
  it('describes cloud sync without infrastructure jargon and preserves the deletion warning', async () => {
    const auth = useAuthStore()
    auth.setToken('rh1_' + 'x'.repeat(43))
    auth.setUser({ id: 1 })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const wrapper = mount(HistorySyncSettings)
    expect(wrapper.text()).toContain('История синхронизируется с облаком')
    expect(wrapper.text()).toContain('не появятся снова при повторном импорте')
    expect(wrapper.text()).not.toMatch(/Cloudflare|токен|отметки удаления|\bID\b/)
    await button(wrapper, 'Удалить облачную историю').trigger('click')
    expect(confirm).toHaveBeenCalledWith(
      'Удалить историю в облаке для этого аккаунта? Это действие очистит и локальную историю.'
    )
    expect(mocks.request).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('explains invalid history files instead of showing a JSON parser error', async () => {
    const wrapper = mount(HistorySyncSettings)
    const input = wrapper.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', {
      value: [{ size: 10, text: async () => 'not-json' }]
    })
    await input.trigger('change')
    await flushPromises()
    expect(wrapper.text()).toContain('Не удалось прочитать файл истории.')
    expect(wrapper.text()).not.toContain('Unexpected token')
    expect(main.history).toHaveLength(1)
    wrapper.unmount()
  })
  it('requires confirmation, merges guests without duplicates and leaves old metadata intact', async () => {
    const wrapper = mount(HistorySyncSettings)
    await button(wrapper, 'Перенести со старого сайта').trigger('click')
    expect(main.history).toHaveLength(1)
    expect(wrapper.text()).toContain('Найдено 2 фильмов')
    await button(wrapper, 'Подтвердить импорт').trigger('click')
    await flushPromises()
    expect(main.history).toHaveLength(2)
    expect(main.history.find((item) => item.kp_id === '301').title).toBe('Current Matrix')
    expect(mocks.importHistory).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Готово')
    wrapper.unmount()
  })
  it('imports into the current cloud account only after confirmation', async () => {
    const auth = useAuthStore()
    auth.setToken('rh1_' + 'x'.repeat(43))
    auth.setUser({ id: 1 })
    mocks.importHistory.mockResolvedValue([{ kp_id: '301' }, { kp_id: '42' }])
    const wrapper = mount(HistorySyncSettings)
    await button(wrapper, 'Перенести со старого сайта').trigger('click')
    expect(mocks.importHistory).not.toHaveBeenCalled()
    await button(wrapper, 'Подтвердить импорт').trigger('click')
    await flushPromises()
    expect(mocks.importHistory).toHaveBeenCalledTimes(1)
    expect(main.history).toHaveLength(2)
    wrapper.unmount()
  })
  it('cancels without modifying history', async () => {
    const wrapper = mount(HistorySyncSettings)
    await button(wrapper, 'Перенести со старого сайта').trigger('click')
    await button(wrapper, 'Отмена').trigger('click')
    expect(main.history).toHaveLength(1)
    expect(wrapper.text()).not.toContain('Подтвердить импорт')
    wrapper.unmount()
  })
  it('offers transfer and JSON in compact mode without cloud deletion controls', () => {
    const wrapper = mount(HistorySyncSettings, { props: { compact: true } })
    expect(wrapper.text()).toContain('Перенести со старого сайта')
    expect(wrapper.text()).toContain('Загрузить историю из файла')
    expect(wrapper.text()).not.toContain('Удалить облачную историю')
    expect(wrapper.text()).not.toContain('Сохранить историю в файл')
    wrapper.unmount()
  })
})
