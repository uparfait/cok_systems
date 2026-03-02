// Admin API Services - Centralized API calls for admin portal
// All admin-related API endpoints are defined here

import { get, post, put, del } from './apiClient';

// ==================== DEPARTMENT APIs ====================

export const departmentService = {
  // Get all departments
  getAll: () => get('/department/crud'),
  
  // Search departments
  search: (query) => get(`/department/crud/search?q=${encodeURIComponent(query)}`),
  
  // Get department by ID
  getById: (id) => get(`/department/crud/${id}`),
  
  // Get department leader by email
  getLeader: (email) => get(`/department/crud/leader/${encodeURIComponent(email)}`),
  
  // Create new department
  create: (data) => post('/department/crud', data),
  
  // Update department
  update: (id, data) => put(`/department/crud/${id}`, data),
  
  // Delete department
  delete: (id) => del(`/department/crud/${id}`),
};

// ==================== EMPLOYEE APIs ====================

export const employeeService = {
  // Get all employees
  getAll: () => get('/employee/crud'),
  
  // Search employees
  search: (query) => get(`/employee/crud/search?q=${encodeURIComponent(query)}`),
  
  // Get employee by ID
  getById: (id) => get(`/employee/crud/${id}`),
  
  // Create new employee
  create: (data) => post('/employee/crud', data),
  
  // Update employee
  update: (id, data) => put(`/employee/crud/${id}`, data),
  
  // Delete employee
  delete: (id) => del(`/employee/crud/${id}`),
  
  // Register single staff car
  registerCar: (data) => post('/employee/crud/register-car', data),
  
  // Bulk upload staff cars
  bulkUploadCars: (formData) => post('/employee/crud/bulk-upload-cars', formData, {
    'Content-Type': 'multipart/form-data',
  }),
};

// ==================== SYSTEM PERMISSION APIs ====================

export const permissionService = {
  // Get all system permissions
  getAll: () => get('/permissions'),
  
  // Get permissions by resource
  getByResource: (resource) => get(`/permissions/resource/${encodeURIComponent(resource)}`),
  
  // Assign permissions to user
  assignToUser: (userId, permissions) => post(`/permissions/user/${userId}/assign`, { permissions }),
  
  // Remove permissions from user
  removeFromUser: (userId, permissions) => post(`/permissions/user/${userId}/remove`, { permissions }),
};

// ==================== FEEDBACK APIs ====================

export const feedbackService = {
  // Search all feedback
  searchAll: (limit = 50, page = 1) => get(`/feedback/search?limit=${limit}&page=${page}`),
  
  // Search feedback by department
  searchByDepartment: (departmentId, from, to) => {
    let url = `/feedback/search-by-department?department_id=${departmentId}`;
    if (from) url += `&from=${from}`;
    if (to) url += `&to=${to}`;
    return get(url);
  },
  
  // Get feedback by ID
  getById: (id) => get(`/feedback/${id}`),
  
  // Submit feedback
  submit: (data) => post('/feedback/submit', data),
  
  // Verify phone
  verifyPhone: (phone) => post('/feedback/verify-phone', { phone }),
  
  // Delete feedback
  delete: (id) => del(`/feedback/${id}`),
};

// ==================== SERVICE DELIVERY APIs ====================

export const serviceDeliveryService = {
  // Get all visitors
  getAllVisitors: () => get('/servicedelivery/visitor'),
  
  // Search visitors
  searchVisitors: (query) => get(`/servicedelivery/visitor/search?q=${encodeURIComponent(query)}`),
  
  // Get visitor by ID
  getVisitorById: (id) => get(`/servicedelivery/visitor/${id}`),
  
  // Visitor check-in
  checkIn: (data) => post('/servicedelivery/visitor/checkin', data),
  
  // Assign visitor to department
  assignToDepartment: (data) => post('/servicedelivery/visitor/assign', data),
  
  // Visitor check-out
  checkOut: (data) => post('/servicedelivery/visitor/checkout', data),
  
  // Toggle service status
  toggleServiceStatus: (data) => post('/servicedelivery/visitor/service/status', data),
  
  // Emergency leave/return
  emergencyLeaveReturn: (data) => post('/servicedelivery/visitor/emergency/leave-return', data),
};

// ==================== SMART PARKING APIs ====================

export const smartParkingService = {
  // Get all vehicles
  getAllVehicles: () => get('/smartparking/vehicle'),
  
  // Search vehicles
  searchVehicles: (query) => get(`/smartparking/vehicle/search?q=${encodeURIComponent(query)}`),
  
  // Get flagged vehicles
  getFlaggedVehicles: () => get('/smartparking/vehicle/flagged'),
  
  // Get vehicle by ID
  getVehicleById: (id) => get(`/smartparking/vehicle/${id}`),
  
  // Verify car
  verifyCar: (data) => post('/smartparking/vehicle/verify', data),
  
  // Car check-in
  checkIn: (data) => post('/smartparking/vehicle/checkin', data),
  
  // Car check-out
  checkOut: (data) => post('/smartparking/vehicle/checkout', data),
  
  // Register single reservation
  registerSingle: (data) => post('/smartparking/register-single', data),
  
  // Bulk upload reservations
  bulkUpload: (formData) => post('/smartparking/bulk-upload', formData, {
    'Content-Type': 'multipart/form-data',
  }),
};

export default {
  departmentService,
  employeeService,
  permissionService,
  feedbackService,
  serviceDeliveryService,
  smartParkingService,
};
