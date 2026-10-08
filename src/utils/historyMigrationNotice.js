// A fixed campaign deadline, not a new month for each returning visitor.
export const HISTORY_MIGRATION_NOTICE_END = Date.parse('2026-11-09T00:00:00Z')
export const HISTORY_MIGRATION_DISMISSED_KEY = 'reyohoho-history-migration-notice-v1'

export function shouldShowHistoryMigrationNotice(now, storage) {
  if (now >= HISTORY_MIGRATION_NOTICE_END) return false
  try {
    return storage.getItem(HISTORY_MIGRATION_DISMISSED_KEY) !== 'dismissed'
  } catch {
    return true
  }
}
