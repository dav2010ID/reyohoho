// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { describeDevice, describePlace, requestAge } from './login-context.mjs'

describe('login context', () => {
  it.each([
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1', 'Safari, iOS'],
    ['Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/140.0 YaBrowser/25.1 Mobile Safari/537.36', 'Яндекс Браузер, Android'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0 Safari/537.36 Edg/140.0', 'Edge, Windows'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0; rv:140.0) Gecko/20100101 Firefox/140.0', 'Firefox, macOS'],
    ['curl/8.0', 'неизвестное устройство']
  ])('describes %s', (agent, expected) => expect(describeDevice(agent)).toBe(expected))
  it('uses only the coarse Cloudflare place and strips markup', () => {
    const request = (cf, headers = {}) => Object.assign(new Request('https://x.test', { headers }), { cf })
    expect(describePlace(request({ country: 'RU', city: 'Москва' }))).toBe('Москва, RU')
    expect(describePlace(request({ country: 'RU', city: '<b>X</b>' }))).toBe('bXb, RU')
    expect(describePlace(request(undefined, { 'CF-IPCountry': 'XX' }))).toBe('место не определено')
  })
  it('states how long ago the request was made', () => {
    expect(requestAge(20)).toBe('меньше минуты назад')
    expect(requestAge(185)).toBe('3 мин назад')
  })
})
