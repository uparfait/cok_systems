
// Admin API Services - TypeScript definitions
// All admin-related API endpoints are defined here

import { get, post, put, del } from './apiClient';

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

// ==================== DEPARTMENT APIs ====================

export interface Department {
  _id?: string;
  department_id?: string;
  department_name?: string;
  department_leader?: string;
  description?: string;
  employees?: number;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  department_response_time_in_minutes?: number;
}

export const departmentService = {
  // Get all departments
  getAll: () => get('/department/crud'),
  
  // Search departments
  search: (query: string) => get(`/department/crud/search?query=${encodeURIComponent(query)}`),
  
  // Get department by ID
  getById: (id: string) => get(`/department/crud/${id}`),
  
  // Get department leader by email
  getLeader: (email: string) => get(`/department/crud/leader/${encodeURIComponent(email)}`),
  
  // Create new department
  create: (data: Partial<Department>) => post('/department/crud', data),
  
  // Update department
  update: (id: string, data: Partial<Department>) => put(`/department/crud/${id}`, data),
  
  // Delete department
  delete: (id: string) => del(`/department/crud/${id}`),
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
  badge_number?: string; // Employee badge/ID number
  gender?: string;
  title?: string;
  department?: string | {
    _id?: string;
    department_id?: string;
    department_name?: string;
  };
  department_name?: string;
  department_id?: string;
  status?: string;
  roles?: EmployeeRole;
  createdAt?: string;
}

export const employeeService = {
  // Get all employees
  getAll: () => get('/employee/crud'),
  
  // Get employees by department (filters by is_active=true by default for only active employees)
  getByDepartment: (departmentId: string, activeOnly: boolean = true) => {
    const params = `department_id=${encodeURIComponent(departmentId)}`;
    return activeOnly 
      ? get(`/employee/crud/by-department?${params}&is_active=true`)
      : get(`/employee/crud/by-department?${params}`);
  },
  
  // Search employees
  search: (query: string) => get(`/employee/crud/search?query=${encodeURIComponent(query)}`),
  
  // Get employee by ID
  getById: (id: string) => get(`/employee/crud/${id}`),
  
  // Create new employee
  create: (data: Partial<Employee>) => post('/employee/crud', data),
  
  // Update employee
  update: (id: string, data: Partial<Employee>) => put(`/employee/crud/${id}`, data),
  
  // Delete employee
  delete: (id: string) => del(`/employee/crud/${id}`),
  
  // Create multiple employees from file upload
  createMultiple: (formData: FormData) => {
    return post('/multiple/employees', formData, {
      'Content-Type': 'multipart/form-data'
    });
  },
};

// ==================== FEEDBACK APIs ====================

export const feedbackService = {
  // Get all feedback
  getAll: () => get('/feedback/search?limit=50&page=1'),
  
  // Search feedback
  search: (query: string) => get(`/feedback/search?limit=${encodeURIComponent(query)}`),
  
  // Get feedback by ID
  getById: (id: string) => get(`/feedback/${id}`),
  
  // Submit feedback
  submit: (data: any) => post('/feedback/submit', data),
  
  // Delete feedback
  delete: (id: string) => del(`/feedback/${id}`),
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
  s_type: string; // 'Not started', 'Inprogress', 'Completed', 'Transfered'
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
  notes?: Array<{
    writter_name?: string;
    message?: string;
    timestamp?: string;
  }>;
  durations?: {
    entry_and_leave_duration?: string;
    services_durations?: Array<{
      department_id: string;
      department_name: string;
      duration: string;
      started_at: string;
      ended_at: string;
      provider_name?: string;
      provider_id?: string;
    }>;
    emergency_durations?: Array<{
      type_of_emergency?: string;
      started_at?: string;
      ended_at?: string;
      duration?: string;
      provider_name?: string;
      provider_id?: string;
    }>;
  };
  current_duration?: string;
}

