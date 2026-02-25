// Auth Service - Complete authentication API integration
// Handles login, logout, password reset, OTP verification, and token management

import { get, post, setAuthData, clearAuthData, getStoredUser, getAccessToken, isAuthenticated } from './apiClient';

// ==================== LOGIN APIs ====================

export const login = (email, password) => post('/auth/login', { email, password });

export const verifyLoginOTP = async (userId, otpToken) => {
  if (!userId || !otpToken) {
    throw { status: false, error: 'User ID and OTP token are required', message: 'Missing required parameters for OTP verification' };
  }
  const otpValue = String(otpToken);
  const response = await post('/auth/login/verify', { userId: String(userId), otpToken: otpValue, otp: otpValue });
  if (response.status && response.data?.tokens) {
    setAuthData({ accessToken: response.data.tokens.bearerToken || response.data.tokens.accessToken, refreshToken: response.data.tokens.refreshToken }, response.data.user);
  }
  return response;
};

export const resendLoginOTP = (userId, email) => post('/auth/login/resend', { userId, email });

// ==================== LOGOUT APIs ====================

export const logout = async () => {
  try { await post('/auth/logout', {}); } 
  catch (error) { console.warn('Logout API failed, clearing local data:', error); } 
  finally { clearAuthData(); }
};

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

export const requestPasswordReset = (email) => post('/auth/password-reset', { email });

export const verifyPasswordResetOTP = (userId, otp) => post('/auth/password-reset/verify', { userId, otp });

export const resetPassword = (userId, tempToken, newPassword, confirmPassword) => 
  post('/auth/password-reset/reset', { userId, tempToken, newPassword, confirmPassword });

export const resendPasswordResetOTP = (userId, email) => post('/auth/password-reset/resend', { userId, email });

// ==================== FIRST TIME LOGIN APIs ====================

export const checkEmailForFirstLogin = (email) => post('/auth/first-login/check', { email });

export const sendFirstLoginOTP = (email) => post('/auth/first-login/send-otp', { email });

export const verifyFirstLoginOTP = (email, otp) => post('/auth/first-login/activate', { email, otp });

export const activateAccount = (userId, otp, newPassword, confirmPassword) => 
  post('/auth/first-login/activate', { userId, otp, newPassword, confirmPassword });

export const resendFirstLoginOTP = (email) => post('/auth/first-login/resend', { email });

// ==================== ACCOUNT LOCK/UNLOCK APIs ====================

export const lockAccount = (userId, reason) => post('/auth/lock-unlock/lock', { userId, reason });

export const unlockAccount = (userId) => post('/auth/lock-unlock/unlock', { userId });

// ==================== USER DATA APIs ====================

export const getCurrentUser = getStoredUser;

export const isUserAuthenticated = isAuthenticated;

export const getToken = getAccessToken;

// ==================== REFRESH TOKEN API ====================

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
