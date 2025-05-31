import { defineStore } from 'pinia'
import {
  getNotifications,
  getUnreadNotificationsCount,
  markNotificationsAsRead,
  deleteNotification
} from '@/api/notifications'

export const useNotificationsStore = defineStore('notifications', {
  state: () => ({
    notifications: [],
    unreadCount: 0,
    loading: false,
    error: null,
    lastFetchTime: null
  }),

  actions: {
    async fetchNotifications() {
      this.loading = true
      this.error = null

      try {
        const data = await getNotifications()
        this.notifications = data.notifications || []
        this.unreadCount = data.unread_count || 0
        this.lastFetchTime = Date.now()
      } catch (error) {
        this.error = error.response?.data?.error || 'Ошибка загрузки уведомлений'
        console.error('Error fetching notifications:', error)
      } finally {
        this.loading = false
      }
    },

    async fetchUnreadCount() {
      try {
        const data = await getUnreadNotificationsCount()
        this.unreadCount = data.unread_count || 0
      } catch (error) {
        console.error('Error fetching unread count:', error)
      }
    },

    async markAsRead(notificationIds = null) {
      try {
        await markNotificationsAsRead(notificationIds)

        if (notificationIds) {
          this.notifications.forEach((notification) => {
            if (notificationIds.includes(notification.id)) {
              notification.is_read = true
              notification.read_at = new Date().toISOString()
            }
          })
          this.unreadCount = Math.max(0, this.unreadCount - notificationIds.length)
        } else {
          this.notifications.forEach((notification) => {
            notification.is_read = true
            notification.read_at = new Date().toISOString()
          })
          this.unreadCount = 0
        }
      } catch (error) {
        this.error = error.response?.data?.error || 'Ошибка при отметке уведомлений'
        console.error('Error marking notifications as read:', error)
        throw error
      }
    },

    async deleteNotification(notificationId) {
      try {
        await deleteNotification(notificationId)

        const notification = this.notifications.find((n) => n.id === notificationId)
        if (notification && !notification.is_read) {
          this.unreadCount = Math.max(0, this.unreadCount - 1)
        }

        this.notifications = this.notifications.filter((n) => n.id !== notificationId)
      } catch (error) {
        this.error = error.response?.data?.error || 'Ошибка удаления уведомления'
        console.error('Error deleting notification:', error)
        throw error
      }
    },

    clearError() {
      this.error = null
    },

    reset() {
      this.notifications = []
      this.unreadCount = 0
      this.loading = false
      this.error = null
      this.lastFetchTime = null
    }
  },

  getters: {
    unreadNotifications: (state) => {
      return state.notifications.filter((notification) => !notification.is_read)
    },

    getNotificationsByType: (state) => (type) => {
      return state.notifications.filter((notification) => notification.type === type)
    },

    hasUnreadNotifications: (state) => {
      return state.unreadCount > 0
    }
  }
})