export const serviceDeliveryService = {
  // Get all visitors with pagination and filter
  getAll: (page: number = 1, limit: number = 50, inHouse?: boolean) => {
    let url = `/servicedelivery/visitor?page=${page}&limit=${limit}`;
    if (inHouse !== undefined) {
      url += `&in_house=${inHouse}`;
    }
    return get(url);
  },
  
  // Get all visitors (alias)
  getAllVisitors: (page: number = 1, limit: number = 50, inHouse?: boolean) => {
    let url = `/servicedelivery/visitor?page=${page}&limit=${limit}`;
    if (inHouse !== undefined) {
      url += `&in_house=${inHouse}`;
    }
    return get(url);
  },
  
  // Search visitors with pagination
  search: (query: string, page: number = 1, limit: number = 50, inHouse: boolean = true) => get(`/servicedelivery/visitor/search?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}&in_house=${inHouse}`),
  
  // Search visitors (alias)
  searchVisitors: (query: string, page: number = 1, limit: number = 50, inHouse: boolean = true) => get(`/servicedelivery/visitor/search?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}&in_house=${inHouse}`),
  
  // Get visitor by ID
  getById: (id: string) => get(`/servicedelivery/visitor/${id}`),
  
  // Get visitor by ID (alias)
  getVisitorById: (id: string) => get(`/servicedelivery/visitor/${id}`),
  
  // Check in visitor
  checkIn: (data: any) => post('/servicedelivery/visitor/checkin', data),
  
  // Check out visitor
  checkOut: (id: string) => post(`/servicedelivery/visitor/checkout`, { visitor_id: id }),
  
  // Toggle service status
  toggleStatus: (visitorId: string, departmentId: string, status: string, providerId?: string, providerName?: string) => post(`/servicedelivery/visitor/service/status`, { visitor_id: visitorId, department_id: departmentId, status, provider_id: providerId, provider_name: providerName }),
  
  // Toggle service status (alias)
  toggleServiceStatus: (visitorId: string, departmentId: string, status: string, providerId?: string, providerName?: string) => post(`/servicedelivery/visitor/service/status`, { visitor_id: visitorId, department_id: departmentId, status, provider_id: providerId, provider_name: providerName }),
  
  // Transfer visitor to a different department
  // This closes the previous department service and assigns to new department
  transferToDepartment: (
    visitorId: string, 
    newDepartmentId: string, 
    newDepartmentName: string, 
    previousDepartmentId?: string,
    providerId?: string,
    providerName?: string
  ) => post(`/servicedelivery/visitor/assign`, { 
    visitor_id: visitorId, 
    new_department_id: newDepartmentId,
    new_department_name: newDepartmentName,
    previous_department_id: previousDepartmentId,
    provider_id: providerId,
    provider_name: providerName || 'Not specified'
  }),
  
  // Assign to department (alias for transfer)
  assignToDepartment: (visitorId: string, departmentId: string, departmentName: string, providerId?: string, providerName?: string, previousDepartmentId?: string) => 
    post(`/servicedelivery/visitor/assign`, { 
      visitor_id: visitorId, 
      new_department_id: departmentId,
      new_department_name: departmentName,
      provider_id: providerId,
      provider_name: providerName,
      previous_department_id: previousDepartmentId
    }),
  
  // Get visitors by department (with pagination)
  getVisitorsByDepartment: (departmentId: string, page?: number, limit?: number, is_still_inhouse?: boolean) => {
    let url = `/servicedelivery/visitor/by-department?department_id=${encodeURIComponent(departmentId)}`;
    if (page) url += `&page=${page}`;
    if (limit) url += `&limit=${limit}`;
    if (is_still_inhouse !== undefined) url += `&is_still_inhouse=${is_still_inhouse}`;
    return get(url);
  },
  
  // Get current visitors count by department
  getCurrentVisitorsByDepartment: (departmentId: string) => get(`/servicedelivery/visitor/by-department-current/${encodeURIComponent(departmentId)}`),
  
  // Get current visitors count by provider (employee)
  getCurrentVisitorsByProvider: (providerId: string, page?: number, limit?: number) => {
    const params = new URLSearchParams();
    if (page) params.append('page', page.toString());
    if (limit) params.append('limit', limit.toString());
    return get(`/servicedelivery/visitor/by-provider-current/${encodeURIComponent(providerId)}?${params.toString()}`);
  },

  // Get visitors by provider (employee) - returns actual visitor records
  getVisitorsByProvider: (providerId: string, page?: number, limit?: number) => {
    let url = `/servicedelivery/visitor/by-provider?provider_id=${encodeURIComponent(providerId)}`;
    if (page) url += `&page=${page}`;
    if (limit) url += `&limit=${limit}`;
    return get(url);
  },
  
  // Emergency leave return
  emergencyLeaveReturn: (id: string, data: any) => post(`/servicedelivery/visitor/emergency/leave-return`, { visitor_id: id, ...data }),
  // 👉 ADD THIS NEW UPDATE FUNCTION:
  update: (id: string, data: any) => put(`/servicedelivery/visitor/${id}`, data),
  // Update service status - uses dedicated endpoint for service status and durations
  updateServiceStatus: (data: any) => post(`/servicedelivery/visitor/service/status`, data),

  // Get active tasks (visitors being served) for Head of Department
  getActiveTasks: (page: number = 1, limit: number = 10, search?: string) => {
    let url = `/servicedelivery/visitor/active-tasks?page=${page}&limit=${limit}`;
    if (search && search.trim()) {
      url += `&search=${encodeURIComponent(search.trim())}`;
    }
    return get(url);
  },
};

