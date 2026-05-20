import { get, post, put, del } from './apiClient'

export interface EmployeeRole {
  role_name: string
  permissions: Array<{ resource: string; actions: string[] }>
}

export interface Employee {
  _id?: string
  employee_id?: string
  full_name?: string
  telephone?: string
  email: string
  identification?: { id_type?: string; number?: string }
  badge_number?: string
  gender?: string
  title?: string
  department?: string | { _id?: string; department_id?: string; department_name?: string }
  department_name?: string
  department_id?: string
  status?: string
  roles?: EmployeeRole
  createdAt?: string
}

export const employeeService = {
  getAll: (page?: number, limit?: number) => {
    let url = '/employee/crud'
    const params = []
    if (page) params.push(`page=${page}`)
    if (limit) params.push(`limit=${limit}`)
    if (params.length > 0) url += '?' + params.join('&')
    return get(url)
  },
  getByDepartment: (departmentId: string, activeOnly: boolean = true, page: number = 1, limit: number = 20) => {
    const params = `department_id=${encodeURIComponent(departmentId)}&page=${page}&limit=${limit}`
    return activeOnly
      ? get(`/employee/crud/by-department?${params}&is_active=true`)
      : get(`/employee/crud/by-department?${params}`)
  },
  search: (query: string, page: number = 1, limit: number = 20) =>
    get(`/employee/crud/search?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`),
  getById: (id: string) => get(`/employee/crud/${id}`),
  create: (data: Partial<Employee>) => post('/employee/crud', data),
  update: (id: string, data: Partial<Employee>) => put(`/employee/crud/${id}`, data),
  delete: (id: string) => del(`/employee/crud/${id}`),
  createMultiple: (formData: FormData) =>
    post('/multiple/employees', formData, { 'Content-Type': 'multipart/form-data' }),
  downloadTemplate: async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || '/cok/api'}/multiple/employees/template`)
      if (!response.ok) throw new Error('Failed to download template')
      return { success: true, data: await response.blob() }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  },
}