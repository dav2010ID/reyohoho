import { describe, expect, it, vi } from 'vitest'
import { logoutAndRedirect } from './authSession'

describe('auth session navigation', () => {
  it('clears auth state before navigating without a hard reload', async () => {
    const authStore = { logout: vi.fn() }
    const router = { push: vi.fn().mockResolvedValue() }

    await logoutAndRedirect({ authStore, router, to: '/login?expired=1' })

    expect(authStore.logout).toHaveBeenCalledOnce()
    expect(router.push).toHaveBeenCalledWith('/login?expired=1')
  })
})
