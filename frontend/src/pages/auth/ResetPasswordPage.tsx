// ResetPasswordPage - Password reset page
// Page for setting new password after reset request
// src/pages/auth/ResetPasswordPage.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { verifyPasswordResetOTP, resetPassword } from '../../core/services/authService';

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const userIdFromUrl = searchParams.get('userId');
  
  // Get userId from URL or session storage
  const [userId, setUserId] = useState(userIdFromUrl || sessionStorage.getItem('resetUserId') || '');
  const [otp, setOtp] = useState('');
  const [tempToken, setTempToken] = useState(token || '');
  const [step, setStep] = useState(token ? 'reset' : 'verify'); // 'verify' or 'reset'
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState({
    hasMinLength: false,
    hasUppercase: false,
    hasNumber: false,
    hasSymbol: false,
    score: 0
  });

  // Password requirements check
  const checkPasswordStrength = (password) => {
    const strength = {
      hasMinLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSymbol: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
    };
    
    const score = Object.values(strength).filter(Boolean).length;
    setPasswordStrength({ ...strength, score });
  };

  const handlePasswordChange = (e) => {
    const password = e.target.value;
    setNewPassword(password);
    checkPasswordStrength(password);
  };

  const getStrengthText = () => {
    if (passwordStrength.score === 0) return '';
    if (passwordStrength.score <= 2) return 'Weak';
    if (passwordStrength.score === 3) return 'Medium';
    return 'Strong';
  };

  const getStrengthColor = () => {
    if (passwordStrength.score <= 2) return 'text-red-500';
    if (passwordStrength.score === 3) return 'text-yellow-500';
    if (passwordStrength.score === 4) return 'text-green-500';
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (step === 'verify') {
      // Step 1: Verify OTP
      if (!userId || !otp) {
        setError('User ID and OTP are required');
        return;
      }
      
      setIsLoading(true);
      try {
        const result = await verifyPasswordResetOTP(userId, otp);
        
        if (result.status && result.data?.tempToken) {
          setTempToken(result.data.tempToken);
          setStep('reset');
        } else {
          setError(result.error || 'Invalid OTP');
        }
      } catch (err: any) {
        setError(err?.error || err?.message || 'Failed to verify OTP');
      } finally {
        setIsLoading(false);
      }
    } else {
      // Step 2: Reset password
      if (newPassword !== confirmPassword) {
        setError("Passwords don't match");
        return;
      }

      setIsLoading(true);
      try {
        const result = await resetPassword(userId, tempToken, newPassword);
        
        if (result.status) {
          setIsSuccess(true);
          sessionStorage.removeItem('resetUserId');
        } else {
          setError(result.error || 'Failed to reset password');
        }
      } catch (err: any) {
        setError(err?.error || err?.message || 'Failed to reset password');
      } finally {
        setIsLoading(false);
      }
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex">
        {/* Left side - Image with overlay */}
        <div className="hidden lg:flex lg:w-1/2 relative">
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: 'url(/src/assets/cok_hall.jpg)' }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-blue-900/50 to-black/80"></div>
          </div>
          
          <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
            <h1 className="text-4xl font-bold">KSESM</h1>
            <div className="text-sm text-gray-400">© 2026 City of Kigali</div>
          </div>
        </div>

        {/* Right side - Success message */}
        <div className="w-full lg:w-1/2 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-8 bg-white">
          <div className="max-w-md w-full">
            <Link to="/login" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-8 transition-colors">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back
            </Link>

            <div className="mb-6">
              <p className="text-sm text-gray-500 uppercase tracking-wider">City of Kigali</p>
            </div>

            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-green-100 mb-6">
                <svg className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Password updated</h2>
              <p className="text-xl text-gray-600 mb-8">successfully!</p>
              <Link
                to="/login"
                className="inline-block w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Go to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Image with overlay */}
      <div className="hidden lg:flex lg:w-1/2 relative">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: 'url(/src/assets/cok_hall.jpg)' }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-blue-900/50 to-black/80"></div>
        </div>
        
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <h1 className="text-4xl font-bold">KSESM</h1>
          <div className="text-sm text-gray-400">© 2026 City of Kigali</div>
        </div>
      </div>

      {/* Right side - Reset Password form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-8 bg-white">
        <div className="max-w-md w-full space-y-8">
          {/* Back button */}
          <Link to="/forgot-password" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6 sm:mb-8 transition-colors">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back
          </Link>

          {/* City of Kigali text */}
          <div className="mb-6">
            <p className="text-sm text-gray-500 uppercase tracking-wider">City of Kigali</p>
          </div>

          {/* Header */}
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Update Credentials</h2>
          <p className="text-gray-600 mb-8">
            Secure your account for KSESM access
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600 text-center">{error}</p>
              </div>
            )}

            {/* OTP Field - Show during verify step */}
            {step === 'verify' && (
              <div>
                <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-1">
                  VERIFICATION CODE
                </label>
                <input
                  id="otp"
                  name="otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={5}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter 5-digit code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                />
                <p className="text-sm text-gray-500 mt-2">
                  Enter the code sent to your email
                </p>
              </div>
            )}

            {/* New Password field */}
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1">
                NEW PASSWORD
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  name="new-password"
                  type={showPassword ? "text" : "password"}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12"
                  placeholder="SuperSecureP@ss123"
                  value={newPassword}
                  onChange={handlePasswordChange}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Password Strength */}
            {newPassword && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Password Strength</span>
                  <span className={`text-sm font-medium ${getStrengthColor()}`}>
                    {getStrengthText()}
                  </span>
                </div>
                
                {/* Requirements list */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center space-x-2">
                    <span className={passwordStrength.hasMinLength ? 'text-green-500' : 'text-gray-400'}>
                      {passwordStrength.hasMinLength ? '✓' : '○'}
                    </span>
                    <span className={passwordStrength.hasMinLength ? 'text-gray-700' : 'text-gray-400'}>
                      8+ Characters
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={passwordStrength.hasUppercase ? 'text-green-500' : 'text-gray-400'}>
                      {passwordStrength.hasUppercase ? '✓' : '○'}
                    </span>
                    <span className={passwordStrength.hasUppercase ? 'text-gray-700' : 'text-gray-400'}>
                      1 Uppercase
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={passwordStrength.hasNumber ? 'text-green-500' : 'text-gray-400'}>
                      {passwordStrength.hasNumber ? '✓' : '○'}
                    </span>
                    <span className={passwordStrength.hasNumber ? 'text-gray-700' : 'text-gray-400'}>
                      1 Number
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={passwordStrength.hasSymbol ? 'text-green-500' : 'text-gray-400'}>
                      {passwordStrength.hasSymbol ? '✓' : '○'}
                    </span>
                    <span className={passwordStrength.hasSymbol ? 'text-gray-700' : 'text-gray-400'}>
                      1 Symbol
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Confirm New Password field */}
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
                CONFIRM NEW PASSWORD
              </label>
              <input
                id="confirm-password"
                name="confirm-password"
                type="password"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            {/* Update Password button */}
            <button
              type="submit"
              disabled={isLoading || (step === 'reset' && (passwordStrength.score < 4 || newPassword !== confirmPassword))}
              className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {step === 'verify' ? 'Verifying...' : 'Updating...'}
                </span>
              ) : (
                step === 'verify' ? 'VERIFY CODE' : 'UPDATE PASSWORD'
              )}
            </button>
          </form>

          {/* Need help section */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500">
              Need help?{' '}
              <button className="text-blue-600 hover:text-blue-700 font-medium">
                Contact IT Support
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;