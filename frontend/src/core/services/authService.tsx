 // Auth Service - Complete authentication API integration
 // Handles login, logout, password reset, OTP verification, and token management
 
 import { post, put, setAuthData, clearAuthData, getStoredUser, getAccessToken, isAuthenticated, get } from './apiClient';
 
 // ==================== USER PROFILE APIs ====================
 
 export const getUserProfile = (userId: string) => get(`/employee/crud/${userId}`);
 
 export const updateUserProfile = (userId: string, data: {
   full_name?: string;
   telephone?: string;
   picture?: string;
   gender?: string;
   title?: string;
 }) => put(`/employee/crud/${userId}`, data);
 
 export const changePassword = (data: {
   currentPassword: string;
   newPassword: string;
   confirmPassword: string;
 }) => post('/profile/change-password', data);
 
 // ==================== LOGIN APIs ====================
 
 export const login = (email: string, password: string) => post('/auth/login', { email, password });
 
 export const verifyLoginOTP = async (userId: string, otpToken: string) => {
   console.log('[authService] verifyLoginOTP STARTED');
   
   if (!userId || !otpToken) {
     console.error('[authService] Missing parameters!');
     throw { status: false, error: 'User ID and OTP token are required', message: 'Missing required parameters for OTP verification' };
   }
   
   const otpValue = String(otpToken);
   console.log('[authService] Calling API with userId:', userId);
   
   try {
     const response = await post('/auth/login/verify', { 
       userId: String(userId), 
       otp: otpValue,
       otpToken: otpValue
     });
     
     console.log('[authService] API response received:', JSON.stringify(response, null, 2));
     
     const isSuccess = response.status === true || response.success === true;
     
     if (isSuccess) {
       const { accessToken, refreshToken, verified, userId: uid, email, fullName, role, ...userInfo } = response.data || {};
       
       if (accessToken) {
         console.log('[authService] Storing accessToken and refreshToken directly');
         localStorage.setItem('accessToken', accessToken);
         
         if (refreshToken) {
           localStorage.setItem('refreshToken', refreshToken);
         }
         
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
     }
     
     return response;
   } catch (error) {
     console.error('[authService] Exception in verifyLoginOTP:', error);
     throw error;
   }
 };
 
 export const resendLoginOTP = (userId: string, email: string) => post('/auth/login/resend', { userId, email });
 
 // ==================== LOGOUT APIs ====================
 
 export const logout = async () => {
   try { 
    await post('/auth/logout', {});
  } 
   catch (error) { console.warn('Logout API failed, clearing local data:', error); } 
   finally { 
     clearAuthData();
     sessionStorage.clear();
   }
 };
 
 export const logoutAll = async () => {
   try {
     const response = await post('/auth/logout/all', {});
     clearAuthData();
     sessionStorage.clear();
     return response;
   } catch (error) {
     clearAuthData();
     sessionStorage.clear();
     throw error;
   }
 };
 
 // ==================== PASSWORD RESET APIs ====================
 
 export const requestPasswordReset = (email: string) => post('/auth/password-reset', { email });
 
 export const verifyPasswordResetOTP = (userId: string, otp: string) => post('/auth/password-reset/verify', { userId, otp });
 
 export const resetPassword = (userId: string, signature: string, newPassword: string, confirmPassword: string) => 
   post('/auth/password-reset/reset', { userId, signature, newPassword, confirmPassword });
 
 export const resendPasswordResetOTP = (userId: string, email: string) => post('/auth/password-reset/resend', { userId, email });
 
 // ==================== FIRST TIME LOGIN APIs ====================
 
 export const checkEmailForFirstLogin = (email: string) => post('/auth/first-login/check', { email });
 
 export const sendFirstLoginOTP = (email: string) => post('/auth/first-login/send-otp', { email });
 
 export const verifyFirstLoginOTP = (userId: string, otp: string) => post('/auth/first-login/verify-otp', { userId, otp });
 
 export const activateAccount = (userId: string, signature: string, newPassword: string, confirmPassword: string) => 
   post('/auth/first-login/activate', { userId, signature, newPassword, confirmPassword });
 
 export const resendFirstLoginOTP = (email: string, userId?: string) => post('/auth/first-login/resend', { email, userId });
 
 // ==================== 2FA APIs ====================
 
  export const toggle2FA = (userId: string, disable: boolean) => post('/auth/2fa/toggle', { userId, disable });
 
  export const setup2FA = (userId: string) => post('/auth/2fa/setup', { userId });
 
  export const verify2FASetup = (userId: string, otp: string) => post('/auth/2fa/verify-setup', { userId, otp });
 
  export const reset2FA = (userId: string) => post('/auth/2fa/reset', { userId });
 
 // ==================== ACCOUNT LOCK/UNLOCK APIs ====================
 
 export const lockAccount = (userId: string, reason: string) => post('/auth/lock-unlock/lock', { userId, reason });
 
 export const unlockAccount = (userId: string) => post('/auth/lock-unlock/unlock', { userId });
 
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
 
 // ==================== TOKEN VALIDATION API ====================
 
 export const validateToken = async (): Promise<{ isValid: boolean; user?: any }> => {
   try {
     const token = getAccessToken();
     if (!token) {
       console.log('[validateToken] No token found');
       return { isValid: false };
     }
 
     console.log('[validateToken] Validating token with backend...');
 
     const response = await get('/auth/validate-token');
 
     console.log('[validateToken] Backend response:', response);
 
     if (response.status || response.success) {
       const userData = response.data?.user || getStoredUser();
       console.log('[validateToken] Token is valid for user:', userData?.email);
       return {
         isValid: true,
         user: userData
       };
     }
 
     console.log('[validateToken] Token validation failed - invalid response');
     return { isValid: false };
   } catch (error: any) {
     console.log('[validateToken] Token validation error:', error.message);
 
     if (error.response?.status === 401) {
       console.log('[validateToken] Token unauthorized - clearing auth data');
       clearAuthData();
       return { isValid: false };
     }
 
     const userData = getStoredUser();
     const token = getAccessToken();
 
     if (userData && token) {
       console.log('[validateToken] Network/server error but stored data exists, assuming valid for offline mode');
       return { isValid: true, user: userData };
     }
 
     console.log('[validateToken] No valid stored data, token invalid');
     return { isValid: false };
   }
 };
 