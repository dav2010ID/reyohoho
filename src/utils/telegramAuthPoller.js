export const createTelegramAuthPoller = ({
  checkAuth,
  onAuthenticated,
  onExpired,
  onError,
  intervalMs = 2000,
  now = () => Date.now()
}) => {
  let intervalId = null
  let expiresAt = 0
  let token = ''
  let inFlight = false
  let generation = 0

  const stop = () => {
    generation += 1
    if (intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  const poll = async () => {
    if (intervalId === null || inFlight) return
    if (now() >= expiresAt) {
      stop()
      onExpired?.()
      return
    }

    const pollGeneration = generation
    inFlight = true
    try {
      const response = await checkAuth(token)
      if (pollGeneration !== generation) return
      if (response?.authenticated && response?.token) {
        stop()
        await onAuthenticated(response.token)
      }
    } catch (error) {
      if (pollGeneration === generation) {
        onError?.(error)
      }
    } finally {
      inFlight = false
    }
  }

  const start = (newToken, expiresInSeconds = 600) => {
    stop()
    token = newToken
    expiresAt = now() + Math.max(1, Number(expiresInSeconds) || 600) * 1000
    intervalId = setInterval(() => void poll(), intervalMs)
  }

  return {
    start,
    stop,
    isActive: () => intervalId !== null
  }
}
