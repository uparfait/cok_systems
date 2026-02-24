// authService - Authentication API service
// Handles login, logout, registration, password reset, and token refresh

import apiClient from './apiClient';

// Login with credentials
export const login = async (email, password) => {
  try {
    const response = await apiClient.post('/auth/login', { email, password });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Verify OTP for login
export const verifyLoginOTP = async (userId, otp) => {
  try {
    const response = await apiClient.post('/auth/login/verify', { userId, otp });
    if (response.data.status && response.data.data?.tokens) {
      // Store tokens
      localStorage.setItem('accessToken', response.data.data.tokens.accessToken);
      localStorage.setItem('refreshToken', response.data.data.tokens.refreshToken);
      localStorage.setItem('user', JSON.stringify(response.data.data.user));
    }
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Resend login OTP
export const resendLoginOTP = async (userId, email) => {
  try {
    const response = await apiClient.post('/auth/login/resend', { userId, email });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Request password reset
export const requestPasswordReset = async (email) => {
  try {
    const response = await apiClient.post('/auth/password-reset', { email });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Verify OTP for password reset
export const verifyPasswordResetOTP = async (userId, otp) => {
  try {
    const response = await apiClient.post('/auth/password-reset/verify', { userId, otp });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Reset password with temp token
export const resetPassword = async (userId, tempToken, newPassword) => {
  try {
    const response = await apiClient.post('/auth/password-reset/reset', {
      userId,
      tempToken,
      newPassword
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Resend password reset OTP
export const resendPasswordResetOTP = async (userId, email) => {
  try {
    const response = await apiClient.post('/auth/password-reset/resend', { userId, email });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Logout
export const logout = async () => {
  try {
    const response = await apiClient.post('/auth/logout');
    // Clear local storage
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    return response.data;
  } catch (error) {
    // Still clear local storage on error
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    throw error;
  }
};

// Get current user from localStorage
export const getCurrentUser = () => {
  const userStr = localStorage.getItem('user');
  if (userStr) {
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }
  return null;
};

// Check if user is authenticated
export const isAuthenticated = () => {
  return !!localStorage.getItem('accessToken');
};
