import { describe, expect, it } from 'vitest'
import { getTrustedApiOrigins, isTrustedApiRequest } from './apiTrust'

const env = {
  VITE_APP_API_URL: 'https://api.example.com/v1',
  VITE_LOCAL_API_URL: 'http://127.0.0.1:8000',
  VITE_TRUSTED_API_ORIGINS: 'https://backup.example.com/api, https://second.example.com'
}

describe('API trust policy', () => {
  it('trusts exact configured API origins', () => {
    expect(getTrustedApiOrigins(env)).toEqual(
      new Set([
        'https://api.example.com',
        'http://127.0.0.1:8000',
        'https://backup.example.com',
        'https://second.example.com'
      ])
    )
  })

  it('allows relative requests to a trusted API', () => {
    expect(
      isTrustedApiRequest({ baseURL: 'https://api.example.com/v1/', url: '/user', env })
    ).toBe(true)
  })

  it('rejects an absolute request that overrides a trusted base URL', () => {
    expect(
      isTrustedApiRequest({
        baseURL: 'https://api.example.com',
        url: 'https://attacker.example/user',
        env
      })
    ).toBe(false)
  })

  it('rejects untrusted ports and insecure remote origins', () => {
    expect(
      isTrustedApiRequest({ baseURL: 'https://api.example.com:8443', url: '/user', env })
    ).toBe(false)
    expect(
      getTrustedApiOrigins({
        VITE_APP_API_URL: 'http://api.example.com',
        VITE_TRUSTED_API_ORIGINS: ''
      })
    ).toEqual(new Set(['http://localhost:8000']))
  })
})
