export function cleanPlayerName(name) {
  return String(name || '')
    .replace(/KODIK>/, 'Kodik - ')
    .replace(/VEOVEO>/, 'VeoVeo - ')
    .replace(/KINOBOX>/, '')
    .trim()
}

export function getProviderName(player) {
  const directProvider = String(player?.provider || '').trim()
  if (directProvider) return cleanPlayerName(directProvider)

  const rawName = String(player?.name || player?.key || '')
  if (!rawName.includes('>')) return ''

  const segments = rawName
    .split('>')
    .map((segment) => segment.trim())
    .filter(Boolean)
  if (!segments.length) return ''

  const root = segments[0].toUpperCase()
  if ((root === 'KINOBOX' || root === 'KINOBD' || root === 'RHSERV') && segments[1]) {
    return cleanPlayerName(segments[1])
  }

  return cleanPlayerName(segments[0])
}

export function getProviderDisplayName(player) {
  const provider = getProviderName(player)
  return provider || cleanPlayerName(player?.translate) || 'Плеер'
}

export const getBestMpvStreamUrl = (player) => {
  const candidateUrls = [
    player?.file,
    player?.url,
    player?.stream,
    player?.stream_url,
    player?.hls,
    player?.m3u8,
    player?.raw_data?.file,
    player?.raw_data?.url,
    player?.raw_data?.stream,
    player?.raw_data?.stream_url,
    player?.raw_data?.hls,
    player?.raw_data?.m3u8
  ]

  for (const candidate of candidateUrls) {
    const value = String(candidate || '').trim()
    if (/^https?:\/\//i.test(value) && /\.m3u8(\?|$)/i.test(value)) {
      return value
    }
  }

  const iframeUrl = String(player?.iframe || '').trim()
  if (!iframeUrl) return ''

  try {
    const parsed = new URL(iframeUrl)
    const queryValues = []
    parsed.searchParams.forEach((value) => queryValues.push(value))
    for (const value of queryValues) {
      if (/^https?:\/\//i.test(value) && /\.m3u8(\?|$)/i.test(value)) {
        return value
      }
    }
  } catch {
    return ''
  }

  return ''
}

export const copyText = async (text) => {
  if (!text) return false
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
