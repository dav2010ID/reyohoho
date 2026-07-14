import { CONTENT_PROVIDERS } from '@/api/providerRegistry'

const REMOTE_SEARCH_PROVIDERS = [
  CONTENT_PROVIDERS.RHSERV,
  CONTENT_PROVIDERS.KINOBD,
  CONTENT_PROVIDERS.KINOBOX
]

export const getSearchProviderOrder = (configuredProvider) => {
  const providers =
    configuredProvider === CONTENT_PROVIDERS.LOCAL
      ? [CONTENT_PROVIDERS.LOCAL, ...REMOTE_SEARCH_PROVIDERS]
      : REMOTE_SEARCH_PROVIDERS

  return [
    configuredProvider,
    ...providers.filter((provider) => provider !== configuredProvider)
  ].filter((provider) => providers.includes(provider))
}
