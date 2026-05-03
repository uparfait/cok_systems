// TaskNotifications - Component to display task-related notifications

import React, { useState, useEffect } from 'react'
import { FiBell, FiX, FiClock, FiCheckCircle, FiAlertTriangle } from 'react-icons/fi'
import { useAuth } from '../../../core/contexts/AuthContext'
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '../../../core/services/taskService'
import type { Notification } from '../../../core/services/taskService'
import { useToast } from '../../../core/contexts/ToastContext'

const TaskNotifications: React.FC = () => {
  const { user } = useAuth()
  const { showSuccess, showError } = useToast()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [showDropdown, setShowDropdown] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  // Load notifications
  const loadNotifications = async () => {
    if (!user?.userId) return

    try {
      const response = await getNotifications({
        userId: user.userId,
        limit: 10
      })

      if (response.status) {
        const notifs = response.data.notifications || []
        setNotifications(notifs)
        setUnreadCount(notifs.filter((n: Notification) => !n.isRead).length)
      }
    } catch (error: any) {
      console.error('Error loading notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  // Mark notification as read
  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markNotificationAsRead(notificationId)
      setNotifications(prev =>
        prev.map(n => n._id === notificationId ? { ...n, isRead: true } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error: any) {
      showError(error?.message || 'Failed to mark notification as read')
    }
  }

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    if (!user?.userId) return

    try {
      await markAllNotificationsAsRead(user.userId)
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      setUnreadCount(0)
      showSuccess('All notifications marked as read')
    } catch (error: any) {
      showError(error?.message || 'Failed to mark all notifications as read')
    }
  }

  // Load notifications on mount
  useEffect(() => {
    loadNotifications()
  }, [user?.userId])

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'deadline_reminder':
        return <FiClock className="w-4 h-4 text-orange-500" />
      case 'task_completed':
        return <FiCheckCircle className="w-4 h-4 text-green-500" />
      case 'subtask_completed':
        return <FiCheckCircle className="w-4 h-4 text-blue-500" />
      default:
        return <FiBell className="w-4 h-4 text-gray-500" />
    }
  }

  return (
    <div className="relative">
      {/* Notification Bell */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg"
      >
        <FiBell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                <FiBell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification._id}
                  className={`p-4 border-b border-gray-100 hover:bg-gray-50 ${
                    !notification.isRead ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{notification.message}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatTime(notification.createdAt!)}
                      </p>
                    </div>
                    {!notification.isRead && (
                      <button
                        onClick={() => handleMarkAsRead(notification._id!)}
                        className="flex-shrink-0 text-xs text-blue-600 hover:text-blue-700"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-gray-200 text-center">
            <button
              onClick={() => setShowDropdown(false)}
              className="text-xs text-gray-600 hover:text-gray-900"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {showDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  )
}

export default TaskNotifications