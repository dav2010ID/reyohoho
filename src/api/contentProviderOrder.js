import { CONTENT_PROVIDERS } from '@/api/providerRegistry'

export const getPlayerProviderOrder = (configuredProvider) => {
  if (configuredProvider === CONTENT_PROVIDERS.DDBB_LIVE)
    return [CONTENT_PROVIDERS.DDBB_LIVE, CONTENT_PROVIDERS.KINOBOX]

  // Player discovery is a fallback chain, not a combined list of mirrors.
  // DDBB Live goes first: on 2026-11-07 it answered every probe in about 0.4 s while
  // DDBB reset TLS connections and Kinobox timed out.
  return [CONTENT_PROVIDERS.DDBB_LIVE, CONTENT_PROVIDERS.DDBB, CONTENT_PROVIDERS.KINOBOX]
}

// Cards always come from the Worker, whatever player source is selected.
export const getMovieInfoProviderOrder = () => [CONTENT_PROVIDERS.KINOBOX]
