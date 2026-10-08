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
  const dialogPrototype = window.HTMLDialogElement.prototype
  const originalShowModal = dialogPrototype.showModal
  const originalClose = dialogPrototype.close
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-08T12:00:00Z'))
    localStorage.clear()
    dialogPrototype.showModal = vi.fn(function () {
      this.setAttribute('open', '')
    })
    dialogPrototype.close = vi.fn(function () {
      this.removeAttribute('open')
      this.dispatchEvent(new window.Event('close'))
    })
  })
  afterEach(() => {
    if (originalShowModal) dialogPrototype.showModal = originalShowModal
    else delete dialogPrototype.showModal
    if (originalClose) dialogPrototype.close = originalClose
    else delete dialogPrototype.close
    vi.useRealTimers()
  })
  const create = () => mount(HistoryMigrationNotice, {
    global: { stubs: { HistorySyncSettings: { props: ['compact'], template: '<div>Transfer controls</div>' } } }
  })
  it('shows only a quiet button and opens import controls on demand', async () => {
    const wrapper = create()
    await nextTick()
    expect(wrapper.findAll('button')).toHaveLength(1)
    expect(wrapper.text()).toContain('Перенести историю со старого сайта')
    expect(wrapper.find('dialog').exists()).toBe(false)
    await wrapper.get('button').trigger('click')
    expect(wrapper.get('dialog').attributes('open')).toBe('')
    expect(wrapper.text()).toContain('История осталась на старом сайте?')
    expect(wrapper.text()).toContain('Transfer controls')
    wrapper.unmount()
  })
  it('closes without changing history and can be reopened', async () => {
    localStorage.setItem('main', '{"history":[{"kp_id":301}]}')
    const wrapper = create()
    await nextTick()
    await wrapper.get('button').trigger('click')
    await wrapper.get('[aria-label="Закрыть окно переноса"]').trigger('click')
    expect(wrapper.get('dialog').attributes('open')).toBeUndefined()
    expect(localStorage.getItem(HISTORY_MIGRATION_DISMISSED_KEY)).toBeNull()
    expect(localStorage.getItem('main')).toContain('301')
    await wrapper.get('.migration-entry__button').trigger('click')
    expect(wrapper.get('dialog').attributes('open')).toBe('')
    wrapper.unmount()
  })
  it('expires on the fixed deadline even in an open tab', async () => {
    vi.setSystemTime(HISTORY_MIGRATION_NOTICE_END - 30000)
    const wrapper = create()
    await nextTick()
    expect(wrapper.find('.migration-entry__button').exists()).toBe(true)
    await vi.advanceTimersByTimeAsync(60000)
    expect(wrapper.find('.migration-entry__button').exists()).toBe(false)
    wrapper.unmount()
    expect(vi.getTimerCount()).toBe(0)
    expect(shouldShowHistoryMigrationNotice(HISTORY_MIGRATION_NOTICE_END, localStorage)).toBe(false)
  })
  it('still offers transfer if storage is blocked', () => {
    expect(shouldShowHistoryMigrationNotice(Date.now(), { getItem() { throw new Error('blocked') } })).toBe(true)
  })
  it('respects a previously dismissed campaign', async () => {
    localStorage.setItem(HISTORY_MIGRATION_DISMISSED_KEY, 'dismissed')
    const wrapper = create()
    await nextTick()
    expect(wrapper.find('button').exists()).toBe(false)
    wrapper.unmount()
  })
  it('keeps an active import open at the campaign deadline', async () => {
    vi.setSystemTime(HISTORY_MIGRATION_NOTICE_END - 30000)
    const wrapper = create()
    await nextTick()
    await wrapper.get('button').trigger('click')
    await vi.advanceTimersByTimeAsync(60000)
    expect(wrapper.find('.migration-entry__button').exists()).toBe(false)
    expect(wrapper.get('dialog').attributes('open')).toBe('')
    await wrapper.get('[aria-label="Закрыть окно переноса"]').trigger('click')
    expect(wrapper.find('dialog').exists()).toBe(false)
    wrapper.unmount()
  })
})
