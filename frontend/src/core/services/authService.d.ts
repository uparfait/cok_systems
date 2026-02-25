// Type declarations for authService.js

// Common response types
export interface ApiResponse {
  status: boolean;
  message?: string;
  error?: string;
  data?: any;
}

export interface LoginResult extends ApiResponse {
  data?: {
    requiresOTP?: boolean;
    userId?: string;
    tokens?: {
      accessToken: string;
      refreshToken: string;
    };
    user?: any;
  };
}

export interface VerifyOTPResult extends ApiResponse {
  data?: {
    tempToken?: string;
    tokens?: {
      accessToken: string;
      refreshToken: string;
    };
    user?: any;
  };
}

export interface PasswordResetResult extends ApiResponse {}

// Login APIs
export function login(email: string, password: string): Promise<LoginResult>;
export function verifyLoginOTP(userId: string, otpToken: string): Promise<VerifyOTPResult>;
export function resendLoginOTP(userId: string, email: string): Promise<ApiResponse>;

// Logout APIs
export function logout(): Promise<void>;
export function logoutAll(): Promise<ApiResponse>;

// Password Reset APIs
export function requestPasswordReset(email: string): Promise<PasswordResetResult>;
export function verifyPasswordResetOTP(userId: string, otp: string): Promise<VerifyOTPResult>;
export function resetPassword(userId: string, tempToken: string, newPassword: string, confirmPassword: string): Promise<PasswordResetResult>;
export function resendPasswordResetOTP(userId: string, email: string): Promise<ApiResponse>;

// First Time Login APIs
export function checkEmailForFirstLogin(email: string): Promise<ApiResponse>;
export function sendFirstLoginOTP(email: string): Promise<ApiResponse>;
export function verifyFirstLoginOTP(email: string, otp: string): Promise<VerifyOTPResult>;
export function activateAccount(userId: string, otp: string, newPassword: string, confirmPassword: string): Promise<VerifyOTPResult>;
export function resendFirstLoginOTP(email: string): Promise<ApiResponse>;

// Account Lock/Unlock APIs
export function lockAccount(userId: string, reason: string): Promise<ApiResponse>;
export function unlockAccount(userId: string): Promise<ApiResponse>;

// User Data APIs
export function getCurrentUser(): any;
export function isUserAuthenticated(): boolean;
export function getToken(): string | null;

// Refresh Token API
export function refreshToken(): Promise<ApiResponse>;
