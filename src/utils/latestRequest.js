export const createLatestRequestGuard = () => {
  let latestRequestId = 0

  return {
    begin: () => ++latestRequestId,
    isLatest: (requestId) => requestId === latestRequestId,
    invalidate: () => ++latestRequestId
  }
}
