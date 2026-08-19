// Admin API Services - TypeScript definitions
// All admin-related API endpoints are defined here

import { get, post, put, del } from './apiClient';
import requestService from './requestService';

// ==================== PERMISSION TYPES ====================

export interface PermissionAction {
  action_type: string;
  description: string;
}

export interface ResourcePermission {
  resource: string;
  actions: string[];
}

export interface SystemResource {
  resource: string;
  actions: PermissionAction[];
}

// ==================== DEPARTMENT TYPES ====================

/** Raw department object as returned by the backend API */
export interface DepartmentRaw {
  _id?: string;
  department_id?: string;
  department_name?: string;
  department_leader?: string | { _id?: string; full_name?: string; email?: string; title?: string } | null;
  description?: string;
  room_number?: string;
  total_employees?: number;
  employees?: number | any[];
  services?: Array<{ _id?: string; service_name?: string; service_description?: string; name?: string; description?: string }>;
  status?: string;
  is_unit?: boolean;
  parent_department?: string | { _id?: string; name?: string; department_name?: string };
  createdAt?: string;
  updatedAt?: string;
  department_response_time_in_minutes?: number;
  is_active?: boolean;
  leader?: string | { _id?: string; full_name?: string; email?: string } | null;
  name?: string;
  sub_department_mng?: {
    is_sub_department?: boolean;
    parent_department_id?: string;
  };
  sub_departments?: DepartmentRaw[];
  created_date?: string;
  created_at?: string;
  updated_at?: string;
  registered_by?: string;
}

