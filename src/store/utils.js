import { LEGACY_STORE_KEY, LEGACY_STORE_KEY_BACKUP, MAIN_STORE_NAME } from './constants'

export const CONTENT_PROVIDER_DDBB_DEFAULT_MIGRATION_KEY = 'main:contentApiProviderDefault:ddbb:v1'

const LEGACY_PLAYER_PROVIDERS_TO_DDBB = new Set(['kinobox', 'rhserv'])

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

function migrateMainContentProviderDefault(ctx) {
  if (typeof window === 'undefined' || !window.localStorage) return
  if (ctx.store.$id !== MAIN_STORE_NAME) return
  if (localStorage.getItem(CONTENT_PROVIDER_DDBB_DEFAULT_MIGRATION_KEY) === 'done') return

  const raw = localStorage.getItem(MAIN_STORE_NAME)
  if (!raw) {
    localStorage.setItem(CONTENT_PROVIDER_DDBB_DEFAULT_MIGRATION_KEY, 'done')
    return
  }

  try {
    const persistedMain = JSON.parse(raw)
    const provider = String(persistedMain?.contentApiProvider || '').toLowerCase()

    if (LEGACY_PLAYER_PROVIDERS_TO_DDBB.has(provider)) {
      persistedMain.contentApiProvider = 'ddbb'
      localStorage.setItem(MAIN_STORE_NAME, JSON.stringify(persistedMain))
    }

    localStorage.setItem(CONTENT_PROVIDER_DDBB_DEFAULT_MIGRATION_KEY, 'done')
  } catch (err) {
    console.error('Ошибка миграции дефолтного провайдера плееров:', err)
  }
}

export function beforeHydrateMainStore(ctx) {
  beforeHydrateLegacyVuex(ctx)
  migrateMainContentProviderDefault(ctx)
}
