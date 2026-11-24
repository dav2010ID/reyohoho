import { CONTENT_PROVIDERS } from '@/api/providerRegistry'

// Title search always goes through the Worker.
export const getSearchProviderOrder = () => [CONTENT_PROVIDERS.WORKER]
