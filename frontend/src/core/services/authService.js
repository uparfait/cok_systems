// Auth Service - Complete authentication API integration
// Handles login, logout, password reset, OTP verification, and token management

import { get, post, setAuthData, clearAuthData, getStoredUser, getAccessToken, isAuthenticated } from './apiClient';

// ==================== LOGIN APIs ====================

/**
 * Login with email and password
 * Backend: POST /auth/login
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise} - Login response
 */
export const login = async (email, password) => {
  try {
    const response = await post('/auth/login', { email, password });
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Verify OTP for login (2FA)
 * Backend: POST /auth/login/verify
 * @param {string} userId - User ID
 * @param {string} otp - OTP code
 * @returns {Promise} - Verification response with tokens
 */
export const verifyLoginOTP = async (userId, otp) => {
  try {
    const response = await post('/auth/login/verify', { userId, otp });
    
    // Store tokens and user data on successful login
    if (response.status && response.data?.tokens) {
      setAuthData(response.data.tokens, response.data.user);
    }
    
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Resend login OTP
 * Backend: POST /auth/login/resend
 * @param {string} userId - User ID
 * @param {string} email - User email
 * @returns {Promise} - Resend response
 */
export const resendLoginOTP = async (userId, email) => {
  try {
    const response = await post('/auth/login/resend', { userId, email });
    return response;
  } catch (error) {
    throw error;
  }
};

// ==================== LOGOUT APIs ====================

/**
 * Logout from current session
 * Backend: POST /auth/logout
 * @returns {Promise} - Logout response
 */
export const logout = async () => {
  try {
    await post('/auth/logout', {});
  } catch (error) {
    // Still clear local storage even if API fails
    console.warn('Logout API failed, clearing local data:', error);
  } finally {
    clearAuthData();
  }
};

/**
 * Logout from all sessions
 * Backend: POST /auth/logout/all
 * @returns {Promise} - Logout response
 */
export const logoutAll = async () => {
  try {
    const response = await post('/auth/logout/all', {});
    clearAuthData();
    return response;
  } catch (error) {
    clearAuthData();
    throw error;
  }
};

// ==================== PASSWORD RESET APIs ====================

/**
 * Request password reset
 * Backend: POST /auth/password-reset
 * @param {string} email - User email
 * @returns {Promise} - Password reset request response
 */
export const requestPasswordReset = async (email) => {
  try {
    const response = await post('/auth/password-reset', { email });
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Verify OTP for password reset
 * Backend: POST /auth/password-reset/verify
 * @param {string} userId - User ID
 * @param {string} otp - OTP code
 * @returns {Promise} - Verification response
 */
export const verifyPasswordResetOTP = async (userId, otp) => {
  try {
    const response = await post('/auth/password-reset/verify', { userId, otp });
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Reset password with temp token
 * Backend: POST /auth/password-reset/reset
 * @param {string} userId - User ID
 * @param {string} tempToken - Temporary token from OTP verification
 * @param {string} newPassword - New password
 * @returns {Promise} - Password reset response
 */
export const resetPassword = async (userId, tempToken, newPassword) => {
  try {
    const response = await post('/auth/password-reset/reset', {
      userId,
      tempToken,
      newPassword
    });
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Resend password reset OTP
 * Backend: POST /auth/password-reset/resend
 * @param {string} userId - User ID
 * @param {string} email - User email
 * @returns {Promise} - Resend response
 */
export const resendPasswordResetOTP = async (userId, email) => {
  try {
    const response = await post('/auth/password-reset/resend', { userId, email });
    return response;
  } catch (error) {
    throw error;
  }
};

// ==================== FIRST TIME LOGIN APIs ====================

/**
 * Check if email exists for first-time login
 * Backend: POST /auth/first-login/check
 * @param {string} email - User email
 * @returns {Promise} - Check response
 */
export const checkEmailForFirstLogin = async (email) => {
  try {
    const response = await post('/auth/first-login/check', { email });
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Send OTP for first-time login activation
 * Backend: POST /auth/first-login/send-otp
 * @param {string} email - User email
 * @returns {Promise} - Send OTP response
 */
export const sendFirstLoginOTP = async (email) => {
  try {
    const response = await post('/auth/first-login/send-otp', { email });
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Verify OTP for first-time login and activate account
 * Backend: POST /auth/first-login/activate
 * @param {string} email - User email
 * @param {string} otp - OTP code
 * @returns {Promise} - Activation response
 */
export const verifyFirstLoginOTP = async (email, otp) => {
  try {
    const response = await post('/auth/first-login/activate', { email, otp });
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Activate account with password setup
 * Backend: POST /auth/first-login/activate
 * @param {string} userId - User ID
 * @param {string} otp - OTP code
 * @param {string} newPassword - New password
 * @param {string} confirmPassword - Confirm password
 * @returns {Promise} - Activation response (no tokens returned)
 */
export const activateAccount = async (userId, otp, newPassword, confirmPassword) => {
  try {
    const response = await post('/auth/first-login/activate', {
      userId,
      otp,
      newPassword,
      confirmPassword
    });
    
    // Note: Backend does NOT return tokens on activation
    // User needs to login with their new password after activation
    
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Resend OTP for first-time login
 * Backend: POST /auth/first-login/resend
 * @param {string} email - User email
 * @returns {Promise} - Resend response
 */
export const resendFirstLoginOTP = async (email) => {
  try {
    const response = await post('/auth/first-login/resend', { email });
    return response;
  } catch (error) {
    throw error;
  }
};

// ==================== ACCOUNT LOCK/UNLOCK APIs ====================

/**
 * Lock a user account
 * Backend: POST /auth/lock-unlock/lock
 * @param {string} userId - User ID to lock
 * @param {string} reason - Reason for locking
 * @returns {Promise} - Lock response
 */
export const lockAccount = async (userId, reason) => {
  try {
    const response = await post('/auth/lock-unlock/lock', { userId, reason });
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Unlock a user account
 * Backend: POST /auth/lock-unlock/unlock
 * @param {string} userId - User ID to unlock
 * @returns {Promise} - Unlock response
 */
export const unlockAccount = async (userId) => {
  try {
    const response = await post('/auth/lock-unlock/unlock', { userId });
    return response;
  } catch (error) {
    throw error;
  }
};

// ==================== USER DATA APIs ====================

/**
 * Get current user from localStorage
 * @returns {object|null} - User data
 */
export const getCurrentUser = () => {
  return getStoredUser();
};

/**
 * Check if user is authenticated
 * @returns {boolean} - Authentication status
 */
export const isUserAuthenticated = () => {
  return isAuthenticated();
};

/**
 * Get access token
 * @returns {string|null} - Access token
 */
export const getToken = () => {
  return getAccessToken();
};

// ==================== REFRESH TOKEN API ====================

/**
 * Refresh access token
 * @returns {Promise} - Refresh response with new tokens
 */
export const refreshToken = async () => {
  try {
    const response = await post('/auth/refresh', {});
    if (response.status && response.data?.tokens) {
      setAuthData(response.data.tokens, response.data.user);
    }
    return response;
  } catch (error) {
    clearAuthData();
    throw error;
  }
};
