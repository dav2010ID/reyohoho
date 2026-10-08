import { readLegacyHistory } from './history-data.js'

const targetOrigin = 'https://reyhoho.fun'
const status = document.querySelector('#status')
const transfer = document.querySelector('#transfer')
const download = document.querySelector('#download')
if (location.origin !== 'https://dav2010id.github.io') {
  status.textContent = 'Эта страница должна быть опубликована на dav2010id.github.io, без custom domain.'
} else {
  const history = readLegacyHistory(localStorage)
  status.textContent = `Найдено фильмов: ${history.length}`
  const nonce = location.hash.slice(1)
  transfer.disabled = !window.opener || !/^[a-f0-9-]{36}$/.test(nonce) || !history.length
  download.disabled = !history.length
  transfer.addEventListener('click', () => {
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
