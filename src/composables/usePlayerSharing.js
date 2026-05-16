import { copyText } from '@/utils/playerUtils'

export function usePlayerSharing({ notificationRef }) {
  const copyMovieLink = () => {
    const movieLink = window.location.href
    navigator.clipboard.writeText(movieLink).then(() => {})
    notificationRef.value.showNotification('Ссылка на фильм скопирована')
  }

  return {
    copyMovieLink
  }
}
