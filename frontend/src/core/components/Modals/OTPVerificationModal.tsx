// TOTPVerificationModal - TOTP verification modal for existing users
// Uses auth context for TOTP verification

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getDashboardRoute } from '../Layout/layoutUtils';

interface TOTPVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  email?: string;
  userId?: string;
}

const TOTPVerificationModal: React.FC<TOTPVerificationModalProps> = ({ 
  isOpen, 
  onClose, 
  email: initialEmail = '', 
  userId: initialUserId = '' 
}) => {
  const { verifyOTP, resendOTP, checkAuth } = useAuth();
  const { showSuccess, showError, showWarning } = useToast();
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState(['', '', '', '', '', '']); // 6 digits for TOTP
  const [timeLeft, setTimeLeft] = useState(300);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [timeLeftExpiry, setTimeLeftExpiry] = useState(60);
  
  const userIdRef = useRef(initialUserId);
  const [currentUserId, setCurrentUserId] = useState(initialUserId);
  
  const navigate = useNavigate();

  const cityHallImage = '/cok_hall.jpg';
  const logoImage = '/LOGO_COK.png';

  useEffect(() => {
    userIdRef.current = initialUserId;
    setCurrentUserId(initialUserId);
    setEmail(initialEmail);
  }, [initialUserId, initialEmail]);

  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setEmail(initialEmail);
        setOtp(['', '', '', '', '', '']);
        setTimeLeft(300);
        setTimeLeftExpiry(60);
        setError('');
        setIsSuccess(false);
      }, 300);
    }
  }, [isOpen]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isOpen && timeLeft > 0 && !isSuccess) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 0) {
             clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });

        setTimeLeftExpiry((prev) => {
          if (prev <= 0) {
            return 0;
          }
           return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isOpen, timeLeft, isSuccess]);

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return;

    if (isNaN(Number(value))) {
      showWarning('Please enter digits only');
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError('');

    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-verify-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-verify-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6).split('');
    const newOtp = [...otp];
    pastedData.forEach((value, index) => {
      if(isNaN(Number(value))) {
        showWarning('Detected non-numeric character in pasted TOTP. Please enter digits only.');
        return;
      }
      if (index < 6) newOtp[index] = value;
    });
    setOtp(newOtp);
  };

  const handleVerify = useCallback(async () => {
    const otpString = otp.join('');
    
    const uid = userIdRef.current || currentUserId || initialUserId;
    
    if (!uid) {
      setError('User ID is missing. Please try logging in again.');
      showError('User ID is missing. Please try logging in again.');
      return;
    }
    
    if (otpString.length !== 6) {
      showWarning('Please enter all 6 digits');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await verifyOTP(String(uid), String(otpString));
      
      console.log('[TOTPVerificationModal] verifyOTP result:', JSON.stringify(result, null, 2));
      
      const hasAccessToken = !!result.data?.accessToken;
      const isVerified = (result.status === true || result.success === true) && (hasAccessToken || result.data?.verified === true);
      
      console.log('[TOTPVerificationModal] isVerified:', isVerified, 'result.status:', result.status, 'has accessToken:', hasAccessToken);
      
      if (isVerified) {
        setIsSuccess(true);
        showSuccess('TOTP verified successfully! Redirecting...');
        
        if (hasAccessToken && result.data) {
          const { accessToken, refreshToken, user, ...userInfo } = result.data;
          
          if (accessToken) {
            localStorage.setItem('accessToken', accessToken);
          }
          if (refreshToken) {
            localStorage.setItem('refreshToken', refreshToken);
          }
          if (user) {
            localStorage.setItem('userData', JSON.stringify(user));
          } else {
            localStorage.setItem('userData', JSON.stringify(userInfo));
          }
          
          console.log('[TOTPVerificationModal] Tokens stored successfully');
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        onClose();
        const storedUser = localStorage.getItem('userData');
        let userRole = '';
        let userDepartment = '';
        if (storedUser) {
          try {
            const userData = JSON.parse(storedUser);
            userRole = userData.role || '';
            userDepartment = userData.department_name || userData.departmentName || userData.department || '';
          } catch (e) {
            console.error('[TOTPVerificationModal] Failed to parse user data:', e);
          }
        }
        const redirectPath = await getDashboardRoute(userRole, userDepartment);
        navigate(redirectPath, { replace: true });
      } else {
        setError(result.error || 'Invalid TOTP');
        showError(result.message || result.error || 'Invalid TOTP. Please try again.');
      }
    } catch (err: any) {
      console.error('[TOTPVerificationModal] verifyOTP error:', err);
      setError(err?.message || err?.error || 'Failed to verify TOTP');
      showError(err?.message || err?.error || 'Failed to verify TOTP. Please try again.');
    
    } finally {
      setIsLoading(false);
    }
  }, [otp, verifyOTP, onClose, currentUserId, initialUserId, checkAuth, navigate]);

  const handleResend = useCallback(async () => {
    const uid = userIdRef.current || currentUserId || initialUserId;
    
    if (!uid) {
      setError('User ID is missing. Please try again.');
      showError('User ID is missing. Please try again.');
      return;
    }
    
    setIsResending(true);
    setError('');

    try {
      await resendOTP(uid, email);
      setTimeLeft(300);
      setTimeLeftExpiry(60);
      showSuccess('TOTP codes are generated by your authenticator app and change every 30 seconds.');
    } catch (err: any) {
      setError(err?.error || 'Failed to resend TOTP');
      showError(err?.error || 'Failed to resend TOTP. Please try again.');
    } finally {
      setIsResending(false);
    }
  }, [resendOTP, email, currentUserId, initialUserId, showSuccess, showError]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
      <div 
        className="fixed inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${cityHallImage})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent" />
      </div>

      <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
        <div className="relative bg-white/95 backdrop-blur-sm shadow-2xl max-w-sm w-full p-5 sm:p-6 transform transition-all">
          {isSuccess ? (
            <div className="text-center py-8">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Verification Successful!</h3>
              <p className="text-gray-600">
                Redirecting to dashboard...
              </p>
            </div>
          ) : (
            <>
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition duration-200"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="flex justify-center mb-4">
                <img 
                  src={logoImage} 
                  alt="City of Kigali" 
                  className="h-20 w-auto"
                />
              </div>

              <h1 className="text-2xl font-bold text-center text-[#056daa] mb-2">
                Authentication
              </h1>

              <p className="text-center text-gray-500 mb-6">
                Open your authenticator app and enter the 6-digit code for<br />
                <span className="font-semibold text-gray-700">{maskEmail(email)}</span>
              </p>

              <div className="flex justify-center gap-2 mb-4" onPaste={handlePaste} onKeyUp={(e) => {
                if (e.key === 'Enter') {
                  handleVerify();
                }
              }}>
                {otp.map((digit, index) => (
                    <input
                      key={index}
                      id={`otp-verify-${index}`}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value.replace(/\D/g, ''))}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      className="w-12 h-12 text-center text-lg font-semibold border-2 border-gray-300 rounded-md focus:outline-none focus:border-[#056daa] focus:ring-1 focus:ring-[#056daa] text-gray-800 bg-white"
                      autoFocus={index === 0}
                    />
                ))}
              </div>

              <p className="text-center text-sm text-gray-500 mb-4">
                • Code refreshes every 30 seconds
              </p>

              {error && (
                <p className="text-center text-sm text-red-600 mb-4">{error}</p>
              )}

              <button
                onClick={handleVerify}
                disabled={otp.join('').length !== 6 || isLoading || !currentUserId}
                className="w-full cok-btn-primary disabled:opacity-50 disabled:cursor-not-allowed mb-4"
              >
                {isLoading ? 'Verifying...' : 'Verify TOTP'}
              </button>

              <div className="text-center mt-4">
                <button 
                  onClick={onClose}
                  className="cok-btn-outlined w-full"
                >
                  Back to Login
                </button>
              </div>

              <p className="text-left text-xs text-gray-400 mt-8">
                ©CITY OF KIGALI PORTAL
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TOTPVerificationModal;
