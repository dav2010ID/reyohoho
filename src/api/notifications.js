import { getApi } from '@/api/axios'
import { useAuthStore } from '@/store/auth'
import { workerAccountAdapter } from './workerAccount'

let isErrorSimulationEnabled = false
const simulatedErrorCode = 500

const simulateErrorIfNeeded = async () => {
  if (isErrorSimulationEnabled && simulatedErrorCode) {
    const status = parseInt(simulatedErrorCode, 10)
    const error = new Error(`Симулированная ошибка ${status}`)
    error.response = { status }
    throw error
  }
}

const apiCall = async (callFn) => {
  await simulateErrorIfNeeded()
  const api = useAuthStore().isWorkerSession ? workerAccountAdapter : await getApi()
  return await callFn(api)
}

const getNotifications = async () => {
  const { data } = await apiCall((api) => api.get('/notifications'))
  return data
}

const getUnreadNotificationsCount = async () => {
  const { data } = await apiCall((api) => api.get('/notifications/unread-count'))
  return data
}

const markNotificationsAsRead = async (notificationIds = null) => {
  const { data } = await apiCall((api) =>
    api.post('/notifications/mark-read', { notification_ids: notificationIds })
  )
  return data
}

const deleteNotification = async (notificationId) => {
  const { data } = await apiCall((api) => api.delete(`/notifications/${notificationId}`))
  return data
}

export {
  getNotifications,
  getUnreadNotificationsCount,
  markNotificationsAsRead,
  deleteNotification
}

export const toggleErrorSimulation = (enabled) => {
  isErrorSimulationEnabled = enabled
}
