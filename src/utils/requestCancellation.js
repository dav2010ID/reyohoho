const CANCELLATION_ERROR_NAMES = new Set(['AbortError', 'CanceledError'])

export const isRequestCanceled = (error) =>
  error?.code === 'ERR_CANCELED' || CANCELLATION_ERROR_NAMES.has(error?.name)

export const rethrowRequestCancellation = (error) => {
  if (isRequestCanceled(error)) throw error
}
