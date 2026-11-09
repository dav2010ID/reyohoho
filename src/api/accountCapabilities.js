import { legacyBackendAvailable } from './backendConfig'

export const accountCapabilities = (auth) => {
  const available = Boolean(auth.token && !auth.isWorkerSession && legacyBackendAvailable())
  return { rated: available, sharing: available, notifications: available }
}
