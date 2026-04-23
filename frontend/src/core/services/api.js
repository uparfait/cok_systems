// Centralized API Service
// Provides all API methods for the application

import { get, post, put, patch, del } from './apiClient';

// ==================== AUTH APIs ====================

// Login
export const login = (email, password) => post('/auth/login', { email, password });
export const verifyLoginOTP = (userId, otp) => post('/auth/login/verify', { userId, otp });
export const resendLoginOTP = (userId, email) => post('/auth/login/resend', { userId, email });

// Logout
export const logout = () => post('/auth/logout', {});
export const logoutAll = () => post('/auth/logout/all', {});

// Password Reset
export const requestPasswordReset = (email) => post('/auth/password-reset', { email });
export const verifyPasswordResetOTP = (userId, otp) => post('/auth/password-reset/verify', { userId, otp });
export const resetPassword = (userId, tempToken, newPassword) => post('/auth/password-reset/reset', { userId, tempToken, newPassword });
export const resendPasswordResetOTP = (userId, email) => post('/auth/password-reset/resend', { userId, email });

// First Time Login
export const checkEmailForFirstLogin = (email) => post('/auth/first-login/check-email', { email });
export const sendFirstLoginOTP = (email) => post('/auth/first-login/send-otp', { email });
export const verifyFirstLoginOTP = (email, otp) => post('/auth/first-login/verify', { email, otp });
export const activateAccount = (userId, tempToken, password) => post('/auth/first-login/activate', { userId, tempToken, password });
export const resendFirstLoginOTP = (email) => post('/auth/first-login/resend-otp', { email });

// Lock/Unlock
export const lockAccount = (userId, reason) => post('/auth/lock-unlock/lock', { userId, reason });
export const unlockAccount = (userId) => post('/auth/lock-unlock/unlock', { userId });

// ==================== DEPARTMENT APIs ====================

export const getAllDepartments = () => get('/department');
export const getDepartmentById = (id) => get(`/department/${id}`);
export const createDepartment = (data) => post('/department', data);
export const updateDepartment = (id, data) => put(`/department/${id}`, data);
export const deleteDepartment = (id) => del(`/department/${id}`);
export const searchDepartment = (query) => get(`/department/search?q=${query}`);
export const getDepartmentLeader = (email) => get(`/department/leader/${email}`);

// ==================== EMPLOYEE APIs ====================

export const getAllEmployees = () => get('/employee/crud');
export const getEmployeeById = (id) => get(`/employee/crud/${id}`);
export const createEmployee = (data) => post('/employee/crud', data);
export const updateEmployee = (id, data) => put(`/employee/crud/${id}`, data);
export const deleteEmployee = (id) => del(`/employee/crud/${id}`);
export const searchEmployee = (query) => get(`/employee/crud/search?q=${query}`);

// ==================== SERVICE DELIVERY APIs ====================

export const getAllVisitors = () => get('/service_delivery/visitor');
export const getVisitorById = (id) => get(`/service_delivery/visitor/${id}`);
export const visitorCheckIn = (data) => post('/service_delivery/visitor/checkin', data);
export const visitorCheckOut = (id) => post('/service_delivery/visitor/checkout', { visitor_id: id });
export const assignVisitorToDepartment = (visitorId, departmentId, data) => 
  post('/service_delivery/visitor/assign', { visitor_id: visitorId, department_id: departmentId, ...data });
export const toggleLeaveOutsideAndReturn = (id, data) => post('/service_delivery/visitor/emergency/leave-return', { visitor_id: id, ...data });
export const toggleServiceStatus = (id, status) => post('/service_delivery/visitor/service/status', { visitor_id: id, status });
export const searchVisitor = (query) => get(`/service_delivery/visitor/search?q=${query}`);

// ==================== SMART PARKING APIs ====================

export const getAllParkingRecords = () => get('/smartparking');
export const getParkingRecordById = (id) => get(`/smartparking/${id}`);
export const carCheckIn = (data) => post('/smartparking/checkin', data);
export const carCheckOut = (id, data) => post(`/smartparking/checkout/${id}`, data);
export const verifyCar = (plateNumber) => post('/smartparking/verify', { plate_number: plateNumber });
export const listFlaggedCars = () => get('/smartparking/flagged');
export const searchParkingRecords = (query) => get(`/smartparking/search?q=${query}`);

// ==================== FEEDBACK APIs ====================

export const verifyFeedbackPhone = (telephone) => post('/feedback/verify-phone', { telephone });
export const submitFeedback = (data) => post('/feedback/submit', data);
export const getFeedbackByPhone = (telephone) => get(`/feedback/by-phone/${telephone}`);

// ==================== PERMISSIONS APIs ====================

export const getAllPermissions = () => get('/permissions');
export const getPermissionById = (id) => get(`/permissions/${id}`);
export const createPermission = (data) => post('/permissions', data);
export const updatePermission = (id, data) => put(`/permissions/${id}`, data);
export const deletePermission = (id) => del(`/permissions/${id}`);

export default {
  // Auth
  login,
  verifyLoginOTP,
  resendLoginOTP,
  logout,
  logoutAll,
  requestPasswordReset,
  verifyPasswordResetOTP,
  resetPassword,
  resendPasswordResetOTP,
  checkEmailForFirstLogin,
  sendFirstLoginOTP,
  verifyFirstLoginOTP,
  activateAccount,
  resendFirstLoginOTP,
  lockAccount,
  unlockAccount,
  
  // Departments
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  searchDepartment,
  getDepartmentLeader,
  
  // Employees
  getAllEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  searchEmployee,
  
  // Service Delivery
  getAllVisitors,
  getVisitorById,
  visitorCheckIn,
  visitorCheckOut,
  assignVisitorToDepartment,
  toggleLeaveOutsideAndReturn,
  toggleServiceStatus,
  searchVisitor,
  
  // Smart Parking
  getAllParkingRecords,
  getParkingRecordById,
  carCheckIn,
  carCheckOut,
  verifyCar,
  listFlaggedCars,
  searchParkingRecords,
  
  // Permissions
  getAllPermissions,
  getPermissionById,
  createPermission,
  updatePermission,
  deletePermission,
  
  // Feedback
  verifyFeedbackPhone,
  submitFeedback,
  getFeedbackByPhone,
};
