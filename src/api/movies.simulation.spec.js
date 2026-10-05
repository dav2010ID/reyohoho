import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ loadProvider: vi.fn() }))
vi.mock('./providerRegistry', async (importOriginal) => ({
  ...(await importOriginal()),
  loadProvider: mocks.loadProvider
}))

import { toggleErrorSimulation } from './movies'

describe('movie provider error simulation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each([true, false])('toggles active providers without loading KinoBD: %s', async (enabled) => {
    const toggles = new Map()
    mocks.loadProvider.mockImplementation(async (provider) => {
      if (provider === 'kinobd') throw new Error('Unknown content provider: kinobd')
      const toggle = vi.fn()
      toggles.set(provider, toggle)
      return { toggleErrorSimulation: toggle }
    })

    await toggleErrorSimulation(enabled)

    expect([...toggles.keys()]).toEqual(['backend', 'kinobox', 'ddbb', 'ddbb_live', 'local'])
    for (const toggle of toggles.values()) expect(toggle).toHaveBeenCalledWith(enabled)
  })

  it('supports adapters without error simulation', async () => {
    mocks.loadProvider.mockResolvedValue({})
    await expect(toggleErrorSimulation(false)).resolves.toBeUndefined()
  })
})
