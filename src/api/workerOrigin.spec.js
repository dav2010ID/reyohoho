import { describe, expect, it } from 'vitest'
import { parseWorkerApiUrl } from './workerOrigin'

describe('Worker API origin', () => {
  it('defaults to production and accepts staging or a local Worker', () => {
    expect(parseWorkerApiUrl('')).toBe('https://api.reyhoho.fun')
    expect(parseWorkerApiUrl('https://staging.example/')).toBe('https://staging.example')
    expect(parseWorkerApiUrl('http://localhost:8787')).toBe('http://localhost:8787')
    expect(parseWorkerApiUrl('http://127.0.0.1:4178/__profile/api/')).toBe(
      'http://127.0.0.1:4178/__profile/api'
    )
  })
  it.each(['http://api.example', 'https://api.example/?x=1', 'https://u:p@api.example'])(
    'rejects %s',
    (value) => expect(() => parseWorkerApiUrl(value)).toThrow()
  )
})
