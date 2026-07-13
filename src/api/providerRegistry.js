export const CONTENT_PROVIDERS = {
  RHSERV: 'rhserv',
  KINOBD: 'kinobd',
  KINOBOX: 'kinobox',
  DDBB: 'ddbb',
  DDBB_LIVE: 'ddbb_live',
  LOCAL: 'local'
}

export const KINOBD_SUPPORTED_METHODS = new Set([
  'apiSearch',
  'getKpInfo',
  'getMovies',
  'getDiscussedMovies',
  'getKpIDfromIMDB',
  'getRandomMovie'
])
export const KINOBOX_SUPPORTED_METHODS = new Set(['getPlayers'])
export const DDBB_SUPPORTED_METHODS = new Set(['getPlayers'])
export const LOCAL_SUPPORTED_METHODS = new Set([
  'getShikiInfo',
  'getShikiPlayers',
  'getKpIDfromSHIKI',
  'getRating',
  'setRating',
  'getRandomMovie'
])

const defaultImporters = {
  rhserv: () => import('@/api/movies.rhserv'),
  kinobd: () => import('@/api/movies.kinobd'),
  kinobox: () => import('@/api/movies.kinobox'),
  ddbb: () => import('@/api/movies.ddbb'),
  ddbb_live: () => import('@/api/movies.ddbb-live'),
  local: () => import('@/api/movies.local')
}

export const createProviderRegistry = (importers = defaultImporters) => {
  const providerPromises = new Map()

  const loadProvider = async (provider) => {
    const importer = importers[provider]
    if (!importer) {
      throw new Error(`Unknown content provider: ${provider}`)
    }
    if (!providerPromises.has(provider)) {
      providerPromises.set(provider, importer())
    }
    return await providerPromises.get(provider)
  }

  return { loadProvider }
}

export const { loadProvider } = createProviderRegistry()
