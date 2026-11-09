import { useMainStore } from '@/store/main'
import { legacyBackendAvailable } from './backendConfig'
import { CONTENT_PROVIDERS, LOCAL_SUPPORTED_METHODS } from './providerRegistry'

// Mirrors callWithProvider: only these methods have a direct local transport.
export const legacyMovieMethodAvailable = (method) =>
  legacyBackendAvailable() ||
  (LOCAL_SUPPORTED_METHODS.has(method) && useMainStore().contentApiProvider === CONTENT_PROVIDERS.LOCAL)
