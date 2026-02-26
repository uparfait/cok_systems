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
    // Support both 'status' and 'success' response formats
    const isSuccess = response.status === true || response.success === true;
    
    if (isSuccess) {
      // Store tokens directly in localStorage
      const { accessToken, refreshToken, verified, userId: uid, email, fullName, role, ...userInfo } = response.data || {};
      
      if (accessToken) {
        console.log('[authService] Storing accessToken and refreshToken directly');
        localStorage.setItem('accessToken', accessToken);
        
        if (refreshToken) {
          localStorage.setItem('refreshToken', refreshToken);
        }
        
        // Store user info
        const userData = {
          userId: uid,
          email,
          fullName,
          role,
          permissions: response.data?.permissions || [],
          ...userInfo
        };
        localStorage.setItem('userData', JSON.stringify(userData));
        
        console.log('[authService] Tokens stored successfully');
      }
      
      return response;
    }
    
    console.log('[authService] Response status is not true - status:', response.status, 'success:', response.success);
    return response;
  } catch (error) {
    console.error('[authService] Exception in verifyLoginOTP:', error);
    throw error;
  }
};

// Exchange session token for login tokens
export const exchangeSessionToken = async (sessionToken) => {
  console.log('[authService] exchangeSessionToken STARTED');
  
  if (!sessionToken) {
    console.error('[authService] Missing session token!');
    throw { status: false, error: 'Session token is required', message: 'Missing session token' };
  }
  
  try {
    const response = await post('/auth/login/exchange', { sessionToken });
    
    console.log('[authService] Exchange response received:', JSON.stringify(response, null, 2));
    
    // Handle successful response
    const isSuccess = response.status === true || response.success === true;
    
    if (isSuccess && response.data?.tokens) {
      // Store tokens
      const tokens = response.data.tokens;
      const user = response.data.user;
      
      const accessToken = tokens.bearerToken || tokens.accessToken || tokens.token;
      const refreshToken = tokens.refreshToken || tokens.refresh_token;
      
      console.log('[authService] accessToken:', accessToken ? 'present' : 'missing');
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
    }
    
    return response;
  } catch (error) {
    console.error('[authService] Exception in exchangeSessionToken:', error);
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
