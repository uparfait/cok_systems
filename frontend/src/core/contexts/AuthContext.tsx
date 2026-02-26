// AuthContext - Global authentication state management
// Provides user authentication state, permissions, and methods

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { 
  login as authLogin, 
  logout as authLogout, 
  getCurrentUser, 
  isUserAuthenticated,
  verifyLoginOTP,
  resendLoginOTP,
  requestPasswordReset,
  verifyPasswordResetOTP,
  resetPassword,
  resendPasswordResetOTP,
  checkEmailForFirstLogin,
  sendFirstLoginOTP,
  verifyFirstLoginOTP,
  activateAccount,
  resendFirstLoginOTP,
  getToken
} from '../services/authService';

// User interface
export interface User {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  permissions: Permission[];
  departmentId?: string;
  departmentName?: string;
  picture?: string;
}

export interface Permission {
  resource: string;
  actions: string[];
}

// Auth context type
interface AuthContextType {
  // State
  user: User | null;
  permissions: Permission[];
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  
  // Login methods
  login: (email: string, password: string) => Promise<any>;
  verifyOTP: (userId: string, otp: string) => Promise<any>;
  resendOTP: (userId: string, email: string) => Promise<any>;
  
  // First time login methods
  checkEmailForFirstLogin: (email: string) => Promise<any>;
  sendFirstLoginOTP: (email: string) => Promise<any>;
  verifyFirstLoginOTP: (email: string, otp: string) => Promise<any>;
  activateAccount: (userId: string, otp: string, newPassword: string, confirmPassword: string) => Promise<any>;
  resendFirstLoginOTP: (email: string) => Promise<any>;
  
  // Password reset methods
  requestPasswordReset: (email: string) => Promise<any>;
  verifyPasswordResetOTP: (userId: string, otp: string) => Promise<any>;
  resetPassword: (userId: string, tempToken: string, newPassword: string) => Promise<any>;
  resendPasswordResetOTP: (userId: string, email: string) => Promise<any>;
  
  // Logout
  logout: () => Promise<void>;
  
