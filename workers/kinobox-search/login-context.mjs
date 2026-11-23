// Coarse description of the browser behind a login request, shown only to the
// account owner in their Telegram chat. Never the IP address or the full UA.
const BROWSERS = [
  [/YaBrowser\//, 'Яндекс Браузер'],
  [/Edg(?:A|iOS)?\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/Chrome\/|CriOS\//, 'Chrome'],
  [/Safari\//, 'Safari']
]
const SYSTEMS = [
  [/Windows/, 'Windows'],
  [/Android/, 'Android'],
  [/iPhone|iPad|iPod/, 'iOS'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/CrOS/, 'ChromeOS'],
  [/Linux/, 'Linux']
]
const first = (rules, value) => rules.find(([pattern]) => pattern.test(value))?.[1]

export function describeDevice(userAgent = '') {
  const browser = first(BROWSERS, userAgent)
  const system = first(SYSTEMS, userAgent)
  if (!browser && !system) return 'неизвестное устройство'
  return [browser, system].filter(Boolean).join(', ')
}

const clean = (value, max) =>
  String(value || '')
    .replace(/[^\p{L}\p{N} .'-]/gu, '')
    .trim()
    .slice(0, max)

export function describePlace(request) {
  const country = clean(request.cf?.country || request.headers.get('CF-IPCountry'), 2)
  const city = clean(request.cf?.city, 40)
  if (!country || country === 'XX' || country === 'T1') return 'место не определено'
  return city ? `${city}, ${country}` : country
}

export const describeClient = (request) => ({
  device: describeDevice(request.headers.get('User-Agent') || ''),
  place: describePlace(request)
})

export function requestAge(seconds) {
  const minutes = Math.floor(Math.max(0, seconds) / 60)
  return minutes < 1 ? 'меньше минуты назад' : `${minutes} мин назад`
}
