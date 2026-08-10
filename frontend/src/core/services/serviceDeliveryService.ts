import { get, post, put } from './apiClient'

export interface Visitor {
  _id?: string
  full_name?: string
  telephone?: string
  email?: string
  identification?: { id_type?: string; number?: string }
  gender?: string
  badge_number?: string
  is_still_inhouse?: boolean
  entry_date?: string
  exist_date?: string
  departments_assigned?: Array<{
    department_id: string
    department_name: string
    assigned_time: string
  }>
}

export const serviceDeliveryService = {
  getAll: (page: number = 1, limit: number = 50, inHouse?: boolean, period?: string, from?: string, to?: string) => {
    const params = new URLSearchParams();
    params.append('page', String(page));
    params.append('limit', String(limit));
    if (inHouse !== undefined) params.append('in_house', String(inHouse));
    if (period) params.append('period', period);
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    return get(`/servicedelivery/visitor?${params.toString()}`)
  },
  getAssignedVisitors: (page: number = 1, limit: number = 20, q?: string, inHouse?: boolean, history?: boolean) => {
    let url = `/servicedelivery/assigned-visitors?page=${page}&limit=${limit}`
    if (q && q.trim()) url += `&q=${encodeURIComponent(q.trim())}`
    if (inHouse !== undefined) url += `&in_house=${inHouse}`
    if (history === true) url += `&history=true`
    return get(url)
  },
  getQueueSummary: (inHouse?: boolean) => {
    let url = `/servicedelivery/queue-summary`
    if (inHouse !== undefined) url += `?in_house=${inHouse}`
    return get(url)
  },
  search: (query: string, page: number = 1, limit: number = 50, inHouse: boolean = true) =>
    get(`/servicedelivery/visitor/search?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}&in_house=${inHouse}`),
  getById: (id: string) => get(`/servicedelivery/visitor/${id}`),
  checkIn: (data: any) => post('/servicedelivery/visitor/checkin', data),
  checkOut: (id: string) => post('/servicedelivery/visitor/checkout', { visitor_id: id }),
  toggleStatus: (visitorId: string, departmentId: string, status: string, providerId?: string) =>
    post('/servicedelivery/visitor/service/status', { visitor_id: visitorId, department_id: departmentId, status, provider_id: providerId }),
  getVisitorsByDepartment: (departmentId: string, page?: number, limit?: number, is_still_inhouse?: boolean) => {
    let url = `/servicedelivery/visitor/by-department?department_id=${encodeURIComponent(departmentId)}`
    if (page) url += `&page=${page}`
    if (limit) url += `&limit=${limit}`
    if (is_still_inhouse !== undefined) url += `&is_still_inhouse=${is_still_inhouse}`
    return get(url)
  },
  getCurrentVisitorsByProvider: (providerId: string, page?: number, limit?: number, inHouse?: boolean) => {
    const params = new URLSearchParams();
    if (page) params.append('page', page.toString());
    if (limit) params.append('limit', limit.toString());
    if (inHouse !== undefined) params.append('in_house', inHouse.toString());
    return get(`/servicedelivery/visitor/by-provider-current/${encodeURIComponent(providerId)}?${params.toString()}`)
  },
  getActiveTasks: (page: number = 1, limit: number = 10, search?: string) => {
    let url = `/servicedelivery/visitor/active-tasks?page=${page}&limit=${limit}`
    if (search && search.trim()) url += `&search=${encodeURIComponent(search.trim())}`
    return get(url)
  },
  update: (id: string, data: any) => put(`/servicedelivery/visitor/${id}`, data),
}