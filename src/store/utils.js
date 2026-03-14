import { LEGACY_STORE_KEY, LEGACY_STORE_KEY_BACKUP } from './constants'

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
