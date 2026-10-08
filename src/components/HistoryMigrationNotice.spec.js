import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import HistoryMigrationNotice from './HistoryMigrationNotice.vue'
import {
  HISTORY_MIGRATION_NOTICE_END,
  HISTORY_MIGRATION_DISMISSED_KEY,
  shouldShowHistoryMigrationNotice
} from '@/utils/historyMigrationNotice'

describe('home history migration campaign', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-08T12:00:00Z'))
    localStorage.clear()
  })
  afterEach(() => vi.useRealTimers())
  const create = () => mount(HistoryMigrationNotice, {
    global: { stubs: { HistorySyncSettings: { props: ['compact'], template: '<div>Transfer controls</div>' } } }
  })
  it('is visible during the first month and embeds compact import controls', async () => {
    const wrapper = create()
    await nextTick()
    expect(wrapper.text()).toContain('История осталась на старом сайте?')
    expect(wrapper.text()).toContain('Transfer controls')
    wrapper.unmount()
  })
  it('can be dismissed without changing history and stays hidden on return', async () => {
    localStorage.setItem('main', '{"history":[{"kp_id":301}]}')
    const wrapper = create()
    await nextTick()
    await wrapper.get('button').trigger('click')
    expect(localStorage.getItem(HISTORY_MIGRATION_DISMISSED_KEY)).toBe('dismissed')
    expect(localStorage.getItem('main')).toContain('301')
    expect(wrapper.find('section').exists()).toBe(false)
    wrapper.unmount()
    const returned = create()
    expect(returned.find('section').exists()).toBe(false)
    returned.unmount()
  })
  it('expires on the fixed deadline even in an open tab', async () => {
    vi.setSystemTime(HISTORY_MIGRATION_NOTICE_END - 30000)
    const wrapper = create()
    await nextTick()
    expect(wrapper.find('section').exists()).toBe(true)
    await vi.advanceTimersByTimeAsync(60000)
    expect(wrapper.find('section').exists()).toBe(false)
    wrapper.unmount()
    expect(vi.getTimerCount()).toBe(0)
    expect(shouldShowHistoryMigrationNotice(HISTORY_MIGRATION_NOTICE_END, localStorage)).toBe(false)
  })
  it('still offers transfer if storage is blocked', () => {
    expect(shouldShowHistoryMigrationNotice(Date.now(), { getItem() { throw new Error('blocked') } })).toBe(true)
  })
})