// ==================== SMART PARKING APIs ====================

export const parkingService = {
  // Get all parking records (first page only) - use getAllPaginated for pagination
  getAll: async () => {
    try {
      // Fetch only first page to avoid long loading times
      const response = await get(`/smartparking/vehicle?status=all&limit=50&page=1`);
      
      if (response.success) {
        return {
          success: true,
          data: response.data || [],
          total: response.total || 0
        };
      }
      
      return { success: false, data: [], total: 0 };
    } catch (error) {
      console.error('Error fetching parking records:', error);
      return { success: false, data: [], total: 0 };
    }
  },
  
  // Get parking records with pagination
  getAllPaginated: (page: number = 1, limit: number = 50) => get(`/smartparking/vehicle?status=all&page=${page}&limit=${limit}`),
  

  
  // Update parking record
  update: (id: string, data: any) => put(`/smartparking/vehicle/${id}`, data),
  
  // Get all vehicles (first page only) - use getAllPaginated for pagination
  getAllVehicles: async () => {
    try {
      // Fetch only first page to avoid long loading times
      const response = await get(`/smartparking/vehicle?status=all&limit=50&page=1`);
      
      if (response.success) {
        return {
          success: true,
          data: response.data || []
        };
      }
      
      return { success: false, data: [] };
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      return { success: false, data: [] };
    }
  },
  
  // Get parking stats - uses efficient currently-parked endpoint
  getStats: async () => {
    try {
      // Use the efficient currently-parked endpoint to get counts
      const currentlyParkedResponse = await get('/statistics/currently-parked');
      
      if (currentlyParkedResponse.success && currentlyParkedResponse.data) {
        const { total, by_driver_type } = currentlyParkedResponse.data;
        
        // Calculate total slots (assume 200 as default, can be configured)
        const totalSlots = 200;
        const occupiedSlots = total || 0;
        const availableSlots = totalSlots - occupiedSlots;
        
        return {
          success: true,
          data: {
            availableSlots: Math.max(0, availableSlots),
            totalSlots,
            staffVehicles: (by_driver_type?.Staff || 0) + (by_driver_type?.Regular || 0),
            visitorVehicles: by_driver_type?.Visitor || 0,
            reservedSlots: 0, // Will be calculated from detailed data if needed
            newVisitors: 0, // Will be calculated from detailed data if needed
            totalParked: total || 0
          }
        };
      }
      
      return currentlyParkedResponse;
    } catch (error) {
      console.error('Error calculating stats:', error);
      return { success: false, data: {} };
    }
  },

  // Get long duration vehicles - calculates from parking records (both active and recently checked out)
  getLongDurationVehicles: async (date: string | null = null) => {
    try {
      // Build query params
      let queryParams = 'status=all&limit=100';
      if (date) {
        queryParams += `&date=${date}`;
      }

      // Fetch all records (both active and completed)
      const response = await get(`/smartparking/vehicle?${queryParams}`);
      if (response.success && response.data) {
        const records = response.data;
        
        // Calculate duration for each vehicle and filter for long duration (> 8 hours)
        const now = new Date();
        const longDuration = records.filter((r: any) => {
          const entryTime = new Date(r.check_in || r.entry_date || r.createdAt);
          
          // For checked out vehicles, calculate duration from check_out time
          // For active vehicles, calculate from now
          let hoursDiff: number;
          if (r.status === 'completed' && r.check_out) {
            const checkOutTime = new Date(r.check_out);
            hoursDiff = (checkOutTime.getTime() - entryTime.getTime()) / (1000 * 60 * 60);
          } else {
            hoursDiff = (now.getTime() - entryTime.getTime()) / (1000 * 60 * 60);
          }
          
          return hoursDiff > 8; // More than 8 hours
        }).map((r: any) => {
          const entryTime = new Date(r.check_in || r.entry_date || r.createdAt);
          
          // For checked out vehicles, calculate duration from check_out time
          // For active vehicles, calculate from now
          let hoursDiff: number;
          if (r.status === 'completed' && r.check_out) {
            const checkOutTime = new Date(r.check_out);
            hoursDiff = (checkOutTime.getTime() - entryTime.getTime()) / (1000 * 60 * 60);
          } else {
            hoursDiff = (now.getTime() - entryTime.getTime()) / (1000 * 60 * 60);
          }
          
          const hours = Math.floor(hoursDiff);
          const minutes = Math.floor((hoursDiff - hours) * 60);
          
          return {
            plate_no: r.plate_number || r.plate_no || 'N/A',
            entry_time: r.check_in || r.entry_date || r.createdAt,
            check_out: r.check_out || null,
            duration: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
            duration_hours: hoursDiff,
            driver_name: r.driver_name || 'Unknown',
            driver_type: r.driver_type || 'Unknown',
            is_flagged: r.is_flagged || false,
            status: r.status || 'active',
            _id: r._id
          };
        }).sort((a: any, b: any) => {
          // Sort by duration descending
          return b.duration_hours - a.duration_hours;
        });
        
        return {
          success: true,
          data: longDuration
        };
      }
      return response;
    } catch (error) {
      console.error('Error getting long duration vehicles:', error);
      return { success: false, data: [] };
    }
  },

  // Get flagged active vehicles - fetches single page for pagination
  getFlaggedActiveVehicles: async (page: number = 1, limit: number = 50) => {
    try {
      // Use dedicated flagged endpoint with pagination
      const response = await get(`/smartparking/vehicle/flagged?limit=${limit}&page=${page}`);
      if (response.success && response.data) {
        const records = response.data;
        const now = new Date();
        
        // Map the records to the expected format
        const flaggedActive = records.map((r: any) => {
          const entryTime = new Date(r.check_in || r.entry_date || r.createdAt);
          const hoursDiff = (now.getTime() - entryTime.getTime()) / (1000 * 60 * 60);
          const hours = Math.floor(hoursDiff);
          const minutes = Math.floor((hoursDiff - hours) * 60);
          
          return {
            plate_no: r.plate_number || r.plate_no || 'N/A',
            entry_time: r.check_in || r.entry_date || r.createdAt,
            duration: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
            driver_name: r.driver_name || 'Unknown',
            driver_type: r.driver_type || 'Unknown',
            is_flagged: true,
            status: r.status || 'active',
            _id: r._id
          };
        });
        
        return {
          success: true,
          data: flaggedActive,
          total: response.total || 0
        };
      }
      return response;
    } catch (error) {
      console.error('Error getting flagged active vehicles:', error);
      return { success: false, data: [], total: 0 };
    }
  },
  
  // Search parking records
  search: (query: string, page: number = 1, limit: number = 50) => get(`/smartparking/vehicle/search?query=${encodeURIComponent(query)}&status=active&page=${page}&limit=${limit}`),
  
  // Get parking record by ID
  getById: (id: string) => get(`/smartparking/vehicle/${id}`),
  
  // Get vehicle by ID (alias)
  getVehicleById: (id: string) => get(`/smartparking/vehicle/${id}`),

  // Check in vehicle
  checkIn: (data: any) => post('/smartparking/vehicle/checkin', data),
  
  // Check out vehicle
  checkOut: (id: string) => post(`/smartparking/vehicle/checkout`, { id }),
  
  // Check out vehicle by plate number
  checkOutByPlate: (plateNumber: string) => post(`/smartparking/vehicle/checkout`, { plate_number: plateNumber }),
  
  // Verify vehicle
  verifyVehicle: (plateNumber: string) => post('/smartparking/vehicle/verify', { plate_number: plateNumber }),
   
  // Verify car (alias)
  verifyCar: (plateNumber: string) => post('/smartparking/vehicle/verify', { plate_number: plateNumber }),
  
  // Get flagged cars
  getFlagged: () => get('/smartparking/vehicle/flagged'),
  
  // Get flagged vehicles (alias)
  getFlaggedVehicles: () => get('/smartparking/vehicle/flagged'),
  
  // Register single vehicle
  registerSingle: (data: any) => post('/smartparking/register-single', data),
  
  // Bulk upload vehicles
  bulkUpload: (formData: FormData) => post('/smartparking/bulk-upload', formData),
  
  // Flag vehicle
  flagVehicle: (plateNumber: string, reason: string) => post('/smartparking/vehicle/flag', { plate_number: plateNumber, reason }),
};