/** Normalized Department for frontend use */
export interface Department {
  _id: string;
  department_id: string;
  name: string;
  description: string;
  room_number: string;
  department_leader: string | { _id?: string; full_name?: string; email?: string; title?: string } | null;
  leader: string | { _id?: string; full_name?: string; email?: string; title?: string } | null;
  total_employees: number;
  services: Array<{ _id?: string; service_name?: string; service_description?: string; name?: string; description?: string }>;
  is_unit: boolean;
  is_active: boolean;
  parent_department: string | { _id?: string; name?: string; department_name?: string } | null;
  department_response_time_in_minutes: number;
  sub_departments: Department[];
  /** Preserved raw field for sub-department detection */
  sub_department_mng?: {
    is_sub_department?: boolean;
    parent_department_id?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

/** Normalize a raw department from the API */
export function normalizeDepartment(raw: DepartmentRaw): Department {
  return {
    _id: raw._id || '',
    department_id: raw.department_id || '',
    name: raw.department_name || raw.name || 'Unnamed Department',
    description: raw.description || '',
    room_number: raw.room_number || '',
    department_leader: raw.department_leader ?? raw.leader ?? null,
    leader: raw.department_leader ?? raw.leader ?? null,
    total_employees: typeof raw.total_employees === 'number' ? raw.total_employees : 0,
    services: raw.services || [],
    is_unit: raw.is_unit || false,
    is_active: raw.is_active !== false,
    parent_department: raw.parent_department || null,
    department_response_time_in_minutes: raw.department_response_time_in_minutes || 0,
    sub_departments: Array.isArray(raw.sub_departments) ? raw.sub_departments.map(normalizeDepartment) : [],
    // Preserve raw API fields for tree building
    sub_department_mng: raw.sub_department_mng || null,
    createdAt: raw.created_at || raw.createdAt || '',
    updatedAt: raw.updated_at || raw.updatedAt || '',
  };
}

/** Normalize any dept response data (array or single) */
export function normalizeDepartments(data: any): Department[] {
  if (Array.isArray(data)) return data.map(normalizeDepartment);
  if (data?.data && Array.isArray(data.data)) return data.data.map(normalizeDepartment);
  if (data?.departments && Array.isArray(data.departments)) return data.departments.map(normalizeDepartment);
  return [];
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
  addService: (departmentId: string, serviceData: { name: string; description?: string }) => 
    post(`/department/crud/${departmentId}/services`, serviceData),
  updateService: (departmentId: string, serviceId: string, serviceData: { name?: string; description?: string }) => 
    put(`/department/crud/${departmentId}/services/${serviceId}`, serviceData),
  deleteService: (departmentId: string, serviceId: string) => 
    del(`/department/crud/${departmentId}/services/${serviceId}`),
};

// ==================== EMPLOYEE APIs ====================

export interface EmployeeRole {
  role_name: string;
  permissions: ResourcePermission[];
}

export interface Employee {
  _id?: string;
  employee_id?: string;
  full_name?: string;
  telephone?: string;
  email: string;
  identification?: {
    id_type?: string;
    number?: string;
  };
  badge_number?: string;
  gender?: string;
  title?: string;
  department?: string | { _id?: string; department_id?: string; department_name?: string };
  department_name?: string;
  department_id?: string;
  status?: string;
  roles?: EmployeeRole;
  is_account_activated?: boolean;
  is_2FA_disabled?: boolean;
  createdAt?: string;
}

export const employeeService = {
  getAll: (page?: number, limit?: number) => {
    let url = '/employee/crud';
    const params = [];
    if (page) params.push(`page=${page}`);
    if (limit) params.push(`limit=${limit}`);
    if (params.length > 0) url += '?' + params.join('&');
    return get(url);
  },
  getByDepartment: (departmentId: string, activeOnly: boolean = true, page: number = 1, limit: number = 20) => {
    const params = `department_id=${encodeURIComponent(departmentId)}&page=${page}&limit=${limit}`;
    return activeOnly
      ? get(`/employee/crud/by-department?${params}&is_active=true`)
      : get(`/employee/crud/by-department?${params}`);
  },
  search: (query: string, page: number = 1, limit: number = 20) => get(`/employee/crud/search?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`),
  getById: (id: string) => get(`/employee/crud/${id}`),
  create: (data: Partial<Employee>) => post('/employee/crud', data),
  update: (id: string, data: Partial<Employee>) => put(`/employee/crud/${id}`, data),
  delete: (id: string) => del(`/employee/crud/${id}`),
  createMultiple: (formData: FormData) => {
    return post('/multiple/employees', formData, { 'Content-Type': 'multipart/form-data' });
  },
  downloadTemplate: async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || '/cok/api'}/multiple/employees/template`);
      if (!response.ok) throw new Error('Failed to download template');
      const blob = await response.blob();
      return { success: true, data: blob };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },
};

// ==================== FEEDBACK APIs ====================

export const feedbackService = {
  getAll: (page?: number, limit?: number) => {
    const pageNum = page || 1;
    const limitNum = limit || 50;
    return get(`/feedback/search?limit=${limitNum}&page=${pageNum}`);
  },
  search: (query: string) => get(`/feedback/search?limit=${encodeURIComponent(query)}`),
  searchByDepartment: (department: string, page?: number, limit?: number, from?: string, to?: string) => {
    let url = `/feedback/search-by-department?department_id=${encodeURIComponent(department)}`;
    if (page) url += `&page=${page}`;
    if (limit) url += `&limit=${limit}`;
    if (from) url += `&from=${from}`;
    if (to) url += `&to=${to}`;
    return get(url);
  },
  getById: (id: string) => get(`/feedback/${id}`),
  submit: (data: any) => post('/feedback/submit', data),
  delete: (id: string) => del(`/feedback/${id}`),
  listFeedbacks: (params?: { target?: string; period?: string; from?: string; to?: string; page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.target) query.append('target', params.target);
    if (params?.period) query.append('period', params.period);
    if (params?.from) query.append('from', params.from);
    if (params?.to) query.append('to', params.to);
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));
    const qs = query.toString();
    return get(`/feedback/list${qs ? `?${qs}` : ''}`);
  },
};

// ==================== SERVICE DELIVERY APIs ====================

export interface VisitorIdentification {
  id_type?: string;
  number?: string;
}
export interface VisitorVehicleDetails {
  plate_number?: string;
  entered_time?: string;
  duration?: string;
}
export interface VisitorVehicleStorage {
  has_vehicle?: boolean;
  vehicle_details?: VisitorVehicleDetails;
}
export interface ServiceStatus {
  department_id: string;
  department_name: string;
  provider_name?: string;
  provider_id?: string;
  s_type: string;
}
export interface DepartmentAssigned {
  department_id: string;
  department_name: string;
  assigned_time: string;
  provider_name?: string;
  provider_id?: string;
  reached_in?: boolean;
}
export interface Visitor {
  _id?: string;
  full_name?: string;
  telephone?: string;
  email?: string;
  identification?: VisitorIdentification;
  gender?: string;
  badge_number?: string;
  vehicle_storage?: VisitorVehicleStorage;
  items_entered_with?: string[];
  items_exited_with?: string[];
  departments_assigned?: DepartmentAssigned[];
  services_status?: ServiceStatus[];
  is_still_inhouse?: boolean;
  entry_date?: string;
  exist_date?: string;
  registered_by?: string;
  marked_as_out?: boolean;
  notes?: Array<{ writter_name?: string; message?: string; timestamp?: string }>;
  durations?: {
    entry_and_leave_duration?: string;
    services_durations?: Array<{ department_id: string; department_name: string; duration: string; started_at: string; ended_at: string; provider_name?: string; provider_id?: string }>;
    emergency_durations?: Array<{ type_of_emergency?: string; started_at?: string; ended_at?: string; duration?: string; provider_name?: string; provider_id?: string }>;
  };
  current_duration?: string;
}

export const serviceDeliveryService = {
  // inHouse: true = only visitors still inside, false = only checked-out,
  // 'all' = everyone (the backend defaults to in-house when the param is absent)
  getAll: (page: number = 1, limit: number = 50, inHouse?: boolean | 'all', period?: string, from?: string, to?: string) => {
    const params = new URLSearchParams();
    params.append('page', String(page));
    params.append('limit', String(limit));
    if (inHouse !== undefined) params.append('in_house', String(inHouse));
    if (period) params.append('period', period);
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    return get(`/servicedelivery/visitor?${params.toString()}`);
  },
  getAllVisitors: (page: number = 1, limit: number = 50, inHouse?: boolean) => {
    let url = `/servicedelivery/visitor?page=${page}&limit=${limit}`;
    if (inHouse !== undefined) url += `&in_house=${inHouse}`;
    return get(url);
  },
  getDashboardVisitors: (page: number = 1, limit: number = 20, q?: string, inHouse?: boolean, history?: boolean) => {
    let url = `/servicedelivery/dashboard/visitors?page=${page}&limit=${limit}`;
    if (q && q.trim()) url += `&q=${encodeURIComponent(q.trim())}`;
    if (inHouse !== undefined) url += `&in_house=${inHouse}`;
    if (history === true) url += `&history=true`;
    return get(url);
  },
  getAssignedVisitors: (page: number = 1, limit: number = 20, q?: string, inHouse?: boolean, history?: boolean) => {
    let url = `/servicedelivery/assigned-visitors?page=${page}&limit=${limit}`;
    if (q && q.trim()) url += `&q=${encodeURIComponent(q.trim())}`;
    if (inHouse !== undefined) url += `&in_house=${inHouse}`;
    if (history === true) url += `&history=true`;
    return get(url);
  },
  getQueueSummary: (inHouse?: boolean) => {
    let url = `/servicedelivery/queue-summary`;
    if (inHouse !== undefined) url += `?in_house=${inHouse}`;
    return get(url);
  },
  getAssignedVisitorsGenderStats: (params?: { period?: string; from?: string; to?: string }) => {
    const query = new URLSearchParams();
    if (params?.period) query.append('period', params.period);
    if (params?.from) query.append('from', params.from);
    if (params?.to) query.append('to', params.to);
    const qs = query.toString();
    return get(`/servicedelivery/assigned-visitors/gender-stats${qs ? `?${qs}` : ''}`);
  },
  getServedVisitorsGenderStats: (params?: { period?: string; from?: string; to?: string }) => {
    const query = new URLSearchParams();
    if (params?.period) query.append('period', params.period);
    if (params?.from) query.append('from', params.from);
    if (params?.to) query.append('to', params.to);
    const qs = query.toString();
    return get(`/servicedelivery/served-visitors/gender-stats${qs ? `?${qs}` : ''}`);
  },
  exportVisitors: (params?: { period?: string; from?: string; to?: string; vehicle?: string; title?: string; fields?: string[] }) => {
    const query = new URLSearchParams();
    if (params?.period && params.period !== 'all') query.append('period', params.period);
    if (params?.from) query.append('from', params.from);
    if (params?.to) query.append('to', params.to);
    if (params?.vehicle && params.vehicle !== 'all') query.append('vehicle', params.vehicle);
    if (params?.title) query.append('title', params.title);
    if (params?.fields && params.fields.length > 0) query.append('fields', params.fields.join(','));
    const qs = query.toString();
    return `/cok/api/servicedelivery/visitors/export${qs ? `?${qs}` : ''}`;
  },
  getServiceTrackingVisitors: (page: number = 1, limit: number = 20) => get(`/servicedelivery/service-tracking/visitors?page=${page}&limit=${limit}`),
  search: (query: string, page: number = 1, limit: number = 50, inHouse: boolean = true) => get(`/servicedelivery/visitor/search?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}&in_house=${inHouse}`),
  searchVisitors: (query: string, page: number = 1, limit: number = 50, inHouse: boolean = true) => get(`/servicedelivery/visitor/search?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}&in_house=${inHouse}`),
  getById: (id: string) => get(`/servicedelivery/visitor/${id}`),
  getVisitorById: (id: string) => get(`/servicedelivery/visitor/${id}`),
  getVisitorByIdentification: (id_type: string, id_number: string) =>
    get(`/servicedelivery/visitor/by/identification/gate?id_type=${encodeURIComponent(id_type)}&id_number=${encodeURIComponent(id_number)}`),
  checkIn: (data: any) => post('/servicedelivery/visitor/checkin', data),
  checkOut: (id: string) => post(`/servicedelivery/visitor/checkout`, { visitor_id: id }),
  toggleStatus: (visitorId: string, departmentId: string, status: string, providerId?: string, providerName?: string) => post(`/servicedelivery/visitor/service/status`, { visitor_id: visitorId, department_id: departmentId, status, provider_id: providerId, provider_name: providerName }),
  toggleServiceStatus: (visitorId: string, departmentId: string, status: string, providerId?: string, providerName?: string) => post(`/servicedelivery/visitor/service/status`, { visitor_id: visitorId, department_id: departmentId, status, provider_id: providerId, provider_name: providerName }),
  transferToDepartment: (visitorId: string, newDepartmentId: string, newDepartmentName: string, previousDepartmentId?: string, providerId?: string, providerName?: string) => post(`/servicedelivery/visitor/assign`, { visitor_id: visitorId, new_department_id: newDepartmentId, new_department_name: newDepartmentName, previous_department_id: previousDepartmentId, provider_id: providerId, provider_name: providerName || 'Not specified' }),
  assignToDepartment: (visitorId: string, departmentId: string, departmentName: string, providerId?: string, providerName?: string, previousDepartmentId?: string) => post(`/servicedelivery/visitor/assign`, { visitor_id: visitorId, new_department_id: departmentId, new_department_name: departmentName, provider_id: providerId ?? null, provider_name: providerName ?? null, previous_department_id: previousDepartmentId ?? null }),
  getVisitorsByDepartment: (departmentId: string, page?: number, limit?: number, is_still_inhouse?: boolean) => {
    let url = `/servicedelivery/visitor/by-department?department_id=${encodeURIComponent(departmentId)}`;
    if (page) url += `&page=${page}`;
    if (limit) url += `&limit=${limit}`;
    if (is_still_inhouse !== undefined) url += `&is_still_inhouse=${is_still_inhouse}`;
    return get(url);
  },
  getCurrentVisitorsByDepartment: (departmentId: string) => get(`/servicedelivery/visitor/by-department-current/${encodeURIComponent(departmentId)}`),
  getCurrentVisitorsByProvider: (providerId: string, page?: number, limit?: number, inHouse?: boolean) => {
    const params = new URLSearchParams();
    if (page) params.append('page', page.toString());
    if (limit) params.append('limit', limit.toString());
    if (inHouse !== undefined) params.append('in_house', inHouse.toString());
    return get(`/servicedelivery/visitor/by-provider-current/${encodeURIComponent(providerId)}?${params.toString()}`);
  },
  getVisitorsByProvider: (providerId: string, page?: number, limit?: number) => {
    let url = `/servicedelivery/visitor/by-provider?provider_id=${encodeURIComponent(providerId)}`;
    if (page) url += `&page=${page}`;
    if (limit) url += `&limit=${limit}`;
    return get(url);
  },
  emergencyLeaveReturn: (id: string, data: any) => post(`/servicedelivery/visitor/emergency/leave-return`, { visitor_id: id, ...data }),
  partialExit: (visitorId: string) => post('/servicedelivery/visitor/partial-exit', { visitor_id: visitorId }),
  returnWithBadge: (visitorId: string, badge_number?: string) =>
    post('/servicedelivery/visitor/return-with-badge', { visitor_id: visitorId, badge_number: badge_number || null }),
  update: (id: string, data: any) => put(`/servicedelivery/visitor/${id}`, data),
  updateServiceStatus: (data: any) => post(`/servicedelivery/visitor/service/status`, data),
  getActiveTasks: (page: number = 1, limit: number = 10, search?: string) => {
    let url = `/servicedelivery/visitor/active-tasks?page=${page}&limit=${limit}`;
    if (search && search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;
    return get(url);
  },
};

// ==================== DEPARTMENT MANAGER APIs ====================

export const departmentManagerService = {
  getVisitorsByStatus: (status: string, page: number = 1, limit: number = 20, dateFilter?: string) => {
    let url = `/department-manager/visitors/status/${status}?page=${page}&limit=${limit}`;
    if (dateFilter) url += `&dateFilter=${encodeURIComponent(dateFilter)}`;
    return get(url);
  },
  getVisitorsByProvider: (providerId: string, page: number = 1, limit: number = 20, dateFilter?: string) => {
    let url = `/department-manager/visitors/provider/${providerId}?page=${page}&limit=${limit}`;
    if (dateFilter) url += `&dateFilter=${encodeURIComponent(dateFilter)}`;
    return get(url);
  },
  getVisitorsByDepartment: (departmentId: string, page: number = 1, limit: number = 20, dateFilter?: string, status?: string) => {
    let url = `/department-manager/visitors/department/${departmentId}?page=${page}&limit=${limit}`;
    if (dateFilter) url += `&dateFilter=${encodeURIComponent(dateFilter)}`;
    if (status) url += `&status=${encodeURIComponent(status)}`;
    return get(url);
  },
  getManagedDepartments: () => get('/department-manager/departments'),
  updateDepartment: (departmentId: string, data: { department_name?: string; department_response_time_in_minutes?: number }) => put(`/department-manager/departments/${departmentId}`, data),
  getResponseTimeAnalytics: () => get('/department-manager/analytics/response-time'),
  getDepartmentFeedback: (page: number = 1, limit: number = 20, dateFilter?: string, rating?: number) => {
    let url = `/department-manager/feedback?page=${page}&limit=${limit}`;
    if (dateFilter) url += `&dateFilter=${encodeURIComponent(dateFilter)}`;
    if (rating) url += `&rating=${rating}`;
    return get(url);
  },

  // ---- Head of Department features ----
  getTeamMembers: (page: number = 1, limit: number = 20, search?: string, isActive?: boolean) => {
    let url = `/department-manager/team?page=${page}&limit=${limit}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (isActive !== undefined) url += `&is_active=${isActive}`;
    return get(url);
  },
  getTeamTasks: (page: number = 1, limit: number = 20, status?: string, memberId?: string) => {
    let url = `/department-manager/team-tasks?page=${page}&limit=${limit}`;
    if (status) url += `&status=${encodeURIComponent(status)}`;
    if (memberId) url += `&memberId=${encodeURIComponent(memberId)}`;
    return get(url);
  },
  createTeamTask: (data: { title: string; description?: string; incharge: string; priority?: string; dueDate?: string; startDate?: string }) =>
    post('/department-manager/team-tasks', data),
  getAnnouncements: (page: number = 1, limit: number = 20, aType?: string) => {
    let url = `/department-manager/announcements?page=${page}&limit=${limit}`;
    if (aType) url += `&a_type=${encodeURIComponent(aType)}`;
    return get(url);
  },
  createAnnouncement: (data: { title: string; message: string; a_type?: string; department_id?: string }) =>
    post('/department-manager/announcements', data),
  deleteAnnouncement: (id: string) => del(`/department-manager/announcements/${id}`),
  getAuditLogs: (page: number = 1, limit: number = 20, filters?: { action?: string; resource?: string; start_date?: string; end_date?: string }) => {
    let url = `/department-manager/audit/logs?page=${page}&limit=${limit}`;
    if (filters?.action) url += `&action=${encodeURIComponent(filters.action)}`;
    if (filters?.resource) url += `&resource=${encodeURIComponent(filters.resource)}`;
    if (filters?.start_date) url += `&start_date=${encodeURIComponent(filters.start_date)}`;
    if (filters?.end_date) url += `&end_date=${encodeURIComponent(filters.end_date)}`;
    return get(url);
  },
  getAuditStats: (days: number = 30) => get(`/department-manager/audit/stats?days=${days}`),
  getDepartmentKpis: (from?: string, to?: string) => {
    const params: string[] = [];
    if (from) params.push(`from=${encodeURIComponent(from)}`);
    if (to) params.push(`to=${encodeURIComponent(to)}`);
    return get(`/department-manager/analytics/kpis${params.length ? `?${params.join('&')}` : ''}`);
  },
};

