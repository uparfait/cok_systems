// LoginPage - User login page with proper auth integration

import React, { useState } from 'react';
import { FiLogIn } from 'react-icons/fi';
import { Link, useNavigate } from 'react-router-dom';
import FirstTimeLoginOTPModal from '../../core/components/Modals/FirstTimeLoginOTPModal';
import PasswordSetupModal from '../../core/components/Modals/PasswordSetupModal';
import OTPVerificationModal from '../../core/components/Modals/OTPVerificationModal';
import { useAuth } from '../../core/contexts/AuthContext';

const LoginPage = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showFirstTimeOTPModal, setShowFirstTimeOTPModal] = useState(false);
  const [showPasswordSetupModal, setShowPasswordSetupModal] = useState(false);
  const [showOTPVerificationModal, setShowOTPVerificationModal] = useState(false);
  const [passwordSetupEmail, setPasswordSetupEmail] = useState('');
  const [passwordSetupOtp, setPasswordSetupOtp] = useState('');
  const [passwordSetupUserId, setPasswordSetupUserId] = useState('');
  const [otpVerificationEmail, setOtpVerificationEmail] = useState('');
  const [otpVerificationUserId, setOtpVerificationUserId] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Import images from assets
  const cityHallImage = '/src/assets/cok_hall.jpg';
  const logoImage = '/src/assets/LOGO_COK.jpg';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      const result = await login(email, password);
      
      if (result.status && result.data?.requiresOTP) {
        // User needs OTP verification (existing user with 2FA)
        setOtpVerificationEmail(email);
        setOtpVerificationUserId(result.data.userId);
        setShowOTPVerificationModal(true);
      } else if (result.status && result.data?.tokens) {
        // Direct login - tokens stored in context, redirect to dashboard
        navigate('/dashboard');
      } else if (result.error?.includes('not activated') || result.error?.includes('Account not activated')) {
        // First-time login - account not yet activated
        setShowFirstTimeOTPModal(true);
      } else if (result.error?.includes('not found')) {
        setError('User not found. Please check your email or contact administrator.');
      } else {
        // Handle other errors including invalid credentials
        const errorMsg = result.error || result.message || 'Login failed';
        if (result.data?.remainingAttempts !== undefined) {
          setError(`${errorMsg}. Attempts remaining: ${result.data.remainingAttempts}`);
        } else {
          setError(errorMsg);
        }
      }
    } catch (err: any) {
      // Check if it's a first-time login scenario
      if (err?.error?.includes('not activated') || err?.message?.includes('not activated')) {
        setShowFirstTimeOTPModal(true);
      } else {
        const errorMsg = err?.error || err?.message || 'An error occurred during login';
        if (err?.data?.remainingAttempts !== undefined) {
          setError(`${errorMsg}. Attempts remaining: ${err.data.remainingAttempts}`);
        } else {
          setError(errorMsg);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOTPLogin = () => {
    // Show First Time Login OTP modal for first time users
    setShowFirstTimeOTPModal(true);
  };

  const handleOTPSuccess = (email: string, userId: string, otp: string) => {
    // Close OTP modal and open password setup modal
    setShowFirstTimeOTPModal(false);
    setPasswordSetupEmail(email);
    setPasswordSetupUserId(userId);
    setPasswordSetupOtp(otp);
    setShowPasswordSetupModal(true);
  };

  const handlePasswordSetupSuccess = () => {
    // Close password setup modal and redirect to login
    setShowPasswordSetupModal(false);
    setEmail('');
    setPassword('');
    // Optionally show success message and redirect to login
    alert('Account activated successfully! Please login with your email and password.');
    navigate('/login');
  };

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

        <div className="relative z-10 flex flex-col justify-end p-10 lg:p-14 text-white w-full h-full">
          {/* COK OFFICIAL PORTAL pill */}
          <div className="inline-flex items-center px-4 py-2 mb-4 bg-white/10 backdrop-blur-sm rounded-full border border-white/20 text-xs font-semibold tracking-wide uppercase w-max cok-badge-animated">
            <span className="mr-2 inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/60">
              <span className="h-2 w-2 rounded-full bg-white" />
            </span>
            <span className="font-bold">COK Official Portal</span>
          </div>

          {/* Main heading and description */}
          <div className="space-y-3 max-w-xl">
            <h1 className="poetsen-one-regular text-3xl md:text-4xl lg:text-5xl tracking-tight leading-snug">
              Smart Entry & <br/> Service Management
            </h1>
            <p className="public-sans-regular text-sm md:text-base text-[#EFF6FF] font-semibold">
              Serving the City of Kigali with efficiency and security.
            </p>
            <p className="public-sans-regular text-xs md:text-sm text-[#EFF6FF] font-semibold max-w-md">
              Access the KSESM portal to manage administrative tasks and secure entry logs.
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Login form card */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-white px-3 sm:px-6 lg:px-14">
        <div className="w-full max-w-sm">
          <div className="bg-white">
            {/* Logo and intro text */}
            <div className="text-center mb-6 md:mb-8">
              <img
                src={logoImage}
                alt="City of Kigali"
                className="h-[152px] md:h-[168px] w-auto mx-auto mb-3"
              />
              <p className="public-sans-bold-20 text-[#0D141C]">
                Welcome Back
              </p>
              <p className="mt-1 text-sm md:text-base text-gray-600">
                Please enter your credentials to continue.
              </p>
            </div>

            {/* Login form */}
            <form onSubmit={handleSubmit} className="space-y-5 md:space-y-6">
              {/* Email/Username field */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-xs md:text-sm font-semibold text-gray-700 mb-1.5 tracking-wide"
                >
                  EMAIL OR USERNAME
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
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  </span>
                  <input
                    id="email"
                    name="email"
                    type="text"
                    required
                    className="w-full pl-12 pr-3 py-3 rounded-lg text-sm bg-[#F9FAFB] border border-[#E5E7EB] text-[#0D141C] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#9CA3AF] focus:border-[#E5E7EB]"
                    placeholder="e.g. user@kigali.rw"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              {/* Password field */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-xs md:text-sm font-semibold text-gray-700 mb-1.5 tracking-wide"
                >
                  PASSWORD
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
                    className="w-full pl-12 pr-10 py-3 rounded-lg text-sm bg-[#F9FAFB] border border-[#E5E7EB] text-[#0D141C] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#9CA3AF] focus:border-[#E5E7EB]"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              {/* Remember me and Forgot Password row */}
              <div className="flex items-center justify-between text-xs md:text-sm">
                <label className="flex items-center space-x-2 cursor-pointer select-none">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span className="text-gray-700">Remember me</span>
                </label>

                <Link
                  to="/forgot-password"
                  className="font-semibold text-blue-600 hover:text-blue-500 transition-colors"
                >
                  Forgot Password?
                </Link>
              </div>

              {/* Error message */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600 text-center">{error}</p>
                </div>
              )}

              {/* Sign in button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors transform hover:-translate-y-0.5 hover:shadow-md"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
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
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  <>
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-white/40 mr-1">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M10 17l5-5-5-5"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4 12h11"
                        />
                      </svg>
                    </span>
                    SIGN IN
                  </>
                )}
              </button>
            </form>

            {/* First time logging in section */}
            <div className="mt-6">
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-center">
                <p className="text-xs md:text-sm text-gray-700">
                  First time logging in?
                </p>
                <button
                  onClick={handleOTPLogin}
                  className="mt-2 inline-flex items-center justify-center px-4 py-2 rounded-lg bg-blue-600 text-xs md:text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors transform hover:-translate-y-0.5"
                >
                  <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-md bg-blue-500">
                    <FiLogIn className="h-3.5 w-3.5" />
                  </span>
                  Login with OTP (One-Time PIN)
                </button>
              </div>
            </div>

            {/* Footer copyright */}
            <p className="text-center text-xs md:text-sm text-gray-400 mt-8">
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
          otp={passwordSetupOtp}
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
    </div>
  );
};

export default LoginPage;
