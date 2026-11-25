import { LEGACY_STORE_KEY, LEGACY_STORE_KEY_BACKUP, MAIN_STORE_NAME } from './constants'
import { replaceLocalList } from '@/utils/localUserLists'
import { PLAYER_SOURCES } from '@/api/providerRegistry'

// Markers of one-time provider migrations that no longer exist.
const RETIRED_MIGRATION_KEYS = [
  'main:contentApiProviderDefault:ddbb:v1',
  'main:contentApiProviderDefault:kinobox:v1'
]

export function beforeHydrateLegacyVuex(ctx) {
  if (typeof window === 'undefined' || !window.localStorage) return

  const legacyRaw = localStorage.getItem(LEGACY_STORE_KEY)
  if (!legacyRaw) return

  let legacyBackup = null

  try {
    // Сохраняем бекап на всякий случай
    localStorage.setItem(LEGACY_STORE_KEY_BACKUP, legacyRaw)
    legacyBackup = JSON.parse(localStorage.getItem(LEGACY_STORE_KEY_BACKUP))

    const legacy = JSON.parse(legacyRaw)

    if (
      ctx.store.$id === 'main' &&
      Array.isArray(legacy.history) &&
      typeof legacy.isHistoryAllowed === 'boolean'
    ) {
      localStorage.setItem(
        ctx.store.$id,
        JSON.stringify({
          history: legacy.history,
          isHistoryAllowed: legacy.isHistoryAllowed
        })
      )

      delete legacy.history
      delete legacy.isHistoryAllowed
    } else if (legacy[ctx.store.$id]) {
      localStorage.setItem(ctx.store.$id, JSON.stringify(legacy[ctx.store.$id]))

      delete legacy[ctx.store.$id]
    }

    // Если других данных нет — удалить весь vuex
    if (Object.keys(legacy).length === 0) {
      localStorage.removeItem(LEGACY_STORE_KEY)
      localStorage.removeItem(LEGACY_STORE_KEY_BACKUP)
    } else {
      localStorage.setItem(LEGACY_STORE_KEY, JSON.stringify(legacy))
    }
  } catch (err) {
    console.error('Ошибка миграции из legacy vuex:', err)

    if (legacyBackup) localStorage.setItem(LEGACY_STORE_KEY, JSON.stringify(legacyBackup))
  }
}

export function beforeHydrateMainStore(ctx) {
  beforeHydrateLegacyVuex(ctx)
  if (ctx.store.$id !== MAIN_STORE_NAME || typeof window === 'undefined' || !window.localStorage) return
  for (const key of RETIRED_MIGRATION_KEYS) localStorage.removeItem(key)
  const raw = localStorage.getItem(MAIN_STORE_NAME)
  if (!raw) return
  try {
    const persisted = JSON.parse(raw)
    if (Array.isArray(persisted.history)) {
      if (!replaceLocalList('history', persisted.history, persisted.historyOwner || 'guest')) return
      delete persisted.history
    }
    // Only the two DDBB player sources remain; older choices (Kinobox, local
    // backend, KinoBD, rhserv) fall back to the default.
    if (
      'contentApiProvider' in persisted &&
      !PLAYER_SOURCES.includes(persisted.contentApiProvider)
    ) {
      persisted.contentApiProvider = PLAYER_SOURCES[0]
    }
    delete persisted.searchApiProvider
    localStorage.setItem(MAIN_STORE_NAME, JSON.stringify(persisted))
  } catch (error) {
    console.warn('Не удалось обновить источник поиска:', error)
  }
}
