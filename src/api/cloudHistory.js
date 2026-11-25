import { useAuthStore } from '@/store/auth'
import { reactive } from 'vue'
import { useMainStore } from '@/store/main'
import { HISTORY_CAPACITY, HistoryCapacityError, normalizeHistory } from '../../shared/history-data.js'
import { chunkByBytes } from '@/utils/importBatches'
import { accountError } from './accountErrors'
import { enrichListMetadata } from './listMetadata'
import { WORKER_API_URL } from '@/api/workerOrigin'

// Worker limits for POST /api/history/import (the API Worker's history.mjs).
const HISTORY_IMPORT_ITEMS = 40
const HISTORY_IMPORT_BYTES = 390000

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
  const response = await fetch(`${WORKER_API_URL}/api/history${path}`, {
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
  if (!response.ok)
    throw await accountError(response, (status) =>
      status === 503
        ? 'Облачная история пока недоступна. Локальная история сохранена'
        : `Ошибка облачной истории (${status})`
    )
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
    if (items.length > HISTORY_CAPACITY) throw new Error('Превышен лимит облачной истории')
    cursor = page.nextCursor || null
    if (cursor && seen.has(cursor)) throw new Error('Ошибка пагинации истории')
    if (cursor) seen.add(cursor)
  } while (cursor)
  return normalizeHistory(items, HISTORY_CAPACITY)
}

export async function importCloudHistory(items) {
  const token = useAuthStore().token
  if (Array.isArray(items) && items.length > HISTORY_CAPACITY)
    throw new HistoryCapacityError(items.length)
  const batches = chunkByBytes(normalizeHistory(items, HISTORY_CAPACITY), {
    maxItems: HISTORY_IMPORT_ITEMS,
    maxBytes: HISTORY_IMPORT_BYTES,
    envelope: (history) => ({ history, partial: true })
  })
  let rejected = 0
  for (const history of batches) {
    if (useAuthStore().token !== token) throw new Error('Аккаунт изменился. Повторите операцию')
    try {
      rejected += Number((await historyRequest('/import', 'POST', { history, partial: true })).rejected) || 0
    } catch (error) {
      if (error.code !== 'history_capacity') throw error
      rejected += history.length
    }
  }
  // Everything that fitted is saved; report what did not instead of hiding it.
  if (rejected) {
    const error = new Error(
      `Облачная история заполнена (${HISTORY_CAPACITY} записей): не перенесено ${rejected}. Удалите старые записи и повторите.`
    )
    error.code = 'history_capacity'
    error.rejected = rejected
    throw error
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
