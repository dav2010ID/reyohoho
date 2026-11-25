// Cards, search and top lists come from the site's Worker; players come from
// the two DDBB sources. The legacy backend, KinoBD and Kinobox are gone.
export const CONTENT_PROVIDERS = {
  WORKER: 'worker',
  DDBB: 'ddbb',
  DDBB_LIVE: 'ddbb_live'
}

// The player sources a visitor can choose in the settings; the first is the default.
export const PLAYER_SOURCES = [CONTENT_PROVIDERS.DDBB_LIVE, CONTENT_PROVIDERS.DDBB]

const defaultImporters = {
  worker: () => import('@/api/movies.worker'),
  ddbb: () => import('@/api/movies.ddbb'),
  ddbb_live: () => import('@/api/movies.ddbb-live')
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
