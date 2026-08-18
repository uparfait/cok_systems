import { get, post, patch, del } from './apiClient'

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
    documents?: Array<{
      filename: string
      originalName: string
      mimetype: string
      size: number
      url: string
    }>
    changedBy?: {
      name?: string
      email?: string
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
  assignedEmail?: string
  createdByEmail?: string
  page?: number
  limit?: number
}) => {
  // Filters must travel as query params (the get() helper's 2nd arg is headers)
  const qs = new URLSearchParams()
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.append(k, String(v))
  })
  const query = qs.toString()
  return get(`/v1/event-actions${query ? `?${query}` : ''}`)
}

export const getEventActionById = (id: string) =>
  get(`/v1/event-actions/${id}`)

export const createEventAction = (data: Partial<EventAction>) =>
  post('/v1/event-actions', data)

export const updateEventAction = (id: string, data: Partial<EventAction>) =>
  patch(`/v1/event-actions/${id}`, data)

export const deleteEventAction = (id: string) =>
  del(`/v1/event-actions/${id}`)

export const updateEventActionStatus = (id: string, status: EventAction['currentStatus']) =>
  patch(`/v1/event-actions/${id}`, { currentStatus: status })

// Status update with a note and optional attached documents, same procedure
// as the my-tasks task page (multipart PATCH, backend stores them in history)
export const updateEventActionStatusWithDocument = (
  id: string,
  status: string,
  description: string,
  files?: File[] | null,
  changedBy?: { name?: string; email?: string },
) => {
  const fd = new FormData()
  fd.append('currentStatus[status]', status)
  fd.append('currentStatus[description]', description)
  if (changedBy?.name) fd.append('changedBy[name]', changedBy.name)
  if (changedBy?.email) fd.append('changedBy[email]', changedBy.email)
  ;(files || []).forEach((f) => fd.append('documents', f))
  return patch(`/v1/event-actions/${id}`, fd)
}