// ==================== SMART PARKING APIs ====================

export const parkingService = {
  getAll: async () => {
    try {
      const response = await get(`/smartparking/vehicle?status=active&limit=50&page=1`);
      if (response.success) return { success: true, data: response.data || [], total: response.total || 0 };
      return { success: false, data: [], total: 0 };
    } catch (error) {
      return { success: false, data: [], total: 0 };
    }
  },
  getAllPaginated: (page: number = 1, limit: number = 50, status: string = 'active') => get(`/smartparking/vehicle?status=${status}&page=${page}&limit=${limit}`),
  update: (id: string, data: any) => put(`/smartparking/vehicle/${id}`, data),
  getAllVehicles: async () => {
    try {
      const response = await get(`/smartparking/vehicle?status=active&limit=50&page=1`);
      if (response.success) return { success: true, data: response.data || [] };
      return { success: false, data: [] };
    } catch (error) {
      return { success: false, data: [] };
    }
  },
  getStats: async () => {
    try {
      const currentlyParkedResponse = await get('/statistics/currently-parked');
      if (currentlyParkedResponse.success && currentlyParkedResponse.data) {
        const { total, by_driver_type } = currentlyParkedResponse.data;
        const totalSlots = 200;
        const occupiedSlots = total || 0;
        const availableSlots = totalSlots - occupiedSlots;
        return { success: true, data: { availableSlots: Math.max(0, availableSlots), totalSlots, staffVehicles: (by_driver_type?.Staff || 0) + (by_driver_type?.Regular || 0), visitorVehicles: by_driver_type?.Visitor || 0, reservedSlots: 0, newVisitors: 0, totalParked: total || 0 } };
      }
      return currentlyParkedResponse;
    } catch (error) {
      return { success: false, data: {} };
    }
  },
  getLongDurationVehicles: async (date: string | null = null) => {
    try {
      let queryParams = 'status=active&limit=100';
      if (date) queryParams += `&date=${date}`;
      const response = await get(`/smartparking/vehicle?${queryParams}`);
      if (response.success && response.data) {
        const records = response.data;
        const now = new Date();
        const longDuration = records.filter((r: any) => {
          const entryTime = new Date(r.check_in || r.entry_date || r.createdAt);
          let hoursDiff: number;
          if (r.status === 'completed' && r.check_out) {
            const checkOutTime = new Date(r.check_out);
            hoursDiff = (checkOutTime.getTime() - entryTime.getTime()) / (1000 * 60 * 60);
          } else { hoursDiff = (now.getTime() - entryTime.getTime()) / (1000 * 60 * 60); }
          return hoursDiff > 8;
        }).map((r: any) => {
          const entryTime = new Date(r.check_in || r.entry_date || r.createdAt);
          let hoursDiff: number;
          if (r.status === 'completed' && r.check_out) {
            const checkOutTime = new Date(r.check_out);
            hoursDiff = (checkOutTime.getTime() - entryTime.getTime()) / (1000 * 60 * 60);
          } else { hoursDiff = (now.getTime() - entryTime.getTime()) / (1000 * 60 * 60); }
          const hours = Math.floor(hoursDiff);
          const minutes = Math.floor((hoursDiff - hours) * 60);
          return { plate_no: r.plate_number || r.plate_no || 'N/A', entry_time: r.check_in || r.entry_date || r.createdAt, check_out: r.check_out || null, duration: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`, duration_hours: hoursDiff, driver_name: r.driver_name || 'Unknown', driver_type: r.driver_type || 'Unknown', is_flagged: r.is_flagged || false, status: r.status || 'active', _id: r._id };
        }).sort((a: any, b: any) => b.duration_hours - a.duration_hours);
        return { success: true, data: longDuration };
      }
      return response;
    } catch (error) {
      return { success: false, data: [] };
    }
  },
  getFlaggedActiveVehicles: async (page: number = 1, limit: number = 50) => {
    try {
      const response = await get(`/smartparking/vehicle/flagged?limit=${limit}&page=${page}`);
      if (response.success && response.data) {
        const records = response.data;
        const now = new Date();
        const flaggedActive = records.map((r: any) => {
          const entryTime = new Date(r.check_in || r.entry_date || r.createdAt);
          const hoursDiff = (now.getTime() - entryTime.getTime()) / (1000 * 60 * 60);
          const hours = Math.floor(hoursDiff);
          const minutes = Math.floor((hoursDiff - hours) * 60);
          return { plate_no: r.plate_number || r.plate_no || 'N/A', entry_time: r.check_in || r.entry_date || r.createdAt, duration: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`, driver_name: r.driver_name || 'Unknown', driver_type: r.driver_type || 'Unknown', is_flagged: true, status: r.status || 'active', _id: r._id };
        });
        return { success: true, data: flaggedActive, total: response.total || 0 };
      }
      return response;
    } catch (error) {
      return { success: false, data: [], total: 0 };
    }
  },
  search: (query: string, page: number = 1, limit: number = 50) => get(`/smartparking/vehicle/search?query=${encodeURIComponent(query)}&status=active&page=${page}&limit=${limit}`),
  getById: (id: string) => get(`/smartparking/vehicle/${id}`),
  getVehicleById: (id: string) => get(`/smartparking/vehicle/${id}`),
  checkIn: (data: any) => post('/smartparking/vehicle/checkin', data),
  checkOut: (id: string) => post(`/smartparking/vehicle/checkout`, { id }),
  checkOutByPlate: (plateNumber: string) => post(`/smartparking/vehicle/checkout`, { plate_number: plateNumber }),
  verifyVehicle: (plateNumber: string) => post('/smartparking/vehicle/verify', { plate_number: plateNumber }),
  verifyCar: (plateNumber: string) => post('/smartparking/vehicle/verify', { plate_number: plateNumber }),
  getFlagged: () => get('/smartparking/vehicle/flagged'),
  getFlaggedVehicles: () => get('/smartparking/vehicle/flagged'),
  registerSingle: (data: any) => post('/smartparking/register-single', data),
  bulkUpload: (formData: FormData) => post('/smartparking/bulk-upload', formData),
  flagVehicle: (plateNumber: string, reason: string) => post('/smartparking/vehicle/flag', { plate_number: plateNumber, reason }),
  updateSlotConfig: (config: { totalSlots: number; staffReservedSlots: number; visitorReservedSlots: number }) => put('/smartparking/slots', config),
};

