const AUTH_REQUIRED_MESSAGE = 'Необходимо <a class="auth-link">авторизоваться</a>'

export function useNotificationService(notificationRef, openLogin) {
  const notify = (message, duration = 3000, options = {}) => {
    notificationRef.value?.showNotification(message, duration, options)
  }

  const notifyAuthRequired = () => {
    notify(AUTH_REQUIRED_MESSAGE, 5000, { onClick: openLogin })
  }

  return {
    notify,
    notifyAuthRequired
  }
}
