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
};

// ==================== FEEDBACK APIs ====================

export const feedbackService = {
  // Get all feedback
  getAll: () => get('/feedback'),
  
  // Search feedback
  search: (query: string) => get(`/feedback/search?query=${encodeURIComponent(query)}`),
  
  // Get feedback by ID
  getById: (id: string) => get(`/feedback/${id}`),
  
  // Submit feedback
  submit: (data: any) => post('/feedback', data),
  
  // Delete feedback
  delete: (id: string) => del(`/feedback/${id}`),
};

// ==================== SERVICE DELIVERY APIs ====================

export const serviceDeliveryService = {
  // Get all visitors with pagination and filter
  getAll: (page: number = 1, limit: number = 20, inHouse: boolean = true) => get(`/servicedelivery/visitor?page=${page}&limit=${limit}&in_house=${inHouse}`),
  
  // Get all visitors (alias)
  getAllVisitors: (page: number = 1, limit: number = 20) => get(`/servicedelivery/visitor?page=${page}&limit=${limit}`),
  
  // Search visitors with pagination
  search: (query: string, page: number = 1, limit: number = 20) => get(`/servicedelivery/visitor/search?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`),
  
  // Search visitors (alias)
  searchVisitors: (query: string, page: number = 1, limit: number = 20) => get(`/servicedelivery/visitor/search?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`),
  
  // Get visitor by ID
  getById: (id: string) => get(`/servicedelivery/visitor/${id}`),
  
  // Get visitor by ID (alias)
  getVisitorById: (id: string) => get(`/servicedelivery/visitor/${id}`),
  
  // Check in visitor
  checkIn: (data: any) => post('/servicedelivery/visitor/checkin', data),
  
  // Check out visitor
  checkOut: (id: string) => post(`/servicedelivery/visitor/checkout`, { id }),
  
  // Toggle service status
  toggleStatus: (id: string, status: string) => post(`/servicedelivery/visitor/service/status`, { id, status }),
  
  // Toggle service status (alias)
  toggleServiceStatus: (id: string, status: string) => post(`/servicedelivery/visitor/service/status`, { id, status }),
  
  // Assign to department
  assignToDepartment: (visitorId: string, departmentId: string, departmentName: string, providerId?: string, providerName?: string) => 
    post(`/servicedelivery/visitor/assign`, { 
      visitor_id: visitorId, 
      new_department_id: departmentId,
      new_department_name: departmentName,
      provider_id: providerId,
      provider_name: providerName
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
  getCurrentVisitorsByProvider: (providerId: string) => get(`/servicedelivery/visitor/by-provider-current/${encodeURIComponent(providerId)}`),
  
  // Emergency leave return
  emergencyLeaveReturn: (id: string, data: any) => post(`/servicedelivery/visitor/emergency/leave-return/${id}`, data),
  // 👉 ADD THIS NEW UPDATE FUNCTION:
  update: (id: string, data: any) => put(`/servicedelivery/visitor/${id}`, data),
};

// ==================== SMART PARKING APIs ====================

export const parkingService = {
  // Get all parking records (including all statuses)
  getAll: () => get('/smartparking/vehicle?status=all&limit=100'),
  
  // Get all vehicles (alias)
  getAllVehicles: () => get('/smartparking/vehicle?status=all&limit=100'),
  
  // Get parking stats - calculates from parking records
  getStats: async () => {
    try {
      const response = await get('/smartparking/vehicle?status=all&limit=100');
      if (response.success && response.data) {
        const records = response.data;
        const activeRecords = records.filter((r: any) => r.status === 'active');
        const staffVehicles = activeRecords.filter((r: any) => r.driver_type === 'Staff' || r.driver_type === 'Regular');
        const visitorVehicles = activeRecords.filter((r: any) => r.driver_type === 'Visitor');
        
        // Calculate total slots (assume 200 as default, can be configured)
        const totalSlots = 200;
        const occupiedSlots = activeRecords.length;
        const availableSlots = totalSlots - occupiedSlots;
        
        // Count reserved vehicles
        const reservedVehicles = activeRecords.filter((r: any) => r.is_reserved || r.reserved);
        
        // Get new visitors today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const newVisitors = records.filter((r: any) => {
          const checkInDate = new Date(r.check_in || r.entry_date);
          return checkInDate >= today && (r.driver_type === 'Visitor');
        }).length;
        
        return {
          success: true,
          data: {
            availableSlots: Math.max(0, availableSlots),
            totalSlots,
            staffVehicles: staffVehicles.length,
            visitorVehicles: visitorVehicles.length,
            reservedSlots: reservedVehicles.length,
            newVisitors,
            totalParked: activeRecords.length
          }
        };
      }
      return response;
    } catch (error) {
      console.error('Error calculating stats:', error);
      return { success: false, data: {} };
    }
  },
  
  // Get long duration vehicles - calculates from parking records (both active and recently checked out)
  getLongDurationVehicles: async () => {
    try {
      // Fetch all records (both active and completed)
      const response = await get('/smartparking/vehicle?status=all&limit=100');
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

  // Get flagged active vehicles (including historical flagged records)
  getFlaggedActiveVehicles: async () => {
    try {
      // Fetch all records (both active and completed)
      const response = await get('/smartparking/vehicle?status=all&limit=100');
      if (response.success && response.data) {
        const records = response.data;
        
        // Filter for flagged vehicles (both active and recently checked out but were flagged)
        const now = new Date();
        const flaggedActive = records.filter((r: any) => {
          // Include if currently flagged
          if (r.is_flagged === true) return true;
          // Include if was flagged and checked out within last 24 hours
          if (r.is_flagged === true && r.status === 'completed') {
            const checkOutTime = new Date(r.check_out || r.exit_date || r.updatedAt);
            const hoursSinceCheckout = (now.getTime() - checkOutTime.getTime()) / (1000 * 60 * 60);
            return hoursSinceCheckout < 24;
          }
          return false;
        }).map((r: any) => {
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
          data: flaggedActive
        };
      }
      return response;
    } catch (error) {
      console.error('Error getting flagged active vehicles:', error);
      return { success: false, data: [] };
    }
  },
  
  // Search parking records
  search: (query: string) => get(`/smartparking/vehicle/search?query=${encodeURIComponent(query)}&status=all`),
  
  // Search vehicles (alias)
  searchVehicles: (query: string) => get(`/smartparking/vehicle/search?query=${encodeURIComponent(query)}&status=all`),
  
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
  
  // Flag a vehicle
  flagVehicle: (plateNumber: string, reason: string) => post('/smartparking/vehicle/flag', { plate_number: plateNumber, reason }),
  
  // Register single vehicle
  registerSingle: (data: any) => post('/smartparking/register-single', data),
  
  // Bulk upload vehicles
  bulkUpload: (formData: FormData) => post('/smartparking/bulk-upload', formData),
};

// Alias for smartParkingService (used by DashboardPage)
export const smartParkingService = parkingService;

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
  
  // Get permissions for a specific resource
  getResourcePermissions: (resource: string) => get(`/permissions/resource/${encodeURIComponent(resource)}`),
  
  // Assign permissions to a user
  assignPermissions: (userId: string, resource: string, actions: string[]) => 
    post(`/permissions/user/${userId}/assign`, { resource, actions }),
  
  // Remove permissions from a user
  removePermissions: (userId: string, resource: string, actions?: string[]) => 
    post(`/permissions/user/${userId}/remove`, { resource, actions }),
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