export const smartParkingService = parkingService;

// ==================== RESERVATION APIs ====================

export interface Reservation {
  id: string;
  reservation_id: string;
  visitor_name: string;
  plate_number: string;
  telephone: string;
  expected_arrival: string;
  type: 'visitor' | 'staff';
  status: 'active' | 'expired' | 'cancelled';
  created_at: string;
}

export const reservationService = {
  getAll: (): Promise<{ success: boolean; reservations?: Reservation[]; total?: number }> => get('/smartparking/reservations'),
  createVisitorReservation: (data: any) => post('/smartparking/register-single', data),
  bulkUploadVisitors: (formData: FormData) => post('/smartparking/bulk-upload', formData),
  createStaffBooking: (data: any) => post('/smartparking/staff-booking', data),
  bulkUploadStaff: (formData: FormData) => post('/smartparking/bulk-staff-upload', formData),
  cancelReservation: (id: string, type?: 'visitor' | 'staff') => put(`/smartparking/reservations/${id}/cancel`, { type }),
  reactivateReservation: (id: string) => put(`/smartparking/reservations/${id}/reactivate`, {}),
  bulkCancelReservations: (items: Array<{ id: string; type: 'visitor' | 'staff' }>) => post('/smartparking/reservations/bulk-cancel', { items }),
  bulkDeleteReservations: (items: Array<{ id: string; type: 'visitor' | 'staff' }>) => post('/smartparking/reservations/bulk-delete', { items }),
  getBatches: () => get('/smartparking/reservation-batches'),
  cancelBatch: (id: string, type: 'visitor' | 'staff') => put('/smartparking/reservation-batches/cancel', { id, type }),
  rescheduleBatch: (id: string, type: 'visitor' | 'staff', start_date: string, end_date: string) => put('/smartparking/reservation-batches/reschedule', { id, type, start_date, end_date }),
  deleteBatch: (id: string, type: 'visitor' | 'staff') => post('/smartparking/reservation-batches/delete', { id, type }),
};

