// serviceDeliveryService - Service delivery API service
// Handles all service delivery-related API calls to backend

import { get, post } from '../../../core/services/apiClient';

// ==================== VISITOR APIs ====================

/**
 * Get all visitors with pagination
 * Backend: GET /service_delivery/visitor
 * @param {object} params - Query parameters (page, limit, status, department)
 * @returns {Promise} - List of visitors
 */
export const getVisitors = async (params: Record<string, unknown> = {}) => {
  try {
    const queryString = new URLSearchParams(params as Record<string, string>).toString();
    const response = await get(`/service_delivery/visitor?${queryString}`);
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Search visitors
 * Backend: GET /service_delivery/visitor/search
 * @param {object} params - Search parameters (nationalId, name, phone, status)
 * @returns {Promise} - Search results
 */
export const searchVisitors = async (params: Record<string, unknown> = {}) => {
  try {
    const queryString = new URLSearchParams(params as Record<string, string>).toString();
    const response = await get(`/service_delivery/visitor/search?${queryString}`);
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Get visitor by ID
 * Backend: GET /service_delivery/visitor/:id
 * @param {string} id - Visitor ID
 * @returns {Promise} - Visitor data
 */
export const getVisitorById = async (id: string) => {
  try {
    const response = await get(`/service_delivery/visitor/${id}`);
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Check in visitor
 * Backend: POST /service_delivery/visitor/checkin
 * @param {object} data - Visitor check-in data
 * @returns {Promise} - Check-in result
 */
export const checkInVisitor = async (data: Record<string, unknown>) => {
  try {
    const response = await post('/service_delivery/visitor/checkin', data);
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Assign visitor to department
 * Backend: POST /service_delivery/visitor/assign
 * @param {object} data - Assignment data (visitorId, departmentId, notes)
 * @returns {Promise} - Assignment result
 */
export const assignVisitorToDepartment = async (data: Record<string, unknown>) => {
  try {
    const response = await post('/service_delivery/visitor/assign', data);
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Check out visitor
 * Backend: POST /service_delivery/visitor/checkout
 * @param {object} data - Visitor check-out data
 * @returns {Promise} - Check-out result
 */
export const checkOutVisitor = async (data: Record<string, unknown>) => {
  try {
    const response = await post('/service_delivery/visitor/checkout', data);
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Toggle visitor service status
 * Backend: POST /service_delivery/visitor/service/status
 * @param {object} data - Status toggle data
 * @returns {Promise} - Status toggle result
 */
export const toggleServiceStatus = async (data: Record<string, unknown>) => {
  try {
    const response = await post('/service_delivery/visitor/service/status', data);
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Toggle emergency leave/return
 * Backend: POST /service_delivery/visitor/emergency/leave-return
 * @param {object} data - Leave/return data
 * @returns {Promise} - Leave/return result
 */
export const toggleEmergencyLeaveReturn = async (data: Record<string, unknown>) => {
  try {
    const response = await post('/service_delivery/visitor/emergency/leave-return', data);
    return response;
  } catch (error) {
    throw error;
  }
};

// ==================== DEPARTMENT APIs ====================

/**
 * Get all departments
 * Backend: GET /department/crud
 * @returns {Promise} - List of departments
 */
export const getDepartments = async () => {
  try {
    const response = await get('/department/crud');
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Search departments
 * Backend: GET /department/crud/search
 * @param {string} query - Search query
 * @returns {Promise} - Search results
 */
export const searchDepartments = async (query: string) => {
  try {
    const response = await get(`/department/crud/search?q=${encodeURIComponent(query)}`);
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Get department by ID
 * Backend: GET /department/crud/:id
 * @param {string} id - Department ID
 * @returns {Promise} - Department data
 */
export const getDepartmentById = async (id: string) => {
  try {
    const response = await get(`/department/crud/${id}`);
    return response;
  } catch (error) {
    throw error;
  }
};
