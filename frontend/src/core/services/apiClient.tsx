// Centralized API Client with Axios
// Provides a flexible endpoint-based API caller with automatic auth token attachment

import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosError } from 'axios';

// Custom events for toast notifications from API client
// These events are listened to by ToastContext
export const TOAST_EVENTS = {
  SHOW_SUCCESS: 'cok:toast-success',
  SHOW_ERROR: 'cok:toast-error',
  SHOW_WARNING: 'cok:toast-warning',
};

// Helper to dispatch toast events
export const dispatchToast = (type: 'success' | 'error' | 'warning', message: string) => {
  if (typeof window !== 'undefined') {
    const event = new CustomEvent(TOAST_EVENTS[type === 'success' ? 'SHOW_SUCCESS' : type === 'error' ? 'SHOW_ERROR' : 'SHOW_WARNING'], {
      detail: { message }
    });
    window.dispatchEvent(event);
  }
};

// Base URL - uses Vite proxy in development, production URL in production
const API_BASE_URL = import.meta.env.VITE_API_URL || '/cok/api';

// Token storage keys
const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const USER_DATA_KEY = 'userData';

// Types
export interface AuthTokens {
  accessToken?: string;
  refreshToken?: string;
}

export interface ApiResponse<T = any> {
  status: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface UserData {
  userId?: string;
  email?: string;
  fullName?: string;
  role?: string;
  departmentName?: string;
  department_id?: string;
  permissions?: Array<{
    resource: string;
    actions: string[];
  }>;
  [key: string]: any;
}

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Get access token from storage
 */
export const getAccessToken = (): string | null => localStorage.getItem(ACCESS_TOKEN_KEY);

/**
 * Get refresh token from storage
 */
export const getRefreshToken = (): string | null => localStorage.getItem(REFRESH_TOKEN_KEY);

/**
 * Get user data from storage
 */
export const getStoredUser = (): UserData | null => {
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
export const setAuthData = (tokens: AuthTokens, user: UserData | null) => {
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
  // Also clear any session flags
  localStorage.removeItem('isAuthenticated');
  localStorage.removeItem('pendingUserId');
  localStorage.removeItem('pendingEmail');
};

/**
 * Check if user is authenticated
 * Also checks localStorage for authenticated user data when no token exists
 */
export const isAuthenticated = (): boolean => {
  const token = getAccessToken();
  if (token) return true;
  
  // Check for authenticated user data stored after OTP verification
  const userData = localStorage.getItem('userData');
  const isAuth = localStorage.getItem('isAuthenticated');
  
  return !!(userData && isAuth === 'true');
};

/**
 * Redirect to login page using browser history for smoother transition
 */
const redirectToLogin = () => {
  clearAuthData();
  // Use custom event for smoother navigation (components can listen and use React Router)
  window.dispatchEvent(new CustomEvent('auth:logout', { detail: { reason: 'unauthorized' } }));
  // Fallback to direct redirect after short delay (for when no component is listening)
  setTimeout(() => {
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }, 100);
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
  (response) => {
    // Show success toast for successful POST, PUT, DELETE requests with success message
    const method = response.config.method?.toUpperCase();
    const isMutationRequest = method === 'POST' || method === 'PUT' || method === 'DELETE';
    
    if (isMutationRequest && response.data?.message) {
      dispatchToast('success', response.data.message);
    }
    
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };
    const isLoginRequest = originalRequest?.url?.includes('/auth/login');

    // If 401 and haven't tried to refresh yet, and it's NOT a login request
    if (error.response?.status === 401 && !originalRequest._retry && !isLoginRequest) {
      originalRequest._retry = true;

      try {
        const refreshToken = getRefreshToken();
        if (refreshToken) {
          // Try to refresh the token with timeout
          const response = await Promise.race([
            axios.post(`${API_BASE_URL}/auth/refresh`, {
              refreshToken,
            }),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Token refresh timeout')), 3000)
            )
          ]) as { data?: { status?: boolean; data?: { tokens?: { accessToken: string; refreshToken: string } } } };

          if (response.data?.status && response.data?.data?.tokens) {
            const { accessToken, refreshToken: newRefreshToken } = response.data.data.tokens;
            localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
            localStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken);

            // Retry the original request
            originalRequest.headers = originalRequest.headers || {};
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

    // For other errors on non-login requests, check if it's an auth error
    if (error.response?.status === 401 && !isLoginRequest) {
      redirectToLogin();
    }

    // Handle network errors (no response)
    if (!error.response) {
      dispatchToast('error', 'Network error. Please check your connection.');
      return Promise.reject({ 
        status: false, 
        error: 'Network Error', 
        message: error.message || 'Unable to connect to server' 
      });
    }

    // Return the error data with standardized format
    const errorData = error.response?.data as { error?: string; message?: string; success?: boolean } | undefined;
    const statusCode = error.response?.status;
    
    // Handle different backend response formats
    // Backend can return: { success: false, message: "..." } or { error: "...", message: "..." }
    let errorMessage = 'An error occurred';
    let errorField = 'Error';
    
    // Handle 404 specifically with cleaner message
    if (statusCode === 404) {
      errorMessage = 'Service not found. Please check your connection.';
      errorField = 'Not Found';
    } else if (errorData) {
      // Check for 'message' field first (used by backend like { success: false, message: "..." })
      if ('message' in errorData && errorData.message) {
        // Filter out raw 404 codes from message
        errorMessage = errorData.message.replace(/\[\d+\]\s*/, '').trim();
        errorField = errorMessage;
      }
      // Check for 'error' field as fallback
      if ('error' in errorData && errorData.error) {
        errorMessage = errorData.error.replace(/\[\d+\]\s*/, '').trim();
        errorField = errorMessage;
      }
    } else if (error.message) {
      // Fallback to axios error message only if no backend message available
      errorMessage = error.message;
      errorField = error.message;
    }

    // Show error toast for API errors (skip for 401 as it redirects to login)
    if (statusCode && statusCode >= 400 && statusCode !== 401) {
      dispatchToast('error', errorMessage);
    }
    
    return Promise.reject({
      status: false,
      error: errorField,
      message: errorMessage,
    });
  }
);

// Status codes that should NOT be retried (client errors and server errors that won't change on retry)
// 401 (Unauthorized) is NOT retried to prevent automatic retry on failed login attempts
const NON_RETRYABLE_STATUS_CODES = [400, 401, 403, 404, 409, 500, 505];

/**
 * Centralized API request function with retry capability
 * @param endpoint - API endpoint (e.g., '/auth/login')
 * @param method - HTTP method (GET, POST, PUT, DELETE, PATCH)
 * @param data - Request body data
 * @param customHeaders - Additional headers if needed
 * @param retryCount - Current retry attempt (internal use)
 * @returns API response
 */
export const apiRequest = async (
  endpoint: string, 
  method: string = 'GET', 
  data: any = null, 
  customHeaders: Record<string, string> = {},
  retryCount: number = 0
): Promise<any> => {
  const maxRetries = 5;
  
  const config: AxiosRequestConfig = {
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
  } catch (error: any) {

        // If error is already an object with message/error properties (from interceptor)
    if (error && typeof error === 'object' && (error.message || error.error) && 'status' in error) {
      throw {
        status: false,
        error: error.error || error.message,
        message: error.message || error.error || 'An error occurred',
      };
    }

    // Get the status code from the response
    const statusCode = error.response?.status;
    const isLoginEndpoint = endpoint.includes('/auth/login');
    
    // Check if this is a network error (no response) or a retriable status code
    const isNetworkError = !error.response;
    // Don't retry login requests - they should fail immediately on wrong credentials
    const isLoginRequest = isLoginEndpoint;
    const isRetriableStatus = statusCode && !NON_RETRYABLE_STATUS_CODES.includes(statusCode);
    const shouldRetry = !isLoginRequest && (isNetworkError || isRetriableStatus) && retryCount < maxRetries;
    
    if (shouldRetry) {
      // Wait before retrying (exponential backoff: 1s, 2s, 3s, 4s, 5s)
      const delay = (retryCount + 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Retry the request
      return apiRequest(endpoint, method, data, customHeaders, retryCount + 1);
    }
    
    // Re-throw with standardized error format
    // The interceptor throws error.response?.data which is already the parsed error object
    if (error?.status === false) {
      throw error; // Already formatted error from interceptor
    }

    // Fallback for unknown error formats
    throw {
      status: false,
      error: error.message || 'Unknown error',
      message: error.message || 'An error occurred',
    };
  }
};

// Convenience methods
export const get = (endpoint: string, customHeaders: Record<string, string> = {}) => 
  apiRequest(endpoint, 'GET', undefined, customHeaders);

export const post = (endpoint: string, data: any, customHeaders: Record<string, string> = {}) => 
  apiRequest(endpoint, 'POST', data, customHeaders);

export const put = (endpoint: string, data: any, customHeaders: Record<string, string> = {}) => 
  apiRequest(endpoint, 'PUT', data, customHeaders);

export const patch = (endpoint: string, data: any, customHeaders: Record<string, string> = {}) => 
  apiRequest(endpoint, 'PATCH', data, customHeaders);

export const del = (endpoint: string, customHeaders: Record<string, string> = {}) => 
  apiRequest(endpoint, 'DELETE', undefined, customHeaders);

export default apiClient;