export const serviceDeliveryServiceWithVisitors = { ...serviceDeliveryService, getAllVisitors: serviceDeliveryService.getAll };

// ==================== PERMISSION APIs ====================

export interface SystemPermission {
  resource: string;
  actions: Array<{ action_type: string; description: string }>;
}

export const permissionService = {
  getSystemPermissions: () => get('/permissions'),
};

// ==================== STATISTICS APIs ====================

export const statisticsService = {
  getServiceDeliveryStats: () => get('/statistics/service-delivery'),
  getHourlyServiceDeliveryStats: () => get('/statistics/hourly-service-delivery'),
  getHourlyParkingStats: () => get('/statistics/hourly-parking'),
  getActivityTimeline: (params?: { period?: string; from?: string; to?: string }) => {
    const query = new URLSearchParams();
    if (params?.period) query.append('period', params.period);
    if (params?.from) query.append('from', params.from);
    if (params?.to) query.append('to', params.to);
    const qs = query.toString();
    return get(`/statistics/activity-timeline${qs ? `?${qs}` : ''}`);
  },
  getOccupancyTimeline: (params?: { period?: string; from?: string; to?: string }) => {
    const query = new URLSearchParams();
    if (params?.period) query.append('period', params.period);
    if (params?.from) query.append('from', params.from);
    if (params?.to) query.append('to', params.to);
    const qs = query.toString();
    return get(`/statistics/occupancy-timeline${qs ? `?${qs}` : ''}`);
  },
  getDepartmentsWithLeaders: () => get('/statistics/departments-leaders'),
  getEmployeeStats: () => get('/statistics/employees'),
  getVisitorsTimeline: (from: string, to: string, granularity: 'hour' | 'day' | 'week' | 'month') =>
    get(`/statistics/visitors-timeline?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&granularity=${granularity}`),
  getFeedbackTotals: (params?: { period?: string; from?: string; to?: string }) => {
    const query = new URLSearchParams();
    if (params?.period) query.append('period', params.period);
    if (params?.from) query.append('from', params.from);
    if (params?.to) query.append('to', params.to);
    const qs = query.toString();
    return get(`/statistics/feedback-totals${qs ? `?${qs}` : ''}`);
  },
  getFeedbackAverageByDepartment: (params?: { period?: string; from?: string; to?: string }) => {
    const query = new URLSearchParams();
    if (params?.period) query.append('period', params.period);
    if (params?.from) query.append('from', params.from);
    if (params?.to) query.append('to', params.to);
    const qs = query.toString();
    return get(`/statistics/feedback-average${qs ? `?${qs}` : ''}`);
  },
  getCurrentlyParkedStats: () => get('/statistics/currently-parked'),
  getFlaggedVehiclesStats: () => get('/statistics/flagged-vehicles'),
  getEmergencyCarsStats: () => get('/statistics/emergency-cars'),
  getParkingSlots: () => get('/smartparking/slots'),
  getServedStats: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    const qs = params.toString();
    return get(`/statistics/served${qs ? `?${qs}` : ''}`);
  },
  getFeedbackSentiment: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    const qs = params.toString();
    return get(`/statistics/feedback-sentiment${qs ? `?${qs}` : ''}`);
  },
};

