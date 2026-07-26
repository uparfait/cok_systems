// LoginPage - User login page with proper auth integration

import React, { useState, useEffect } from 'react';
import { FiLogIn, FiLoader } from 'react-icons/fi';
import {  useNavigate } from 'react-router-dom';
import FirstTimeLoginOTPModal from '../../core/components/Modals/FirstTimeLoginOTPModal';
import PasswordSetupModal from '../../core/components/Modals/PasswordSetupModal';
import OTPVerificationModal from '../../core/components/Modals/OTPVerificationModal';
import PasswordResetOTPModal from '../../core/components/Modals/PasswordResetOTPModal';
import FeedbackModal from '../../core/components/Modals/FeedbackModal';
import { useAuth } from '../../core/contexts/AuthContext';
import { useToast } from '../../core/contexts/ToastContext';
import { getDashboardRoute } from '../../core/components/Layout/layoutUtils';
import { validateToken } from '../../core/services/authService';
import { getStoredUser } from '../../core/services/apiClient';

const LoginPage = () => {

  const { login } = useAuth();
  
  const { showSuccess, showError } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showFirstTimeOTPModal, setShowFirstTimeOTPModal] = useState(false);
  const [showPasswordSetupModal, setShowPasswordSetupModal] = useState(false);
  const [showOTPVerificationModal, setShowOTPVerificationModal] = useState(false);
  const [showPasswordResetOTPModal, setShowPasswordResetOTPModal] = useState(false);
  const [passwordSetupEmail, setPasswordSetupEmail] = useState('');
  const [passwordSetupSignature, setPasswordSetupSignature] = useState('');
  const [passwordSetupUserId, setPasswordSetupUserId] = useState('');
  const [otpVerificationEmail, setOtpVerificationEmail] = useState('');
  const [otpVerificationUserId, setOtpVerificationUserId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const navigate = useNavigate();

  // Images from public folder
  const cityHallImage = '/cok_hall.jpg';
  const logoImage = '/LOGO_COK.png';

  // Check for existing authentication on component mount
  useEffect(() => {
    const checkExistingAuth = async () => {
      try {
        console.log('[LoginPage] Checking for existing authentication...');

        // Check if we have stored tokens
        const storedUser = getStoredUser();
        const storedToken = localStorage.getItem('accessToken');

        if (!storedToken || !storedUser) {
          console.log('[LoginPage] No stored authentication found, showing login form');
          setIsCheckingAuth(false);
          return;
        }

        console.log('[LoginPage] Found stored authentication, validating token...');

        // Validate the token with the backend
        const validationResult = await validateToken();

        if (validationResult.isValid && validationResult.user) {
          console.log('[LoginPage] Token is valid, redirecting to dashboard...');

          // Token is valid, redirect to appropriate dashboard
          const userRole = validationResult.user.role || '';
          const userDepartment = validationResult.user.department_name ||
                               validationResult.user.departmentName ||
                               validationResult.user.department || '';

          const redirectPath = await getDashboardRoute(userRole, userDepartment);
         
          console.log('[LoginPage] Redirecting to:', redirectPath);
          navigate(redirectPath);
          return;
        } else {
          console.log('[LoginPage] Token is invalid or expired, showing login form');
          // Token is invalid, clear stored data and show login form
          localStorage.removeItem('accessToken');
          localStorage.removeItem('userData');
          localStorage.removeItem('refreshToken');
          setIsCheckingAuth(false);
          return;
        }
      } catch (error) {
        console.error('[LoginPage] Error checking authentication:', error);
        // On error, clear any potentially corrupted data and show login form
        localStorage.removeItem('accessToken');
        localStorage.removeItem('userData');
        localStorage.removeItem('refreshToken');
        setIsCheckingAuth(false);
      }
    };

    checkExistingAuth();
  }, [navigate]);

  // Track if form is being submitted to prevent multiple submissions

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Prevent multiple submissions
    if (isSubmitting || isLoading) return;
    
    setIsLoading(true);
    setIsSubmitting(true);
    
    try {
      const result = await login(email, password);
      
      if ((result.status === true || result.success === true) && result.data?.requiresOTP) {
        // User needs OTP verification (existing user with 2FA)
        const userId = result.data.userId || result.data.user_id || result.data.id;
        
        if (!userId) {
          showError('Login succeeded but user ID was not returned. Please try again.');
          return;
        }
        
        setOtpVerificationEmail(email);
        setOtpVerificationUserId(String(userId));
        setShowOTPVerificationModal(true);
        return;
      } else if ((result.status === true || result.success === true) && result.data?.tokens) {
        // Direct login - tokens stored in context, redirect based on role
        const userRole = result.data.role || '';
        const userDepartment = result.data.department_name || result.data.departmentName || result.data.department;
        
        // Use async version to get route based on role
        const redirectPath = await getDashboardRoute(userRole, userDepartment);
        navigate(redirectPath);
        return;
      } else if (result.error?.includes('not activated') || result.error?.includes('Account not activated')) {
        // First-time login - account not yet activated
        setShowFirstTimeOTPModal(true);
        return;
      } else if (result.error?.includes('not found')) {
        showError('User not found. Please check your email or contact administrator.');
        return;
      } else {
        // Handle other errors including invalid credentials - use backend message with fallback
        const errorMsg = result.message || result.error || 'Login failed';
        if (result.data?.remainingAttempts !== undefined) {
          showError(`${errorMsg}. Attempts remaining: ${result.data.remainingAttempts}`);
        } else {
          showError(errorMsg);
        }
        return;
      }
    } catch (err: any) {
      // Check if it's a first-time login scenario
      if (err?.message?.includes('not activated') || err?.error?.includes('not activated')) {
        setShowFirstTimeOTPModal(true);
        return;
      }
      
      // Use backend message with priority, fallback to error field
      const errorMsg = err?.message || err?.error || 'An error occurred during login';
      if (err?.data?.remainingAttempts !== undefined) {
        showError(`${errorMsg}. Attempts remaining: ${err.data.remainingAttempts}`);
      } else {
        showError(errorMsg);
      }
      return;
    } finally {
      setIsLoading(false);
      setIsSubmitting(false);
    }
  };

  const handleOTPLogin = () => {
    // Show First Time Login OTP modal for first time users
    setShowFirstTimeOTPModal(true);
  };

  const handleOTPSuccess = (email: string, userId: string, signature: string) => {
    // Close OTP modal and open password setup modal
    setShowFirstTimeOTPModal(false);
    setPasswordSetupEmail(email);
    setPasswordSetupUserId(userId);
    setPasswordSetupSignature(signature);
    setShowPasswordSetupModal(true);
  };

  const handlePasswordSetupSuccess = () => {
    // Close password setup modal and show success message inline
    setShowPasswordSetupModal(false);
    setEmail('');
    setPassword('');
    // Show success message via toast
    showSuccess('Account activated successfully! You can now login with your email and password.');
  };

  // Handle forgot password click - navigate to forgot password page
  const handleForgotPassword = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate('/forgot-password');
  };

  // Handle OTP verification success for password reset - navigate to reset password
  const handlePasswordResetOTPSuccess = (userId: string, tempToken: string) => {
    console.log(tempToken)
    setShowPasswordResetOTPModal(false);
    // Navigate to reset password page with userId
    navigate(`/reset-password?userId=${userId}`);
  };

  // Show authenticating component while checking for existing auth
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex bg-white">
        {/* Left side - City Hall image with dark overlay and text */}
        <div className="hidden lg:flex lg:w-1/2 relative">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${cityHallImage})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent" />
          </div>

          <div className="relative z-10 flex flex-col justify-end p-7 lg:p-14  text-white w-full h-full">


            {/* Main heading and description */}
            <div className="space-y-2 max-w-xl ">
              <h1 className="text-2xl md:text-3xl lg:text-4xl text-bold tracking-tight leading-snug"
              style={{ fontWeight: 800, letterSpacing: '-0.5px' }}
              >
                IKAZE PORTAL
              </h1>
            </div>
          </div>
        </div>

        {/* Right side - Authenticating component */}
        <div
          className="w-full md:w-full lg:w-1/2 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-8"
          style={{ backgroundColor: '#F7F9FB' }}
        >
          <div className="w-full max-w-lg">
            <div className="cok-auth-card px-5 py-6 sm:px-10 sm:py-8">
              {/* Logo and authenticating text */}
              <div className="text-center mb-4 sm:mb-5">
                <img
                  src={logoImage}
                  alt="City of Kigali"
                  className="h-16 sm:h-20 md:h-24 w-auto mx-auto mb-2"
                />
                <p
                  className="text-base sm:text-lg"
                  style={{ fontWeight: 700, color: '#333333' }}
                >
                  Authenticating...
                </p>
              </div>

              {/* Loading spinner */}
              <div className="flex flex-col items-center justify-center py-8">
                <div className="relative">
                  <div
                    className="w-16 h-16 border-4 rounded-full animate-spin"
                    style={{ borderColor: '#E6F1F8', borderTopColor: '#056daa' }}
                  ></div>
                </div>
                <p
                  className="mt-4 text-sm"
                  style={{ fontFamily: "'Merriweather', serif", color: '#555555' }}
                >
                  waiting...
                </p>
              </div>

            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left side - City Hall image with dark overlay and text */}
      <div className="hidden lg:flex lg:w-1/2 relative">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${cityHallImage})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent" />
        </div>

        <div className="relative z-10 flex flex-col justify-end p-7 lg:p-14  text-white w-full h-full">


          {/* Main heading and description */}
          <div className="space-y-2 max-w-xl ">
            <h1
              className="text-2xl md:text-3xl lg:text-4xl leading-snug"
              style={{ fontWeight: 800, letterSpacing: '-0.5px' }}
            >
              IKAZE PORTAL
            </h1>
          
           
           
          </div>
        </div>
      </div>

      {/* Right side - Login form card */}
      <div
        className="w-full  lg:w-1/2 flex  items-center justify-center"
        style={{ backgroundColor: '#FFFFFF' }}
      >
        <div className="w-full max-w-lg h-full ">
          <div className="cok-auth-card h-full flex   justify-center flex-col  px-2 py-6 sm:px-10 sm:py-8">
            {/* Logo and intro text */}
            <div className="text-center mb-4 sm:mb-5">
              <img
                src={logoImage}
                alt="City of Kigali"
                className="h-16 sm:h-20 md:h-24 w-auto mx-auto mb-2"
              />
              <p
                style={{
                 
                  fontSize: 24,
                  fontWeight: 800,
                  letterSpacing: '-0.5px',
                  color: '#056daa',
                  margin: 0,
                }}
              >
                Welcome Back
              </p>
              <p
                className="mt-1 text-xs sm:text-sm"
                style={{ color: '#555555' }}
              >
                Please enter your credentials to continue.
              </p>
            </div>

            {/* Login form */}
            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
              {/* Email field */}
              <div>
                <label htmlFor="email" className="cok-auth-label">
                  Email Address
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 sm:pl-3 text-[#9CA3AF]">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.8}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  </span>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    className="cok-auth-input pl-9 sm:pl-10 pr-3 py-3 placeholder:text-gray-400"
                    placeholder="e.g user@domain.example"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              {/* Password field */}
              <div>
                <label htmlFor="password" className="cok-auth-label">
                  Password
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#9CA3AF]">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                  </span>
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#9CA3AF] hover:text-gray-600 cursor-pointer"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.8}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                        />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.8}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    )}
                  </button>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    className="cok-auth-input pl-10 pr-10 py-3 placeholder:text-gray-400"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                  />
                </div>
              </div>

              {/* Remember me and Forgot Password row */}
              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center space-x-2 cursor-pointer select-none">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 border-gray-300"
                    style={{ accentColor: '#056daa' }}
                    checked={true}
                    disabled={true}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span style={{ fontFamily: "'Merriweather', serif", color: '#555555' }}>We Remember You</span>
                </label>

                <a
                  href="#"
                  onClick={handleForgotPassword}
                  className="transition-colors hover:opacity-80"
                  style={{ fontWeight: 600, color: '#056daa' }}
                >
                  Forgot Password?
                </a>
              </div>

              {/* Sign in button */}
              <button
                type="submit"
                disabled={isLoading}
                className={`cok-btn-primary flex items-center justify-center gap-1 ${
                  isLoading ? 'cursor-wait animate-pulse' : 'disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                <span className="inline-flex h-4 w-4 items-center justify-center mr-1">
                  {isLoading ? (
                    <svg
                      className="animate-spin h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  ) : (
                   <span>LOGIN</span>
                  )}
                </span>
                
              </button>
            </form>
            {/* First time logging in section */}
            <div className="mt-4 sm:mt-5">
              <div
                className="px-3 sm:px-4 py-2.5 sm:py-3 text-center"
                style={{ backgroundColor: '#F7F9FB', border: '1px solid #E0E0E0' }}
              >
                <p className="text-xs" style={{ fontFamily: "'Merriweather', serif", color: '#555555' }}>
                  First time logging in?
                </p>
                <button
                  onClick={handleOTPLogin}
                  className="cok-btn-outlined mt-2 inline-flex items-center justify-center"
                >
                  <FiLogIn className="h-3.5 w-3.5 mr-2" />
                  Login with OTP (One-Time PIN)
                </button>
              </div>
            </div>

            {/* Footer copyright */}
            <p
              className="text-center text-xs mt-5 sm:mt-6"
              style={{ fontFamily: "'Merriweather', serif", color: '#9E9E9E' }}
            >
              © {new Date().getFullYear()} City of Kigali. All rights reserved.
            </p>


          </div>
        </div>
      </div>

      {/* First Time Login OTP Modal */}
      {showFirstTimeOTPModal && (
        <FirstTimeLoginOTPModal
          isOpen={showFirstTimeOTPModal}
          onClose={() => setShowFirstTimeOTPModal(false)}
          onSuccess={handleOTPSuccess}
        />
      )}

      {/* Password Setup Modal */}
      {showPasswordSetupModal && (
        <PasswordSetupModal
          isOpen={showPasswordSetupModal}
          onClose={() => setShowPasswordSetupModal(false)}
          onSuccess={handlePasswordSetupSuccess}
          email={passwordSetupEmail}
          userId={passwordSetupUserId}
          signature={passwordSetupSignature}
        />
      )}

      {/* OTP Verification Modal for existing users */}
      {showOTPVerificationModal && (
        <OTPVerificationModal
          isOpen={showOTPVerificationModal}
          onClose={() => setShowOTPVerificationModal(false)}
          email={otpVerificationEmail}
          userId={otpVerificationUserId}
        />
      )}

      {/* Password Reset OTP Modal */}
      {showPasswordResetOTPModal && (
        <PasswordResetOTPModal
          isOpen={showPasswordResetOTPModal}
          onClose={() => setShowPasswordResetOTPModal(false)}
          email={''}
          onVerified={handlePasswordResetOTPSuccess}
        />
      )}

      {/* Feedback Modal for visitors */}
      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
      />
    </div>
  );
};

export default LoginPage;
