 // Auth Service - Complete authentication API integration
// Handles login, logout, password reset, OTP verification, and token management

import { get, post, setAuthData, clearAuthData, getStoredUser, getAccessToken, isAuthenticated } from './apiClient';

// ==================== LOGIN APIs ====================

export const login = (email, password) => post('/auth/login', { email, password });

export const verifyLoginOTP = async (userId, otpToken) => {
  console.log('[authService] verifyLoginOTP STARTED');
  
  if (!userId || !otpToken) {
    console.error('[authService] Missing parameters!');
    throw { status: false, error: 'User ID and OTP token are required', message: 'Missing required parameters for OTP verification' };
  }
  
  const otpValue = String(otpToken);
  console.log('[authService] Calling API with userId:', userId);
  
  try {
    // Send both otp and otpToken to support different backend versions
    const response = await post('/auth/login/verify', { 
      userId: String(userId), 
      otp: otpValue,
      otpToken: otpValue
    });
    
    console.log('[authService] API response received:', JSON.stringify(response, null, 2));
    
    // Handle successful response
    if (response.status === true) {
      // Try to find tokens in various possible locations
      let tokens = null;
      let user = null;
      
      // Check response.data.tokens (most common)
      if (response.data?.tokens) {
        tokens = response.data.tokens;
        user = response.data.user;
        console.log('[authService] Found tokens in response.data.tokens');
      }
      // Check response.tokens (flat structure)
      else if (response.tokens) {
        tokens = response.tokens;
        user = response.user;
        console.log('[authService] Found tokens in response.tokens (flat)');
      }
      // Check response.data.data.tokens (double nested)
      else if (response.data?.data?.tokens) {
        tokens = response.data.data.tokens;
        user = response.data.data.user;
        console.log('[authService] Found tokens in response.data.data.tokens (double nested)');
      }
      else {
        console.log('[authService] WARNING: No tokens found in response!');
        console.log('[authService] response.data:', response.data);
        console.log('[authService] response.data?.tokens:', response.data?.tokens);
      }
      
      console.log('[authService] Found tokens:', !!tokens, 'Found user:', !!user);
      
      if (tokens) {
        // Extract tokens - handle different structures
        const accessToken = tokens.bearerToken || tokens.accessToken || tokens.token;
        const refreshToken = tokens.refreshToken || tokens.refresh_token;
        
        console.log('[authService] accessToken:', accessToken ? 'present' : 'missing', 'length:', accessToken?.length);
        console.log('[authService] refreshToken:', refreshToken ? 'present' : 'missing');
        
        if (accessToken) {
          setAuthData({ accessToken, refreshToken }, user);
          console.log('[authService] Auth data stored successfully');
          
          // Verify it was stored
          const storedToken = localStorage.getItem('accessToken');
          const storedUser = localStorage.getItem('userData');
          console.log('[authService] Verification - accessToken in localStorage:', storedToken ? 'YES' : 'NO');
          console.log('[authService] Verification - userData in localStorage:', storedUser ? 'YES' : 'NO');
        } else {
          console.log('[authService] ERROR: No accessToken found in tokens object!', tokens);
        }
      } else {
        // Backend didn't return tokens - store user data anyway for authenticated state
        console.log('[authService] No tokens in response, storing user data for session');
        
        // Store user data from response
        if (response.data?.user) {
          localStorage.setItem('userData', JSON.stringify(response.data.user));
          localStorage.setItem('isAuthenticated', 'true');
          console.log('[authService] Stored user data and authenticated flag');
        } else if (response.data?.userId) {
          // Handle case where only userId and email are returned
          const userData = {
            userId: response.data.userId,
            email: response.data.email,
            fullName: response.data.fullName || response.data.email
          };
          localStorage.setItem('userData', JSON.stringify(userData));
          localStorage.setItem('isAuthenticated', 'true');
          console.log('[authService] Stored basic user data and authenticated flag');
        }
      }
      
      return response;
    }
    
    console.log('[authService] Response status is not true:', response.status);
    return response;
  } catch (error) {
    console.error('[authService] Exception in verifyLoginOTP:', error);
    throw error;
  }
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
