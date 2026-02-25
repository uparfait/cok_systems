// OTPModal Component - One-time password input modal
// Used for verifying user identity via OTP code

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { login, verifyLoginOTP, resendLoginOTP, requestPasswordReset } from '../../services/authService';

interface OTPModalProps {
  isOpen: boolean;
  onClose: () => void;
  email?: string;
  userId?: string;
  isFirstTimeLogin?: boolean;
}

const OTPModal: React.FC<OTPModalProps> = ({ isOpen, onClose, email: initialEmail = '', userId, isFirstTimeLogin = false }) => {
  // State for email input (for first time login)
  const [email, setEmail] = useState(initialEmail);
  
  // State for OTP
  const [otp, setOtp] = useState(['', '', '', '', '']); // 5 digits
  const [timeLeft, setTimeLeft] = useState(114); // 1:54 in seconds
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // State for tracking step: 'email' -> 'otp' -> 'success'
  const [step, setStep] = useState<'email' | 'otp' | 'success'>('email');
  const [currentUserId, setCurrentUserId] = useState(userId || '');

  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes
      setTimeout(() => {
        setEmail(initialEmail);
        setOtp(['', '', '', '', '']);
        setTimeLeft(114);
        setError('');
        setSuccess(false);
        setStep('email');
        setCurrentUserId(userId || '');
      }, 300);
    }
  }, [isOpen]);

  const handleSendOTP = async () => {
    if (!email) {
      setError('Please enter your email');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // For first time login, we use the login endpoint which will send OTP
      const result = await login(email, 'dummy_password_for_otp');
      
      if (result.status && result.data?.requiresOTP) {
        setCurrentUserId(result.data.userId);
        setStep('otp');
        
        // Start timer
        const timer = setInterval(() => {
          setTimeLeft((prev) => {
            if (prev <= 0) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else if (!result.status && result.error?.includes('not found')) {
        // User not found - try password reset flow
        const resetResult = await requestPasswordReset(email);
        if (resetResult.status) {
          // For password reset, we need a different approach
          setError('Please use the Forgot Password page to reset your password');
        } else {
          setError('User not found. Please contact support.');
        }
      } else {
        setError(result.error || 'Failed to send OTP');
      }
    } catch (err: any) {
      setError(err?.error || err?.message || 'Failed to send OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError('');

    // Auto-focus next input
    if (value && index < 4) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    // Handle backspace
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 5).split('');
    const newOtp = [...otp];
    pastedData.forEach((value, index) => {
      if (index < 5) newOtp[index] = value;
    });
    setOtp(newOtp);
  };

  const handleVerify = async () => {
    const otpString = otp.join('');
    if (otpString.length !== 5) {
      setError('Please enter all 5 digits');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Verify OTP
      const result = await verifyLoginOTP(currentUserId, otpString);
      
      if (result.status) {
        setSuccess(true);
        setStep('success');
        
        // First time login - go to reset password
        if (isFirstTimeLogin) {
          setTimeout(() => {
            onClose();
            window.location.href = '/reset-password';
          }, 1500);
        } else {
          // Normal 2FA login - go to dashboard
          setTimeout(() => {
            onClose();
            window.location.href = '/dashboard';
          }, 1500);
        }
      } else {
        setError(result.error || 'Invalid OTP');
      }
    } catch (err: any) {
      setError(err?.error || err?.message || 'Failed to verify OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!currentUserId) {
      setError('Please enter your email first');
      return;
    }

    setIsResending(true);
    setError('');

    try {
      await resendLoginOTP(currentUserId, email);
      setTimeLeft(114);
    } catch (err: any) {
      setError(err?.error || 'Failed to resend OTP');
    } finally {
      setIsResending(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Mask email for display
  const maskEmail = (emailStr: string) => {
    if (!emailStr) return '';
    const [localPart, domain] = emailStr.split('@');
    if (!domain) return emailStr;
    
    const maskedLocal = localPart.length > 2 
      ? localPart.substring(0, 2) + '***' 
      : localPart + '***';
    
    return `${maskedLocal}@${domain}`;
  };

  if (!isOpen) return null;

  // Background images
  const cityHallImage = '/src/assets/cok_hall.jpg';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Background with City Hall image and gradient overlay */}
      <div 
        className="fixed inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${cityHallImage})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent" />
      </div>

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
        <div className="relative bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl max-w-sm w-full p-5 sm:p-6 transform transition-all">
          {/* Success State */}
          {success || step === 'success' ? (
            <div className="text-center py-8">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Verification Successful!</h3>
              <p className="text-gray-600">
                {isFirstTimeLogin ? 'Redirecting to password reset...' : 'Redirecting to dashboard...'}
              </p>
            </div>
          ) : (
            <>
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition duration-200"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Title */}
              <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">
                5-Digit Security Verification
              </h1>

              {/* Step 1: Email Input */}
              {step === 'email' && (
                <>
                  <p className="text-center text-gray-600 mb-6">
                    Enter your email to receive a verification code
                  </p>

                  <div className="mb-6">
                    <label htmlFor="modal-email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address
                    </label>
                    <input
                      id="modal-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="evode@kigali.rw"
                    />
                  </div>

                  {error && (
                    <p className="text-center text-sm text-red-600 mb-4">{error}</p>
                  )}

                  <button
                    onClick={handleSendOTP}
                    disabled={isLoading || !email}
                    className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed mb-4"
                  >
                    {isLoading ? 'Sending...' : 'Send Verification Code'}
                  </button>
                </>
              )}

              {/* Step 2: OTP Input */}
              {step === 'otp' && (
                <>
                  {/* Description with masked email */}
                  <p className="text-center text-gray-600 mb-4">
                    Enter the 5-digit verification code we've sent to<br />
                    <span className="font-semibold text-gray-900">{maskEmail(email)}</span>
                  </p>

                  {/* OTP Display - Large numbers */}
                  <div className="flex justify-center gap-4 mb-4">
                    {otp.map((digit, index) => (
                      <div key={index} className="w-12 h-12 flex items-center justify-center">
                        <span className="text-3xl font-bold text-gray-800">{digit || ''}</span>
                      </div>
                    ))}
                  </div>

                  {/* Hidden OTP Inputs for functionality */}
                  <div className="flex justify-center gap-3 mb-4" onPaste={handlePaste}>
                    {otp.map((digit, index) => (
                      <input
                        key={index}
                        id={`otp-${index}`}
                        type="text"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        className="w-0 h-0 opacity-0 absolute"
                        autoFocus={index === 0}
                      />
                    ))}
                  </div>

                  {/* Timer */}
                  <p className="text-center text-sm text-gray-500 mb-6">
                    • Code expires in {formatTime(timeLeft)}
                  </p>

                  {/* Error message */}
                  {error && (
                    <p className="text-center text-sm text-red-600 mb-4">{error}</p>
                  )}

                  {/* Verify button */}
                  <button
                    onClick={handleVerify}
                    disabled={otp.join('').length !== 5 || isLoading}
                    className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed mb-4"
                  >
                    {isLoading ? 'Verifying...' : 'Verify and Log In'}
                  </button>

                  {/* Resend link */}
                  <div className="text-center mb-4">
                    <span className="text-gray-600">Didn't receive the code? </span>
                    <button
                      onClick={handleResend}
                      disabled={timeLeft > 0 || isResending}
                      className="text-blue-600 hover:text-blue-700 font-semibold transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isResending ? 'Resending...' : 'Resend Code'}
                    </button>
                  </div>
                </>
              )}

              {/* Return to Login link */}
              <div className="text-center mb-8">
                <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium transition duration-200">
                  [Return to Login]
                </Link>
              </div>

              {/* Secure portal footer */}
              <p className="text-center text-xs text-gray-400">
                © SECURE OFFICIAL CITY OF KIGALI PORTAL
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default OTPModal;
