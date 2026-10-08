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
  let closedCheck
  const cleanup = () => {
    window.removeEventListener('message', receive)
    clearTimeout(timeout)
    clearInterval(closedCheck)
  }
  const receive = (event) => {
    try {
      const history = validateTransferMessage(event, popup, nonce)
      if (!history) return
      cleanup()
      if (!history.length) { onError('В старом браузере не найдена история'); return }
      onHistory(history)
    } catch { cleanup(); onError('Некорректный формат истории') }
  }
  window.addEventListener('message', receive)
  closedCheck = setInterval(() => {
    if (!popup.closed) return
    cleanup()
    onError('Окно переноса закрыто. Начните перенос заново или импортируйте JSON')
  }, 1000)
  timeout = setTimeout(() => {
    cleanup()
    onError('Перенос не завершён. Проверьте, опубликована ли страница переноса')
  }, 120000)
  return cleanup
}
