// Task Management Service
// Handles all task-related API calls and real-time communication

import { get, post, put, del } from './apiClient'

// Types
export type TaskStatus = 'Under-review' | 'In-progress' | 'Completed'

export interface Task {
  _id?: string
  belongs: {
    isBelongsTo: boolean
    itBelongsTo?: string
  }
  incharge: string
  title: string
  description?: string
  status: TaskStatus
  dueDate: string
  createdAt?: string
  updatedAt?: string
  taskConfig: {
    coverImage?: string
    startDate?: string
    notifyBeforeHours?: number
    notifyBeforeDays?: number
  }
  comments: Array<{
    commenter: string
    comment: string
    createdAt: string
    updatedAt: string
    _id?: string
  }>
  attachmentsFile: Array<{
    filename: string
    url: string
    description?: string
    _id?: string
  }>
  subtasks: Array<{
    title: string
    description?: string
    status: TaskStatus
    dueDate?: string
    createdAt?: string
    updatedAt?: string
    _id?: string
  }>
}

export interface Notification {
  _id?: string
  user: string
  task: string
  type: 'deadline_reminder' | 'task_completed' | 'subtask_completed'
  title: string
  message: string
  isRead: boolean
  isEmailSent: boolean
  scheduledFor?: string
  createdAt?: string
}


// Task CRUD operations
export const createTask = (taskData: Partial<Task> | FormData) => {
  if (taskData instanceof FormData) {
    return post('/tasks', taskData, {
      'Content-Type': 'multipart/form-data'
    })
  }
  return post('/tasks', taskData)
}

export const getTasks = (params?: {
  status?: string
  priority?: string
  incharge?: string
  limit?: number
  skip?: number
  sortBy?: string
  sortOrder?: string
}) =>
  get('/tasks', params as any)

export const getTaskById = (taskId: string) =>
  get(`/tasks/${taskId}`)

export const updateTask = (taskId: string, updates: Partial<Task>) =>
  put(`/tasks/${taskId}`, updates)

export const updateTaskStatus = (taskId: string, status: Task['status']) =>
  put(`/tasks/${taskId}/status`, { status })

export const deleteTask = (taskId: string) =>
  del(`/tasks/${taskId}`)

// Comment operations
export const addComment = (taskId: string, commenter: string, comment: string) =>
  post(`/tasks/${taskId}/comments`, { commenter, comment })

// Attachment operations
export const addAttachment = (taskId: string, filename: string, url: string, description?: string) =>
  post(`/tasks/${taskId}/attachments`, { filename, url, description })

export const deleteAttachment = (taskId: string, attachmentId: string) =>
  del(`/tasks/${taskId}/attachments/${attachmentId}`)

// Subtask operations
export const addSubtask = (taskId: string, subtask: {
  title: string
  description?: string
  status?: TaskStatus
  dueDate?: string
}) =>
  post(`/tasks/${taskId}/subtasks`, subtask)

export const updateSubtask = (taskId: string, subtaskId: string, updates: Partial<Task['subtasks'][0]>) =>
  put(`/tasks/${taskId}/subtasks/${subtaskId}`, updates)

export const deleteSubtask = (taskId: string, subtaskId: string) =>
  del(`/tasks/${taskId}/subtasks/${subtaskId}`)

// Notification operations
export const getNotifications = (params?: {
  userId?: string
  isRead?: boolean
  limit?: number
  skip?: number
}) =>
  get('/notifications', params as any)

export const markNotificationAsRead = (notificationId: string) =>
  put(`/notifications/${notificationId}/read`, {})

export const markAllNotificationsAsRead = (userId: string) =>
  put('/notifications/mark-all-read', { userId })

export const createNotification = (notification: Partial<Notification>) =>
  post('/notifications', notification)

export const deleteNotification = (notificationId: string) =>
  del(`/notifications/${notificationId}`)

// Utility functions
export const getTaskProgress = (task: Task): number => {
  if (task.subtasks.length === 0) return 0

  const completedSubtasks = task.subtasks.filter(subtask => subtask.status === 'Completed').length
  return Math.round((completedSubtasks / task.subtasks.length) * 100)
}

export const getTaskStatusColor = (task: Task): string => {
  const now = new Date()
  const dueDate = new Date(task.dueDate)

  if (task.status === 'Completed') return 'green'

  const timeDiff = dueDate.getTime() - now.getTime()
  const hoursDiff = timeDiff / (1000 * 60 * 60)

  if (hoursDiff < 0) return 'red' // Overdue
  if (hoursDiff <= 1) return 'red' // Due within 1 hour
  if (hoursDiff <= 24) return 'orange' // Due within 24 hours
  if (hoursDiff <= 168) return 'yellow' // Due within 1 week

  return 'green' // Due later
}

export const isTaskUrgent = (task: Task): boolean => {
  const color = getTaskStatusColor(task)
  return color === 'red' || color === 'orange'
}