// Alias for smartParkingService (used by DashboardPage)
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
  // Get all reservations (visitor + staff)
  getAll: (): Promise<{ success: boolean; reservations?: Reservation[]; total?: number }> => 
    get('/smartparking/reservations'),
  
  // Create single visitor reservation
  createVisitorReservation: (data: any) => post('/smartparking/register-single', data),
  
  // Bulk upload visitor reservations (Excel file)
  bulkUploadVisitors: (formData: FormData) => post('/smartparking/bulk-upload', formData),
  
  // Create staff booking
  createStaffBooking: (data: any) => post('/smartparking/staff-booking', data),
  
  // Bulk upload staff reservations (Excel file)
  bulkUploadStaff: (formData: FormData) => post('/smartparking/bulk-staff-upload', formData),
  
  // Cancel reservation
  cancelReservation: (id: string) => put(`/smartparking/reservations/${id}/cancel`, {}),
  
  // Reactivate reservation
  reactivateReservation: (id: string) => put(`/smartparking/reservations/${id}/reactivate`, {}),
};

// Alias for getAllVisitors (used by DashboardPage)
export const serviceDeliveryServiceWithVisitors = {
  ...serviceDeliveryService,
  getAllVisitors: serviceDeliveryService.getAll,
};

// ==================== PERMISSION APIs ====================

