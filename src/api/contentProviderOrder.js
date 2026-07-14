import { CONTENT_PROVIDERS } from '@/api/providerRegistry'

const REMOTE_PLAYER_PROVIDERS = [
  CONTENT_PROVIDERS.DDBB,
  CONTENT_PROVIDERS.DDBB_LIVE,
  CONTENT_PROVIDERS.KINOBOX,
  CONTENT_PROVIDERS.KINOBD
]

const REMOTE_MOVIE_INFO_PROVIDERS = [
  CONTENT_PROVIDERS.RHSERV,
  CONTENT_PROVIDERS.KINOBOX,
  CONTENT_PROVIDERS.KINOBD
]

const configuredFirst = (configuredProvider, providers) => [
  configuredProvider,
  ...providers.filter((provider) => provider !== configuredProvider)
].filter((provider) => providers.includes(provider))

export const getPlayerProviderOrder = (configuredProvider) => {
  if (configuredProvider === CONTENT_PROVIDERS.LOCAL) return [CONTENT_PROVIDERS.LOCAL]

  const aggregateProviders = [CONTENT_PROVIDERS.DDBB]
  return configuredFirst(configuredProvider, [
    ...REMOTE_PLAYER_PROVIDERS.filter((provider) => provider === configuredProvider),
    ...aggregateProviders
  ])
}

export const getMovieInfoProviderOrder = (configuredProvider) => {
  const providers =
    configuredProvider === CONTENT_PROVIDERS.LOCAL
      ? [CONTENT_PROVIDERS.LOCAL, ...REMOTE_MOVIE_INFO_PROVIDERS]
      : REMOTE_MOVIE_INFO_PROVIDERS

  return configuredFirst(configuredProvider, providers)
}
