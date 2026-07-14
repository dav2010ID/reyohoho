export const createLatestRequestGuard = () => {
  let latestRequestId = 0
  let activeController = null

  const abortActiveRequest = () => {
    activeController?.abort()
    activeController = null
  }

  return {
    begin: () => {
      abortActiveRequest()
      activeController = new AbortController()
      return ++latestRequestId
    },
    getSignal: (requestId) =>
      requestId === latestRequestId ? activeController?.signal || null : null,
    isLatest: (requestId) => requestId === latestRequestId,
    invalidate: () => {
      abortActiveRequest()
      return ++latestRequestId
    }
  }
}
