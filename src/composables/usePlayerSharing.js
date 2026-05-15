import { copyText, getBestMpvStreamUrl } from '@/utils/playerUtils'

export function usePlayerSharing({ selectedPlayerInternal, notificationRef }) {
  const copyMpvLink = async () => {
    const current = selectedPlayerInternal.value
    if (!current) return

    const streamUrl = getBestMpvStreamUrl(current)
    const targetUrl = streamUrl || String(current.iframe || '')

    if (!targetUrl) {
      notificationRef.value.showNotification('Не удалось получить ссылку для mpv')
      return
    }

    const referrer = (() => {
      try {
        const base = new URL(String(current.iframe || ''))
        return `${base.origin}/`
      } catch {
        return ''
      }
    })()

    const mpvCommand = referrer
      ? `mpv --referrer="${referrer}" "${targetUrl}"`
      : `mpv "${targetUrl}"`

    const ok = await copyText(mpvCommand)
    if (ok) {
      notificationRef.value.showNotification('Команда mpv скопирована')
      return
    }

    const linkOk = await copyText(targetUrl)
    if (linkOk) {
      notificationRef.value.showNotification('Ссылка для mpv скопирована')
      return
    }

    notificationRef.value.showNotification('Не удалось скопировать ссылку для mpv')
  }

  const copyMovieLink = () => {
    const movieLink = window.location.href
    navigator.clipboard.writeText(movieLink).then(() => {})
    notificationRef.value.showNotification('Ссылка на фильм скопирована')
  }

  return {
    copyMpvLink,
    copyMovieLink
  }
}
