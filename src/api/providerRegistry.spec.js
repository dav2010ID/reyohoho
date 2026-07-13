import { describe, expect, it, vi } from 'vitest'
import { createProviderRegistry } from './providerRegistry'

describe('provider registry', () => {
  it('loads each provider once and reuses its promise', async () => {
    const provider = { apiSearch: vi.fn() }
    const importer = vi.fn().mockResolvedValue(provider)
    const registry = createProviderRegistry({ test: importer })

    expect(await registry.loadProvider('test')).toBe(provider)
    expect(await registry.loadProvider('test')).toBe(provider)
    expect(importer).toHaveBeenCalledOnce()
  })

  it('rejects unknown providers explicitly', async () => {
    const registry = createProviderRegistry({})

    await expect(registry.loadProvider('missing')).rejects.toThrow('Unknown content provider')
  })
})
