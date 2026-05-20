import { get, post, put, del } from './apiClient'

export interface Department {
  _id?: string
  department_id?: string
  department_name?: string
  department_leader?: string
  description?: string
  employees?: number
  status?: string
  createdAt?: string
  updatedAt?: string
  department_response_time_in_minutes?: number
}

export const departmentService = {
  getAll: () => get('/department/crud'),
  search: (query: string) => get(`/department/crud/search?query=${encodeURIComponent(query)}`),
  getById: (id: string) => get(`/department/crud/${id}`),
  getSubDepartments: (departmentId: string) => get(`/department/crud/${departmentId}/sub-departments`),
  getLeader: (email: string) => get(`/department/crud/leader/${encodeURIComponent(email)}`),
  create: (data: Partial<Department>) => post('/department/crud', data),
  update: (id: string, data: Partial<Department>) => put(`/department/crud/${id}`, data),
  delete: (id: string) => del(`/department/crud/${id}`),
}