export interface SystemPermission {
  resource: string;
  actions: Array<{
    action_type: string;
    description: string;
  }>;
}

export const permissionService = {
  // Get all system resources and their available actions (from backend)
  getSystemPermissions: () => get('/permissions'),
};

// ==================== STATISTICS APIs ====================

export const statisticsService = {
  // Get service delivery statistics
  getServiceDeliveryStats: () => get('/statistics/service-delivery'),
  
  // Get hourly service delivery statistics
  getHourlyServiceDeliveryStats: () => get('/statistics/hourly-service-delivery'),
  
  // Get hourly parking statistics
  getHourlyParkingStats: () => get('/statistics/hourly-parking'),
  
  // Get departments with leaders
  getDepartmentsWithLeaders: () => get('/statistics/departments-leaders'),
  
  // Get employee statistics
  getEmployeeStats: () => get('/statistics/employees'),
  
  // Get feedback totals
  getFeedbackTotals: () => get('/statistics/feedback-totals'),
  
  // Get feedback average by department
  getFeedbackAverageByDepartment: () => get('/statistics/feedback-average'),
  
  // Get currently parked statistics
  getCurrentlyParkedStats: () => get('/statistics/currently-parked'),
  
  // Get flagged vehicles statistics
  getFlaggedVehiclesStats: () => get('/statistics/flagged-vehicles'),
  
  // Get emergency cars statistics
  getEmergencyCarsStats: () => get('/statistics/emergency-cars'),
};

