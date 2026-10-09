import { useAuthStore } from '@/store/auth'

export const workerAuthEnabled = import.meta.env.VITE_WORKER_AUTH_ENABLED === 'true'

export async function workerAccountRequest(
  path,
  method = 'GET',
  body,
  { anonymous = false, token } = {}
) {
  if (
    !/^\/(?:auth\/[a-z-]+|user(?:\/name)?|list-status\/[1-9]\d{0,11}|list\/[a-z]+(?:\/[1-9]\d{0,11})?|user-list\/[1-9]\d{0,19}\/[a-z]+|user-list-counters\/[1-9]\d{0,19}|notifications(?:\/unread-count)?)$/.test(
      path
    )
  )
    throw new Error('Неподдерживаемый endpoint аккаунта')
  const session = token ?? useAuthStore().token
  if (!anonymous && !/^rh1_[A-Za-z0-9_-]{43}$/.test(session || ''))
    throw new Error('Требуется вход через Telegram')
  const response = await fetch(`https://api.reyhoho.fun/api${path}`, {
    method,
    credentials: 'omit',
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
    headers: {
      'Content-Type': 'application/json',
      ...(!anonymous ? { Authorization: `Bearer ${session}` } : {})
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  })
  const data = await response.json()
  if (!anonymous && token === undefined && useAuthStore().token !== session)
    throw new Error('Аккаунт изменился. Повторите операцию')
  if (!response.ok) {
    const error = new Error(
      response.status === 503
        ? 'Сервис аккаунта временно недоступен. Попробуйте позже.'
        : `Ошибка аккаунта (${response.status})`
    )
    error.response = { status: response.status, data: { error: error.message } }
    throw error
  }
  return data
}

export const workerAccountAdapter = {
  get: async (path) => ({ data: await workerAccountRequest(path) }),
  put: async (path, body) => ({ data: await workerAccountRequest(path, 'PUT', body) }),
  delete: async (path) => ({ data: await workerAccountRequest(path, 'DELETE') })
}
