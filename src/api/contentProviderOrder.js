import { CONTENT_PROVIDERS, PLAYER_SOURCES } from '@/api/providerRegistry'

// Player discovery is a fallback chain, not a combined list of mirrors: the
// chosen source first, then the other one. DDBB Live is the default: on
// 2026-11-07 it answered every probe in about 0.4 s while DDBB reset TLS connections.
export const getPlayerProviderOrder = (configuredProvider) => {
  const first = PLAYER_SOURCES.includes(configuredProvider) ? configuredProvider : PLAYER_SOURCES[0]
  return [first, ...PLAYER_SOURCES.filter((source) => source !== first)]
}

// Cards always come from the Worker, whatever player source is selected.
export const getMovieInfoProviderOrder = () => [CONTENT_PROVIDERS.WORKER]
