// Production content comes from the site's Worker (Kinobox/Kinopoisk) and the
// two DDBB player sources. The optional legacy backend and KinoBD are gone.
export const CONTENT_PROVIDERS = {
  KINOBOX: 'kinobox',
  DDBB: 'ddbb',
  DDBB_LIVE: 'ddbb_live'
}

const defaultImporters = {
  kinobox: () => import('@/api/movies.kinobox'),
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