  // Utility methods
  checkAuth: () => void;
  hasPermission: (resource: string, action: string) => boolean;
  hasAnyPermission: (permissions: { resource: string; action: string }[]) => boolean;
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth Provider component
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  // Check authentication on mount
  const checkAuth = useCallback(() => {
    const authenticated = isUserAuthenticated();
    const currentUser = getCurrentUser();
    const currentToken = getToken();
    
    console.log('[AuthContext checkAuth] isUserAuthenticated():', authenticated);
    console.log('[AuthContext checkAuth] getCurrentUser():', currentUser ? 'present' : 'null');
    console.log('[AuthContext checkAuth] getToken():', currentToken ? 'present' : 'null');
    
    setToken(currentToken);
    
    if (currentUser) {
      console.log('[AuthContext checkAuth] Setting user from token:', currentUser.email);
      setUser(currentUser);
      setPermissions(currentUser.permissions || []);
    } else {
      // Check if user data exists in localStorage from OTP verification
      const storedUserData = localStorage.getItem('userData');
      const isAuth = localStorage.getItem('isAuthenticated');
      
      console.log('[AuthContext checkAuth] storedUserData:', !!storedUserData, 'isAuthenticated flag:', isAuth);
      
      if (storedUserData && isAuth === 'true') {
        try {
          const parsedUser = JSON.parse(storedUserData);
          console.log('[AuthContext checkAuth] Setting user from localStorage:', parsedUser.email);
          setUser(parsedUser);
          setPermissions(parsedUser.permissions || []);
        } catch (e) {
          console.log('[AuthContext checkAuth] Failed to parse stored user data');
          setUser(null);
          setPermissions([]);
        }
      } else {
        console.log('[AuthContext checkAuth] No user found, setting null');
        setUser(null);
        setPermissions([]);
      }
    }
    
    setIsLoading(false);
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Check if user has a specific permission
  const hasPermission = useCallback((resource: string, action: string): boolean => {
    if (!permissions || permissions.length === 0) return false;
    
    return permissions.some(perm => 
      perm.resource.toLowerCase() === resource.toLowerCase() &&
      perm.actions.some(a => a.toUpperCase() === action.toUpperCase())
    );
  }, [permissions]);

  // Check if user has any of the specified permissions
  const hasAnyPermission = useCallback((requiredPermissions: { resource: string; action: string }[]): boolean => {
    if (!requiredPermissions || requiredPermissions.length === 0) return true;
    
    return requiredPermissions.some(({ resource, action }) => hasPermission(resource, action));
  }, [hasPermission]);

  // Check if user has a specific role
  const hasRole = useCallback((role: string): boolean => {
    return user?.role?.toLowerCase() === role.toLowerCase();
  }, [user]);

  // Check if user has any of the specified roles
  const hasAnyRole = useCallback((roles: string[]): boolean => {
    return roles.some(role => hasRole(role));
  }, [hasRole]);

  // Login method
  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const result = await authLogin(email, password);
      setIsLoading(false);
      return result;
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  };

  // Verify OTP method
  const verifyOTP = async (userId: string, otp: string) => {
    console.log('[AuthContext] verifyOTP called with userId:', userId, 'otp:', otp ? `${otp.length} digits` : 'EMPTY');
    
    if (!userId || !otp) {
      console.error('[AuthContext] verifyOTP: Missing userId or otp!', { userId, otp });
      throw {
        status: false,
        error: 'User ID and OTP are required',
        message: 'Missing required parameters'
      };
    }
    
    setIsLoading(true);
    try {
      console.log('[AuthContext] Calling verifyLoginOTP...');
      const result = await verifyLoginOTP(userId, otp);
      console.log('[AuthContext] verifyLoginOTP returned - status:', result?.status, 'data:', result?.data);
      
      // Call checkAuth when OTP is verified - either with tokens or verified flag
      if (result.status === true) {
        console.log('[AuthContext] OTP verification successful, calling checkAuth...');
        await checkAuth();
        console.log('[AuthContext] checkAuth completed');
      } else {
        console.log('[AuthContext] OTP verification FAILED - result:', result);
      }
      
      setIsLoading(false);
      return result;
    } catch (error) {
      console.error('[AuthContext] verifyLoginOTP error:', error);
      setIsLoading(false);
      throw error;
    }
  };

  // Resend OTP method
  const resendOTP = async (userId: string, email: string) => {
    try {
      const result = await resendLoginOTP(userId, email);
      return result;
    } catch (error) {
      throw error;
    }
  };

  // First time login methods
  const checkEmailFirstLogin = async (email: string) => {
    try {
      return await checkEmailForFirstLogin(email);
    } catch (error) {
      throw error;
    }
  };

  const sendFirstLogin = async (email: string) => {
    try {
      return await sendFirstLoginOTP(email);
    } catch (error) {
      throw error;
    }
  };

  const verifyFirstLogin = async (email: string, otp: string) => {
    try {
      return await verifyFirstLoginOTP(email, otp);
    } catch (error) {
      throw error;
    }
  };

  const activateAcc = async (userId: string, otp: string, newPassword: string, confirmPassword: string) => {
    setIsLoading(true);
    try {
      const result = await activateAccount(userId, otp, newPassword, confirmPassword);
      if (result.status && result.data?.tokens) {
        checkAuth();
      }
      setIsLoading(false);
      return result;
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  };

  const resendFirstLoginOTPFunc = async (email: string) => {
    try {
      return await resendFirstLoginOTP(email);
    } catch (error) {
      throw error;
    }
  };

  // Password reset methods
  const requestReset = async (email: string) => {
    try {
      return await requestPasswordReset(email);
    } catch (error) {
      throw error;
    }
  };

  const verifyResetOTP = async (userId: string, otp: string) => {
    try {
      return await verifyPasswordResetOTP(userId, otp);
    } catch (error) {
      throw error;
    }
  };

  const resetUserPassword = async (userId: string, tempToken: string, newPassword: string) => {
    try {
      return await resetPassword(userId, tempToken, newPassword, newPassword);
    } catch (error) {
      throw error;
    }
  };

  const resendResetOTP = async (userId: string, email: string) => {
    try {
      return await resendPasswordResetOTP(userId, email);
    } catch (error) {
      throw error;
    }
  };

  // Logout method
  const logout = async () => {
    try {
      await authLogout();
    } finally {
      setUser(null);
      setPermissions([]);
      setToken(null);
    }
  };

  // Provide context value
  const value: AuthContextType = {
    // State
    user,
    permissions,
    isAuthenticated: !!user,
    isLoading,
    token,
    
    // Login methods
    login,
    verifyOTP,
    resendOTP,
    
    // First time login methods
    checkEmailForFirstLogin: checkEmailFirstLogin,
    sendFirstLoginOTP: sendFirstLogin,
    verifyFirstLoginOTP: verifyFirstLogin,
    activateAccount: activateAcc,
    resendFirstLoginOTP: resendFirstLoginOTPFunc,
    
    // Password reset methods
    requestPasswordReset: requestReset,
    verifyPasswordResetOTP: verifyResetOTP,
    resetPassword: resetUserPassword,
    resendPasswordResetOTP: resendResetOTP,
    
    // Logout
    logout,
    
    // Utility methods
    checkAuth,
    hasPermission,
    hasAnyPermission,
    hasRole,
    hasAnyRole
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
