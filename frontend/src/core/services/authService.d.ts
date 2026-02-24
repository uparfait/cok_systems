// Type declarations for authService.js

declare module './authService' {
  interface LoginResult {
    status: boolean;
    data?: {
      requiresOTP?: boolean;
      userId?: string;
      tokens?: {
        accessToken: string;
        refreshToken: string;
      };
      user?: any;
    };
    error?: string;
  }

  interface VerifyOTPResult {
    status: boolean;
    data?: {
      tempToken?: string;
      tokens?: {
        accessToken: string;
        refreshToken: string;
      };
      user?: any;
    };
    error?: string;
  }

  interface PasswordResetResult {
    status: boolean;
    error?: string;
  }

  export const login: (email: string, password: string) => Promise<LoginResult>;
  export const verifyLoginOTP: (userId: string, otp: string) => Promise<VerifyOTPResult>;
  export const resendLoginOTP: (userId: string, email: string) => Promise<PasswordResetResult>;
  export const requestPasswordReset: (email: string) => Promise<PasswordResetResult>;
  export const verifyPasswordResetOTP: (userId: string, otp: string) => Promise<VerifyOTPResult>;
  export const resetPassword: (userId: string, tempToken: string, newPassword: string) => Promise<PasswordResetResult>;
  export const resendPasswordResetOTP: (userId: string, email: string) => Promise<PasswordResetResult>;
  export const logout: () => Promise<any>;
  export const getCurrentUser: () => any;
  export const isAuthenticated: () => boolean;
}
