import { useAuthStore } from '@/store/auth'
import { reactive } from 'vue'
import { useMainStore } from '@/store/main'
import { normalizeHistory } from '../../shared/history-data.js'
import { enrichListMetadata } from './listMetadata'

export const cloudHistoryAvailable =
  import.meta.env.VITE_CLOUD_HISTORY_ENABLED === 'true' ||
  import.meta.env.VITE_WORKER_AUTH_ENABLED === 'true'

export function isCloudHistoryEnabled() {
  const auth = useAuthStore()
  return (
    cloudHistoryAvailable &&
    auth.isAuthenticated &&
    (auth.isWorkerSession || useMainStore().cloudHistoryAccount === String(auth.user.id))
  )
}

export async function historyRequest(path = '', method = 'GET', body) {
  const auth = useAuthStore()
  if (!cloudHistoryAvailable || !auth.isAuthenticated)
    throw new Error('Войдите в аккаунт для облачной истории')
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
  if (useAuthStore().token !== token) throw new Error('Аккаунт изменился. Повторите операцию')
  if (!response.ok) {
    const error = new Error(
      response.status === 503
        ? 'Облачная история пока недоступна. Локальная история сохранена'
        : `Ошибка облачной истории (${response.status})`
    )
    error.response = { headers: response.headers, status: response.status, data: { error: error.message } }
    throw error
  }
  const data = await response.json()
  if (useAuthStore().token !== token) throw new Error('Аккаунт изменился. Повторите операцию')
  return data
}

export async function getCloudHistory() {
  const token = useAuthStore().token
  const items = []
  const seen = new Set()
  let cursor = null
  do {
    if (useAuthStore().token !== token) throw new Error('Аккаунт изменился. Повторите операцию')
    const page = await historyRequest(cursor ? `?cursor=${encodeURIComponent(cursor)}` : '')
    if (!Array.isArray(page.history)) throw new Error('Неполный ответ облачной истории')
    items.push(...page.history)
    if (items.length > 5000) throw new Error('Превышен лимит облачной истории')
    cursor = page.nextCursor || null
    if (cursor && seen.has(cursor)) throw new Error('Ошибка пагинации истории')
    if (cursor) seen.add(cursor)
  } while (cursor)
  return normalizeHistory(items, 5000)
}

export async function importCloudHistory(items) {
  const token = useAuthStore().token
  const normalized = normalizeHistory(items, 5000)
  for (let i = 0; i < normalized.length; i += 40) {
    if (useAuthStore().token !== token) throw new Error('Аккаунт изменился. Повторите операцию')
    await historyRequest('/import', 'POST', { history: normalized.slice(i, i + 40) })
  }
  if (useAuthStore().token !== token) throw new Error('Аккаунт изменился. Повторите операцию')
  const cards = reactive(await getCloudHistory())
  void enrichListMetadata(cards, {
    isCurrent: () => useAuthStore().token === token,
    onItem: (item, index) => {
      cards[index] = item
    },
    persist: (metadata) => historyRequest(`/${metadata.kp_id}`, 'PATCH', { metadata })
  }).catch(() => {})
  return cards
}
