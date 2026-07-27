import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import {
  login as authLogin,
  logout as authLogout,
  getCurrentUser,
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
  getToken,
  validateToken,
  toggle2FA,
  setup2FA,
  verify2FASetup,
  reset2FA
} from '../services/authService';

// User interface
export interface User {
  userId?: string;
  email?: string;
  fullName?: string;
  role?: string;
  permissions?: Permission[];
  departmentId?: string;
  department_id?: string;
  departmentName?: string;
  department_name?: string;
  picture?: string;
}

export interface Permission {
  resource?: string;
  resource_name?: string;
  actions: (string | { action_type: string; description?: string; is_enabled?: string; _id?: string })[];
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
  verifyFirstLoginOTP: (userId: string, otp: string) => Promise<any>;
  activateAccount: (userId: string, signature: string, newPassword: string, confirmPassword: string) => Promise<any>;
  resendFirstLoginOTP: (email: string, userId?: string) => Promise<any>;
  
  // Password reset methods
  requestPasswordReset: (email: string) => Promise<any>;
  verifyPasswordResetOTP: (userId: string, otp: string) => Promise<any>;
  resetPassword: (userId: string, signature: string, newPassword: string) => Promise<any>;
  resendPasswordResetOTP: (userId: string, email: string) => Promise<any>;
  
  // 2FA methods
  toggle2FA: (userId: string, disable: boolean) => Promise<any>;
  setup2FA: (userId: string) => Promise<any>;
  verify2FASetup: (userId: string, otp: string) => Promise<any>;
  reset2FA: (userId: string) => Promise<any>;
  
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

