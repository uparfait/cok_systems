// Centralized API Client with Axios
// Provides a flexible endpoint-based API caller with automatic auth token attachment

import axios from 'axios';

// Base URL - defaults to local, override with environment variable
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://cok-bc.onrender.com/cok/api';

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token storage keys
const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const USER_DATA_KEY = 'userData';

/**
 * Get access token from storage
 */
export const getAccessToken = () => localStorage.getItem(ACCESS_TOKEN_KEY);

/**
 * Get refresh token from storage
 */
export const getRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_KEY);

/**
 * Get user data from storage
 */
export const getStoredUser = () => {
  const userStr = localStorage.getItem(USER_DATA_KEY);
  if (userStr) {
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }
  return null;
};

/**
 * Store tokens and user data
 */
export const setAuthData = (tokens, user) => {
  if (tokens?.accessToken) {
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  }
  if (tokens?.refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  }
  if (user) {
    localStorage.setItem(USER_DATA_KEY, JSON.stringify(user));
  }
};

/**
 * Clear all auth data
 */
export const clearAuthData = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_DATA_KEY);
};

/**
 * Check if user is authenticated
 * Checks for token OR user data in localStorage (workaround for backend not returning tokens)
 */
export const isAuthenticated = () => {
  const token = getAccessToken();
  if (token) return true;
  
  // Also check for authenticated user data stored after OTP verification
  const userData = localStorage.getItem('userData');
  const isAuth = localStorage.getItem('isAuthenticated');
  
  return !!(userData && isAuth === 'true');
};

/**
 * Redirect to login page
 */
const redirectToLogin = () => {
  clearAuthData();
  window.location.href = '/login';
};

// Request interceptor - Add auth token to every request
apiClient.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle auth errors and token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = getRefreshToken();
        if (refreshToken) {
          // Try to refresh the token
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });

          if (response.data?.status && response.data?.data?.tokens) {
            const { accessToken, refreshToken: newRefreshToken } = response.data.data.tokens;
            localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
            localStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken);

            // Retry the original request
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            return apiClient(originalRequest);
          }
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        redirectToLogin();
        return Promise.reject(refreshError);
      }
    }

    // For other errors, check if it's an auth error
    if (error.response?.status === 401) {
      redirectToLogin();
    }

    return Promise.reject(error.response?.data || { error: error.message });
  }
);

/**
 * Centralized API request function
 * @param {string} endpoint - API endpoint (e.g., '/auth/login')
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE, PATCH)
 * @param {object} data - Request body data
 * @param {object} customHeaders - Additional headers if needed
 * @returns {Promise} - API response
 */
export const apiRequest = async (endpoint, method = 'GET', data = null, customHeaders = {}) => {
  const config = {
    method,
    url: endpoint,
    headers: {
      ...customHeaders,
    },
  };

  if (data) {
    config.data = data;
  }

  try {
    const response = await apiClient(config);
    return response.data;
  } catch (error) {
    // Re-throw with standardized error format
    if (error?.status === false) {
      throw error; // Already formatted error from interceptor
    }
    throw {
      status: false,
      error: error.response?.data?.error || error.message,
      message: error.response?.data?.message || 'An error occurred',
    };
  }
};

// Convenience methods
export const get = (endpoint, customHeaders = {}) => 
  apiRequest(endpoint, 'GET', null, customHeaders);

export const post = (endpoint, data, customHeaders = {}) => 
  apiRequest(endpoint, 'POST', data, customHeaders);

export const put = (endpoint, data, customHeaders = {}) => 
  apiRequest(endpoint, 'PUT', data, customHeaders);

export const patch = (endpoint, data, customHeaders = {}) => 
  apiRequest(endpoint, 'PATCH', data, customHeaders);

export const del = (endpoint, customHeaders = {}) => 
  apiRequest(endpoint, 'DELETE', null, customHeaders);

export default apiClient;
