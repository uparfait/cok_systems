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
}

export const departmentService = {
  // Get all departments
  getAll: () => get('/department/crud'),
  
  // Search departments
  search: (query: string) => get(`/department/crud/search?q=${encodeURIComponent(query)}`),
  
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
  department?: string;
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
  search: (query: string) => get(`/employee/crud/search?q=${encodeURIComponent(query)}`),
  
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
  search: (query: string) => get(`/feedback/search?q=${encodeURIComponent(query)}`),
  
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
  getAll: () => get('/service_delivery'),
  
  // Get all visitors (alias)
  getAllVisitors: () => get('/service_delivery'),
  
  // Search visitors
  search: (query: string) => get(`/service_delivery/search?q=${encodeURIComponent(query)}`),
  
  // Search visitors (alias)
  searchVisitors: (query: string) => get(`/service_delivery/search?q=${encodeURIComponent(query)}`),
  
  // Get visitor by ID
  getById: (id: string) => get(`/service_delivery/${id}`),
  
  // Get visitor by ID (alias)
  getVisitorById: (id: string) => get(`/service_delivery/${id}`),
  
  // Check in visitor
  checkIn: (data: any) => post('/service_delivery/checkin', data),
  
  // Check out visitor
  checkOut: (id: string) => post(`/service_delivery/checkout/${id}`, {}),
  
  // Toggle service status
  toggleStatus: (id: string, status: string) => post(`/service_delivery/toggle-status/${id}`, { status }),
  
  // Toggle service status (alias)
  toggleServiceStatus: (id: string, status: string) => post(`/service_delivery/toggle-status/${id}`, { status }),
  
  // Assign to department
  assignToDepartment: (id: string, departmentId: string) => post(`/service_delivery/assign/${id}`, { department_id: departmentId }),
  
  // Emergency leave return
  emergencyLeaveReturn: (id: string, data: any) => post(`/service_delivery/emergency-leave-return/${id}`, data),
};

// ==================== SMART PARKING APIs ====================

export const parkingService = {
  // Get all parking records
  getAll: () => get('/smartparking'),
  
  // Get all vehicles (alias)
  getAllVehicles: () => get('/smartparking'),
  
  // Search parking records
  search: (query: string) => get(`/smartparking/search?q=${encodeURIComponent(query)}`),
  
  // Search vehicles (alias)
  searchVehicles: (query: string) => get(`/smartparking/search?q=${encodeURIComponent(query)}`),
  
  // Get parking record by ID
  getById: (id: string) => get(`/smartparking/${id}`),
  
  // Get vehicle by ID (alias)
  getVehicleById: (id: string) => get(`/smartparking/${id}`),
  
  // Check in vehicle
  checkIn: (data: any) => post('/smartparking/checkin', data),
  
  // Check out vehicle
  checkOut: (id: string) => post(`/smartparking/checkout/${id}`, {}),
  
  // Verify vehicle
  verifyVehicle: (plateNumber: string) => get(`/smartparking/verify/${encodeURIComponent(plateNumber)}`),
  
  // Verify car (alias)
  verifyCar: (plateNumber: string) => get(`/smartparking/verify/${encodeURIComponent(plateNumber)}`),
  
  // Get flagged cars
  getFlagged: () => get('/smartparking/flagged'),
  
  // Get flagged vehicles (alias)
  getFlaggedVehicles: () => get('/smartparking/flagged'),
  
  // Register single vehicle
  registerSingle: (data: any) => post('/smartparking/register', data),
  
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
  getSystemPermissions: () => get('/system_permission'),
  
  // Get permissions for a specific resource
  getResourcePermissions: (resource: string) => get(`/system_permission/resource/${encodeURIComponent(resource)}`),
  
  // Assign permissions to a user
  assignPermissions: (userId: string, resource: string, actions: string[]) => 
    post(`/system_permission/assign/${userId}`, { resource, actions }),
  
  // Remove permissions from a user
  removePermissions: (userId: string, resource: string, actions?: string[]) => 
    post(`/system_permission/remove/${userId}`, { resource, actions }),
};

export default {
  departmentService,
  employeeService,
  feedbackService,
  serviceDeliveryService,
  parkingService,
};
