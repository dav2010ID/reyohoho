import { normalizeHistory } from '../../migration/history-transfer/history-data.js'

export const LEGACY_ORIGIN = 'https://dav2010id.github.io'
export const TRANSFER_URL = `${LEGACY_ORIGIN}/reyohoho-history-transfer/`

export function validateTransferMessage(event, popup, nonce) {
  if (event.origin !== LEGACY_ORIGIN || event.source !== popup ||
      event.data?.type !== 'reyohoho-history' || event.data?.nonce !== nonce) return null
  return normalizeHistory(event.data.history)
}

export function startHistoryTransfer(onHistory, onError) {
  const nonce = crypto.randomUUID()
  const popup = window.open(`${TRANSFER_URL}#${nonce}`, 'reyohoho-history-transfer', 'width=620,height=560')
  if (!popup) { onError('Разрешите всплывающие окна для переноса истории'); return () => {} }
  let timeout
  const cleanup = () => { window.removeEventListener('message', receive); clearTimeout(timeout) }
  const receive = (event) => {
    try {
      const history = validateTransferMessage(event, popup, nonce)
      if (!history) return
      cleanup()
      onHistory(history)
    } catch { cleanup(); onError('Некорректный формат истории') }
  }
  window.addEventListener('message', receive)
  timeout = setTimeout(() => {
    cleanup()
    onError('Перенос не завершён. Проверьте, опубликована ли страница переноса')
  }, 120000)
  return cleanup
}
