export function cleanPlayerName(name) {
  return String(name || '')
    .replace(/KODIK>/, 'Kodik - ')
    .replace(/VEOVEO>/, 'VeoVeo - ')
    .replace(/KINOBOX>/, '')
    .replace(/DDBB LIVE>/, '')
    .replace(/DDBB>/, '')
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
  if (
    (root === 'KINOBOX' ||
      root === 'DDBB' ||
      root === 'DDBB LIVE' ||
      root === 'KINOBD' ||
      root === 'RHSERV') &&
    segments[1]
  ) {
    return cleanPlayerName(segments[1])
  }

  return cleanPlayerName(segments[0])
}

export function getProviderDisplayName(player) {
  const provider = getProviderName(player)
  const translation = cleanPlayerName(player?.translate)
  if (provider && translation && provider.toLowerCase() !== translation.toLowerCase()) {
    return `${provider} — ${translation}`
  }
  return provider || translation || 'Плеер'
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
