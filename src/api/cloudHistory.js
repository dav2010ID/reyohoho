import { useAuthStore } from '@/store/auth'
import { useMainStore } from '@/store/main'
import { normalizeHistory } from '../../migration/history-transfer/history-data.js'

export const cloudHistoryAvailable = import.meta.env.VITE_CLOUD_HISTORY_ENABLED === 'true'

export function isCloudHistoryEnabled() {
  const auth = useAuthStore()
  return cloudHistoryAvailable && auth.isAuthenticated &&
    useMainStore().cloudHistoryAccount === String(auth.user.id)
}

export async function historyRequest(path = '', method = 'GET', body) {
  const auth = useAuthStore()
  if (!cloudHistoryAvailable || !auth.isAuthenticated) throw new Error('Войдите в аккаунт для облачной истории')
  const token = auth.token
  const response = await fetch(`https://api.reyhoho.fun/api/history${path}`, {
    method,
    credentials: 'omit',
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  })
  // Do not apply data to a different account after an in-flight login/logout.
  const data = await response.json()
  if (useAuthStore().token !== token) throw new Error('Аккаунт изменился. Повторите операцию')
  if (!response.ok) {
    const error = new Error(response.status === 503
      ? 'Облачная история пока недоступна. Локальная история сохранена'
      : `Ошибка облачной истории (${response.status})`)
    error.response = { status: response.status, data: { error: error.message } }
    throw error
  }
  return data
}

export async function importCloudHistory(items) {
  const normalized = normalizeHistory(items)
  const token = useAuthStore().token
  for (let i = 0; i < normalized.length; i += 40) {
    if (useAuthStore().token !== token) throw new Error('Аккаунт изменился. Повторите операцию')
    await historyRequest('/import', 'POST', { history: normalized.slice(i, i + 40) })
  }
  if (useAuthStore().token !== token) throw new Error('Аккаунт изменился. Повторите операцию')
  return normalizeHistory((await historyRequest()).history)
}
