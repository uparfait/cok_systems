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
  // Get all visitors
  getAll: () => get('/servicedelivery/visitor'),
  
  // Get all visitors (alias)
  getAllVisitors: () => get('/servicedelivery/visitor'),
  
  // Search visitors
  search: (query: string) => get(`/servicedelivery/visitor/search?query=${encodeURIComponent(query)}`),
  
  // Search visitors (alias)
  searchVisitors: (query: string) => get(`/servicedelivery/visitor/search?query=${encodeURIComponent(query)}`),
  
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
  assignToDepartment: (id: string, departmentId: string) => post(`/servicedelivery/visitor/assign/${id}`, { department_id: departmentId }),
  
  // Emergency leave return
  emergencyLeaveReturn: (id: string, data: any) => post(`/servicedelivery/visitor/emergency/leave-return/${id}`, data),
};

// ==================== SMART PARKING APIs ====================

export const parkingService = {
  // Get all parking records
  getAll: () => get('/smartparking/vehicle'),
  
  // Get all vehicles (alias)
  getAllVehicles: () => get('/smartparking/vehicle'),
  
  // Search parking records
  search: (query: string) => get(`/smartparking/vehicle/search?query=${encodeURIComponent(query)}`),
  
  // Search vehicles (alias)
  searchVehicles: (query: string) => get(`/smartparking/vehicle/search?query=${encodeURIComponent(query)}`),
  
  // Get parking record by ID
  getById: (id: string) => get(`/smartparking/vehicle/${id}`),
  
  // Get vehicle by ID (alias)
  getVehicleById: (id: string) => get(`/smartparking/vehicle/${id}`),
  
  // Check in vehicle
  checkIn: (data: any) => post('/smartparking/vehicle/checkin', data),
  
  // Check out vehicle
  checkOut: (id: string) => post(`/smartparking/vehicle/checkout`, { id }),
  
  // Verify vehicle
  verifyVehicle: (plateNumber: string) => get(`/smartparking/vehicle/verify?plateNumber=${encodeURIComponent(plateNumber)}`),
  
  // Verify car (alias)
  verifyCar: (plateNumber: string) => get(`/smartparking/vehicle/verify?plateNumber=${encodeURIComponent(plateNumber)}`),
  
  // Get flagged cars
  getFlagged: () => get('/smartparking/vehicle/flagged'),
  
  // Get flagged vehicles (alias)
  getFlaggedVehicles: () => get('/smartparking/vehicle/flagged'),
  
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

export default {
  departmentService,
  employeeService,
  feedbackService,
  serviceDeliveryService,
  parkingService,
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

export const roleService = {
  // Get all roles from backend
  getAll: () => get('/roles'),
  
  // Get role by ID
  getById: (id: string) => get(`/roles/${id}`),
  
  // Get role by name
  getByName: (name: string) => get(`/roles/name/${name}`),
  
  // Create new role
  create: (data: Partial<Role>) => post('/roles', data),
  
  // Update role
  update: (id: string, data: Partial<Role>) => put(`/roles/${id}`, data),
  
  // Delete role
  delete: (id: string) => del(`/roles/${id}`),
};
