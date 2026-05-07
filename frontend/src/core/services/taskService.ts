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
  members: string[]
  watchers: string[]
  title: string
  description?: string
  status: TaskStatus
  priority: string
  labels: Array<{
    name: string
    color: string
    _id?: string
  }>
  attachmentsFile: Array<Attachment>
  checklists: Array<{
    title: string
    items: Array<{
      text: string
      completed: boolean
      _id?: string
    }>
    _id?: string
  }>
  comments: Array<{
    commenter: string
    comment: string
    createdAt: string
    updatedAt: string
    _id?: string
  }>
  dueDate?: string
  startDate?: string
  completedAt?: string
  createdAt?: string
  taskConfig?: {
    coverImage?: string
    coverColor?: string
    estimatedTime?: number
    actualTime?: number
  }
}

export interface Attachment {
  _id?: string
  filename: string
  originalName: string
  url: string
  type: string
  size?: number
  uploadedBy: string
  uploadedAt: string
  description?: string
}

export interface Notification {
  _id?: string
  user: string
  task: string
  type: 'deadline_reminder' | 'task_completed' | 'checklist_item_completed'
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
export const addAttachment = (taskId: string, formData: FormData) =>
  post(`/tasks/${taskId}/attachments`, formData, {
    'Content-Type': 'multipart/form-data'
  })

export const deleteAttachment = (taskId: string, attachmentId: string) =>
  del(`/tasks/${taskId}/attachments/${attachmentId}`)

// Subtask operations
export const addChecklist = (taskId: string, checklist: {
  title: string
  items: Array<{ text: string; completed?: boolean }>
}) =>
  post(`/tasks/${taskId}/checklists`, checklist)

export const updateChecklist = (taskId: string, checklistId: string, updates: {
  itemIndex?: number
  completed?: boolean
  itemText?: string
  deleteItemIndex?: number
  title?: string
  items?: Array<{ text: string; completed?: boolean }>
}) =>
  put(`/tasks/${taskId}/checklists/${checklistId}`, updates)

export const deleteChecklist = (taskId: string, checklistId: string) =>
  del(`/tasks/${taskId}/checklists/${checklistId}`)

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
  if (!task.checklists || task.checklists.length === 0) return 0

  let totalItems = 0
  let completedItems = 0

  task.checklists.forEach(checklist => {
    if (checklist.items) {
      totalItems += checklist.items.length
      completedItems += checklist.items.filter(item => item.completed).length
    }
  })

  if (totalItems === 0) return 0
  return Math.round((completedItems / totalItems) * 100)
}

export const getTaskStatusColor = (task: Task): string => {
  if (task.status === 'Completed') return 'green'
  if (!task.dueDate) return 'green'

  const now = new Date()
  const dueDate = new Date(task.dueDate)

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