export { requestService };
export default { departmentService, employeeService, feedbackService, serviceDeliveryService, parkingService, statisticsService, requestService };

// ==================== USER ACCOUNT LOCK/UNLOCK APIs ====================

export interface UserAccount {
  _id?: string;
  full_name?: string;
  email?: string;
  telephone?: string;
  department?: string | { _id?: string; department_id?: string; department_name?: string };
  department_name?: string;
  is_active?: boolean;
  is_account_activated?: boolean;
  is_2FA_disabled?: boolean;
  created_date?: string;
  access_control?: { is_locked?: boolean; reason?: string; last_login_attempt?: number };
}

export interface LockUnlockResponse {
  success: boolean;
  type: string;
  message: string;
  data?: { userId: string; email: string; fullName: string; isLocked: boolean; reason?: string };
}

export interface LockStatusResponse {
  success: boolean;
  type: string;
  message: string;
  data?: { userId: string; email: string; fullName: string; isLocked: boolean; reason?: string; lastLoginAttempt?: number };
}

export const userAccountService = {
  getAllUsers: () => get('/employee/crud'),
  searchUsers: (query: string) => get(`/employee/crud/search?query=${encodeURIComponent(query)}`),
  getUserById: (id: string) => get(`/employee/crud/${id}`),
  lockUnlock: (userId: string, action: 'lock' | 'unlock', reason?: string) => post('/auth/lock-unlock', { userId, action, reason }),
  checkLockStatus: (userId: string) => post('/auth/lock-unlock/status', { userId }),
  resetLoginAttempts: (userId: string) => post('/auth/lock-unlock/reset-attempts', { userId }),
};

// ==================== ROLE APIs ====================

export interface Role {
  _id?: string;
  role_name: string;
  permissions?: Array<{ resource_name: string; actions: Array<{ action: string; description?: string; is_enabled?: boolean }> }>;
}

export interface CreateRoleInput {
  role_name: string;
  permissions?: Array<{ resource_name: string; actions: string[] }>;
}

export const roleService = {
  getAll: () => get('/roles'),
  getById: (id: string) => get(`/roles/${id}`),
  getByName: (name: string) => get(`/roles/name/${name}`),
  create: (data: CreateRoleInput) => post('/roles', data),
  update: (id: string, data: { role_name?: string; permissions?: Array<{ resource_name: string; actions: string[] }> }) => put(`/roles/${id}`, data),
  delete: (id: string) => del(`/roles/${id}`),
  getAvailableResources: () => get('/roles/resources/available'),
  togglePermission: (id: string, resource_name: string, action: string, enabled?: boolean) => put(`/roles/${id}/permissions/toggle`, { resource_name, action, enabled }),
  bulkUpdatePermissions: (id: string, permissions: Array<{ resource_name: string; actions: string[] }>) => put(`/roles/${id}/permissions/bulk`, { permissions }),
};