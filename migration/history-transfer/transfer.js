import { readLegacyHistory } from './history-data.js'

const targetOrigin = 'https://reyhoho.fun'
const status = document.querySelector('#status')
const transfer = document.querySelector('#transfer')
const download = document.querySelector('#download')
if (location.origin !== 'https://dav2010id.github.io') {
  status.textContent = 'Эта страница должна быть опубликована на dav2010id.github.io, без custom domain.'
} else {
  let history = []
  let storageAvailable = true
  try {
    const storage = localStorage
    storage.getItem('main')
    history = readLegacyHistory(storage)
  } catch {
    storageAvailable = false
  }
  const nonce = location.hash.slice(1)
  transfer.disabled = !window.opener || !/^[a-f0-9-]{36}$/.test(nonce) || !history.length
  download.disabled = !history.length
  status.textContent = !storageAvailable
    ? 'Браузер запретил доступ к локальной истории. Разрешите хранение данных для старого сайта.'
    : !history.length
      ? 'История не найдена. Откройте страницу в том браузере и профиле, где смотрели фильмы.'
      : transfer.disabled
        ? `Найдено фильмов: ${history.length}. Для переноса откройте эту страницу кнопкой в настройках нового сайта или скачайте JSON.`
        : `Найдено фильмов: ${history.length}`
  transfer.addEventListener('click', () => {
    if (!window.opener || window.opener.closed) {
      status.textContent = 'Окно нового сайта закрыто. Начните перенос заново из его настроек.'
      transfer.disabled = true
      return
    }
    window.opener.postMessage({ type: 'reyohoho-history', nonce, history }, targetOrigin)
    transfer.disabled = true
    status.textContent = 'Список передан. Подтвердите импорт на новом сайте.'
  })
  download.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, history })], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'reyohoho-history.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  })
}
