// FirstTimeLoginOTPModal - First-time login OTP verification modal
// Modal for users logging in for the first time using OTP

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface FirstTimeLoginOTPModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (email: string, userId: string, otp: string) => void;
}

const FirstTimeLoginOTPModal: React.FC<FirstTimeLoginOTPModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { checkEmailForFirstLogin, sendFirstLoginOTP, resendFirstLoginOTP } = useAuth();
  
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '']); // 5 digits
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // State for tracking step: 'email' -> 'otp' -> 'success'
  const [step, setStep] = useState<'email' | 'otp' | 'success'>('email');
  const [currentUserId, setCurrentUserId] = useState('');

  // Background images
  const cityHallImage = '/src/assets/cok_hall.jpg';
  const logoImage = '/src/assets/LOGO_COK.jpg';

  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes
      setTimeout(() => {
        setEmail('');
        setOtp(['', '', '', '', '']);
        setTimeLeft(300);
        setError('');
        setSuccess(false);
        setStep('email');
        setCurrentUserId('');
      }, 300);
    }
  }, [isOpen]);

  // Timer effect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 'otp' && timeLeft > 0 && !success) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 0) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, timeLeft, success]);

  // Step 1: Check email and send OTP
  const handleSendOTP = async () => {
    if (!email) {
      setError('Please enter your email');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // First check if email exists and account can be activated
      const checkResult = await checkEmailForFirstLogin(email);
      
      if (!checkResult.status) {
        setError(checkResult.error || 'Failed to verify email');
        setIsLoading(false);
        return;
      }
      
      // Check if account is already activated
      if (checkResult.data?.alreadyActivated) {
        setError('This account is already active. Please use regular login.');
        setIsLoading(false);
        return;
      }
      
      // Now send OTP
      const otpResult = await sendFirstLoginOTP(email);
      
      if (otpResult.status && otpResult.data?.userId) {
        setCurrentUserId(otpResult.data.userId);
        setStep('otp');
      } else {
        setError(otpResult.error || 'Failed to send OTP');
      }
    } catch (err: any) {
      setError(err?.error || err?.message || 'An error occurred');
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
      const nextInput = document.getElementById(`otp-firsttime-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    // Handle backspace
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-firsttime-${index - 1}`);
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

  // Step 2: Verify OTP - this actually activates the account in PasswordSetupModal
  const handleVerify = async () => {
    const otpString = otp.join('');
    if (otpString.length !== 5) {
      setError('Please enter all 5 digits');
      return;
    }

    // Pass the OTP to the next step for password setup
    if (onSuccess) {
      onSuccess(email, currentUserId, otpString);
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
      await resendFirstLoginOTP(email);
      setTimeLeft(300); // Reset to 5 minutes
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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Background with City Hall image and dark overlay */}
      <div 
        className="fixed inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${cityHallImage})` }}
      >
        <div className="absolute inset-0 bg-black/70" />
      </div>

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 transform transition-all">
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
                Redirecting to password setup...
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

              {/* COK Logo */}
              <div className="flex justify-center mb-4">
                <img 
                  src={logoImage} 
                  alt="City of Kigali" 
                  className="h-20 w-auto"
                />
              </div>

              {/* Title */}
              <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">
                First Time Login
              </h1>

              {/* Subtitle */}
              <p className="text-center text-gray-600 font-medium mb-4">
                Account Activation
              </p>

              {/* Step 1: Email Input */}
              {step === 'email' && (
                <>
                  <p className="text-center text-gray-600 mb-6">
                    Please enter your registered email to receive a verification code for account activation
                  </p>

                  <div className="mb-6">
                    <label htmlFor="firsttime-email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address
                    </label>
                    <input
                      id="firsttime-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="your.email@kigali.rw"
                    />
                  </div>

                  {error && (
                    <p className="text-center text-sm text-red-600 mb-4">{error}</p>
                  )}

                  <button
                    onClick={handleSendOTP}
                    disabled={isLoading || !email}
                    className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed mb-4"
                  >
                    {isLoading ? 'Verifying...' : 'Send Verification Code'}
                  </button>
                </>
              )}

              {/* Step 2: OTP Input */}
              {step === 'otp' && (
                <>
                  {/* Description with masked email */}
                  <p className="text-center text-gray-600 mb-4">
                    Please enter the One-Time PIN (OTP) sent to<br />
                    <span className="font-semibold text-gray-900">{maskEmail(email)}</span>
                  </p>

                  {/* OTP Input Fields - Individual boxes styled */}
                  <div className="flex justify-center gap-2 mb-6" onPaste={handlePaste}>
                    {otp.map((digit, index) => (
                      <input
                        key={index}
                        id={`otp-firsttime-${index}`}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value.replace(/\D/g, ''))}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        className="w-12 h-12 text-center text-lg font-semibold border-2 border-gray-300 rounded-md focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 text-gray-800 bg-white"
                        autoFocus={index === 0}
                      />
                    ))}
                  </div>

                  {/* Timer display with bullet */}
                  <p className="text-center text-sm text-gray-500 mb-4">
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
                    className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed mb-4"
                  >
                    {isLoading ? 'Verifying...' : 'Continue to Password Setup'}
                  </button>

                  {/* Resend link with timer */}
                  <div className="text-center">
                    <span className="text-gray-600">Didn't receive the code? </span>
                    <button
                      onClick={handleResend}
                      disabled={timeLeft > 0 || isResending}
                      className="text-blue-600 hover:text-blue-700 font-semibold transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isResending ? 'Resending...' : timeLeft > 0 ? `Resend OTP (${formatTime(timeLeft)})` : 'Resend OTP'}
                    </button>
                  </div>
                </>
              )}

              {/* Return to Login link */}
              <div className="text-center mt-6">
                <button 
                  onClick={onClose}
                  className="text-blue-600 hover:text-blue-700 font-medium transition duration-200"
                >
                  ← Back to Login
                </button>
              </div>

              {/* Secure portal footer - left aligned */}
              <p className="text-left text-xs text-gray-400 mt-8">
                © SECURE OFFICIAL CITY OF KIGALI PORTAL
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FirstTimeLoginOTPModal;
