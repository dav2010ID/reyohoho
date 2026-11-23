import { HISTORY_CAPACITY } from '../../shared/history-data.js'

const messages = {
  list_capacity: (data) =>
    `Список заполнен: в нём может быть не больше ${data.limit || 1000} фильмов. Удалите лишние и повторите.`,
  history_capacity: () =>
    `Облачная история заполнена: не больше ${HISTORY_CAPACITY} записей. Удалите старые записи и повторите.`
}

// Turn a non-2xx Worker reply into an Error that keeps the typed server code.
export async function accountError(response, fallback) {
  let data = null
  try {
    data = await response.json()
  } catch {
    /* Error bodies are optional. */
  }
  const code = typeof data?.error === 'string' && messages[data.error] ? data.error : undefined
  const error = new Error(
    code
      ? messages[code](data)
      : response.status === 413
        ? 'Слишком большой запрос. Повторите операцию'
        : fallback(response.status)
  )
  if (code) error.code = code
  error.response = {
    headers: response.headers,
    status: response.status,
    data: { ...(data && typeof data === 'object' ? data : {}), error: error.message }
  }
  return error
}