export default {
  departmentService,
  employeeService,
  feedbackService,
  serviceDeliveryService,
  parkingService,
  statisticsService,
};

// ==================== USER ACCOUNT LOCK/UNLOCK APIs ====================

export interface UserAccount {
  _id?: string;
  full_name?: string;
  email?: string;
  telephone?: string;
  department?: string | {
    _id?: string;
    department_id?: string;
    department_name?: string;
  };
  department_name?: string;
  is_active?: boolean;
  is_account_activated?: boolean;
  created_date?: string;
  access_control?: {
    is_locked?: boolean;
    reason?: string;
    last_login_attempt?: number;
  };
}

export interface LockUnlockResponse {
  success: boolean;
  type: string;
  message: string;
  data?: {
    userId: string;
    email: string;
    fullName: string;
    isLocked: boolean;
    reason?: string;
  };
}

export interface LockStatusResponse {
  success: boolean;
  type: string;
  message: string;
  data?: {
    userId: string;
    email: string;
    fullName: string;
    isLocked: boolean;
    reason?: string;
    lastLoginAttempt?: number;
  };
}

export const userAccountService = {
  // Get all users (employees)
  getAllUsers: () => get('/employee/crud'),
  
  // Search users
  searchUsers: (query: string) => get(`/employee/crud/search?query=${encodeURIComponent(query)}`),
  
  // Get user by ID
  getUserById: (id: string) => get(`/employee/crud/${id}`),
  
  // Lock or unlock a user account
  lockUnlock: (userId: string, action: 'lock' | 'unlock', reason?: string) => 
    post('/auth/lock-unlock', { userId, action, reason }),
  
  // Check account lock status
  checkLockStatus: (userId: string) => 
    post('/auth/lock-unlock/status', { userId }),
  
  // Reset login attempts
  resetLoginAttempts: (userId: string) => 
    post('/auth/lock-unlock/reset-attempts', { userId }),
};

// ==================== ROLE APIs ====================

export interface Role {
  _id?: string;
  role_name: string;
  permissions?: Array<{
    resource_name: string;
    actions: Array<{
      action: string;
      description?: string;
      is_enabled?: boolean;
    }>;
  }>;
}

// Role creation input - matches backend format
export interface CreateRoleInput {
  role_name: string;
  permissions?: Array<{
    resource_name: string;
    actions: string[]; // Backend accepts simple string array
  }>;
}

export const roleService = {
  // Get all roles from backend
  getAll: () => get('/roles'),
  
  // Get role by ID
  getById: (id: string) => get(`/roles/${id}`),
  
  // Get role by name
  getByName: (name: string) => get(`/roles/name/${name}`),
  
  // Create new role
  create: (data: CreateRoleInput) => post('/roles', data),
  
  // Update role
  update: (id: string, data: { role_name?: string; permissions?: Array<{ resource_name: string; actions: string[] }> }) => put(`/roles/${id}`, data),
  
  // Delete role
  delete: (id: string) => del(`/roles/${id}`),
  
  // Get available resources
  getAvailableResources: () => get('/roles/resources/available'),
  
  // Toggle permission
  togglePermission: (id: string, resource_name: string, action: string, enabled?: boolean) => 
    put(`/roles/${id}/permissions/toggle`, { resource_name, action, enabled }),
  
  // Bulk update permissions
  bulkUpdatePermissions: (id: string, permissions: Array<{ resource_name: string; actions: string[] }>) => 
    put(`/roles/${id}/permissions/bulk`, { permissions }),
};

