import { get, post, put, del } from './apiClient'

export interface EventAction {
  _id: string
  title: string
  actionDescription: string
  assignedPerson: {
    name: string
    email?: string
    role: string
    institution: string
  }
  dueDate: string
  currentStatus: {
    status: 'Pending' | 'In Progress' | 'Completed' | 'Cancelled'
    description: string
  }
  statusHistory: Array<{
    status: string
    description: string
    document?: {
      filename: string
      originalName: string
      mimetype: string
      size: number
      url: string
    }
    changedAt: string
  }>
  createdBy?: {
    name: string
    email?: string
    role?: string
    institution?: string
  }
  eventSpecialId: string
  createdAt?: string
  updatedAt?: string
}

export interface EventActionStats {
  total: number
  pending: number
  inProgress: number
  completed: number
  cancelled: number
}
export const getEventActions = (params?: {
  eventSpecialId?: string
  status?: string
  date?: string
  from?: string
  to?: string
  search?: string
  page?: number
  limit?: number
}) =>
  get('/v1/event-actions', params as any)

export const getEventActionById = (id: string) =>
  get(`/v1/event-actions/${id}`)

export const createEventAction = (data: Partial<EventAction>) =>
  post('/v1/event-actions', data)

export const updateEventAction = (id: string, data: Partial<EventAction>) =>
  put(`/v1/event-actions/${id}`, data)

export const deleteEventAction = (id: string) =>
  del(`/v1/event-actions/${id}`)

export const updateEventActionStatus = (id: string, status: EventAction['currentStatus']) =>
  put(`/v1/event-actions/${id}`, { currentStatus: status })