  const checkAuth = useCallback(async () => {
    console.log('[AuthContext checkAuth] Starting authentication check...');

    try {
      const storedUserData = localStorage.getItem('userData');
      const storedAccessToken = localStorage.getItem('accessToken');

      console.log('[AuthContext checkAuth] storedUserData:', !!storedUserData, 'accessToken:', !!storedAccessToken);

      if (storedUserData && storedAccessToken) {
        try {
          const parsedUser = JSON.parse(storedUserData);
          console.log('[AuthContext checkAuth] Found stored user data for:', parsedUser.email);

          console.log('[AuthContext checkAuth] Validating token with backend...');
          const validationResult = await validateToken();

          if (validationResult.isValid) {
            console.log('[AuthContext checkAuth] Token is valid, setting authenticated user');
            setUser(parsedUser);
            setPermissions(parsedUser.permissions || []);
            setToken(storedAccessToken);
          } else {
            console.log('[AuthContext checkAuth] Token is invalid, clearing stored data');
            localStorage.removeItem('userData');
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            setUser(null);
            setPermissions([]);
            setToken(null);
          }
        } catch (parseError) {
          console.log('[AuthContext checkAuth] Failed to parse stored user data:', parseError);
          localStorage.removeItem('userData');
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          setUser(null);
          setPermissions([]);
          setToken(null);
        }
      } else {
        console.log('[AuthContext checkAuth] No stored authentication data found');
        setUser(null);
        setPermissions([]);
        setToken(null);
      }
    } catch (error) {
      console.error('[AuthContext checkAuth] Error during authentication check:', error);
      localStorage.removeItem('userData');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setUser(null);
      setPermissions([]);
      setToken(null);
    }

    console.log('[AuthContext checkAuth] Authentication check complete');
    setIsLoading(false);
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const hasPermission = useCallback((resource: string, action: string): boolean => {
    if (!permissions || permissions.length === 0) return false;
    
    return permissions.some(perm => {
      const res = perm.resource || perm.resource_name;
      if (!res) return false;
      
      return res.toLowerCase() === resource.toLowerCase() &&
        perm.actions.some(a => {
          const actionStr = typeof a === 'string' ? a : a.action_type;
          return actionStr?.toUpperCase() === action.toUpperCase();
        });
    });
  }, [permissions]);

  const hasAnyPermission = useCallback((requiredPermissions: { resource: string; action: string }[]): boolean => {
    if (!requiredPermissions || requiredPermissions.length === 0) return true;
    
    return requiredPermissions.some(({ resource, action }) => hasPermission(resource, action));
  }, [hasPermission]);

  const hasRole = useCallback((role: string): boolean => {
    return user?.role?.toLowerCase() === role.toLowerCase();
  }, [user]);

  const hasAnyRole = useCallback((roles: string[]): boolean => {
    return roles.some(role => hasRole(role));
  }, [hasRole]);

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
      const result: any = await verifyLoginOTP(userId, otp);
      console.log('[AuthContext] verifyLoginOTP returned - status:', result?.status, 'success:', result?.success, 'data:', result?.data);
      
      const isSuccess = result?.status === true || result?.success === true;
      
      if (isSuccess) {
        console.log('[AuthContext] OTP verification successful, calling checkAuth...');
        checkAuth();
        console.log('[AuthContext] checkAuth completed');
      } else {
        console.log('[AuthContext] OTP verification FAILED - result:', result);
      }
      
      setIsLoading(false);
      return result;
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  };

  const resendOTP = async (userId: string, email: string) => {
    try {
      const result = await resendLoginOTP(userId, email);
      return result;
    } catch (error) {
      throw error;
    }
  };

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

  const verifyFirstLogin = async (userId: string, otp: string) => {
    try {
      return await verifyFirstLoginOTP(userId, otp);
    } catch (error) {
      throw error;
    }
  };

  const activateAcc = async (userId: string, signature: string, newPassword: string, confirmPassword: string) => {
    setIsLoading(true);
    try {
      const result = await activateAccount(userId, signature, newPassword, confirmPassword);
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

  const resendFirstLoginOTPFunc = async (email: string, userId?: string) => {
    try {
      return await resendFirstLoginOTP(email, userId);
    } catch (error) {
      throw error;
    }
  };

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

  const resetUserPassword = async (userId: string, signature: string, newPassword: string) => {
    try {
      return await resetPassword(userId, signature, newPassword, newPassword);
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

  const toggleUser2FA = async (userId: string, disable: boolean) => {
    try {
      return await toggle2FA(userId, disable);
    } catch (error) {
      throw error;
    }
  };

  const setupUser2FA = async (userId: string) => {
    try {
      return await setup2FA(userId);
    } catch (error) {
      throw error;
    }
  };

  const verifyUser2FASetup = async (userId: string, otp: string) => {
    try {
      return await verify2FASetup(userId, otp);
    } catch (error) {
      throw error;
    }
  };

  const resetUser2FA = async (userId: string) => {
    try {
      return await reset2FA(userId);
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authLogout();
    } finally {
      setUser(null);
      setPermissions([]);
      setToken(null);
      setIsLoading(false);
      window.dispatchEvent(new CustomEvent('auth:logout', { detail: { reason: 'manual_logout' } }));
      setTimeout(() => {
          window.location.href = '/';
      }, 100);
    }
  };

  const value: AuthContextType = {
    user,
    permissions,
    isAuthenticated: !!user,
    isLoading,
    token,
    
    login,
    verifyOTP,
    resendOTP,
    
    checkEmailForFirstLogin: checkEmailFirstLogin,
    sendFirstLoginOTP: sendFirstLogin,
    verifyFirstLoginOTP: verifyFirstLogin,
    activateAccount: activateAcc,
    resendFirstLoginOTP: resendFirstLoginOTPFunc,
    
    requestPasswordReset: requestReset,
    verifyPasswordResetOTP: verifyResetOTP,
    resetPassword: resetUserPassword,
    resendPasswordResetOTP: resendResetOTP,
    
    toggle2FA: toggleUser2FA,
    setup2FA: setupUser2FA,
    verify2FASetup: verifyUser2FASetup,
    reset2FA: resetUser2FA,
    
    logout,
    
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

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
