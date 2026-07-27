// TOTPSetupModal - TOTP setup modal for old accounts without 2FA
// Shows QR code and verifies TOTP, then completes login

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getDashboardRoute } from '../Layout/layoutUtils';

interface TOTPSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  userId?: string;
  qrCode?: string;
  secret?: string;
}

const TOTPSetupModal: React.FC<TOTPSetupModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess,
  userId: initialUserId = '',
  qrCode: initialQrCode = '',
  secret: initialSecret = ''
}) => {
  const { verifyOTP, checkAuth } = useAuth();
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const [userId, setUserId] = useState(initialUserId);
  const [qrCode, setQrCode] = useState(initialQrCode);
  const [secret, setSecret] = useState(initialSecret);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timeLeft, setTimeLeft] = useState(300);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();

  const cityHallImage = '/cok_hall.jpg';
  const logoImage = '/LOGO_COK.png';

  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setUserId(initialUserId);
        setQrCode(initialQrCode);
        setSecret(initialSecret);
        setOtp(['', '', '', '', '', '']);
        setTimeLeft(300);
        setIsSuccess(false);
        setError('');
      }, 300);
    }
  }, [isOpen, initialUserId, initialQrCode, initialSecret]);

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
      const nextInput = document.getElementById(`totp-setup-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`totp-setup-${index - 1}`);
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

  const handleVerify = async () => {
    const otpString = otp.join('');
    
    if (!userId) {
      setError('User ID is missing. Please try again.');
      showError('User ID is missing. Please try again.');
      return;
    }
    
    if (otpString.length !== 6) {
      showWarning('Please enter all 6 digits');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await verifyOTP(String(userId), String(otpString));
      
      console.log('[TOTPSetupModal] verifyOTP result:', JSON.stringify(result, null, 2));
      
      const hasAccessToken = !!result.data?.accessToken;
      const isVerified = (result.status === true || result.success === true) && (hasAccessToken || result.data?.verified === true);
      
      if (isVerified) {
        setIsSuccess(true);
        showSuccess('TOTP verified successfully! 2FA is now enabled.');
        
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
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (onSuccess) {
          onSuccess();
        }
        
        const storedUser = localStorage.getItem('userData');
        let userRole = '';
        let userDepartment = '';
        if (storedUser) {
          try {
            const userData = JSON.parse(storedUser);
            userRole = userData.role || '';
            userDepartment = userData.department_name || userData.departmentName || userData.department || '';
          } catch (e) {
            console.error('[TOTPSetupModal] Failed to parse user data:', e);
          }
        }
        const redirectPath = await getDashboardRoute(userRole, userDepartment);
        navigate(redirectPath, { replace: true });
      } else {
        setError(result.error || 'Invalid TOTP');
        showError(result.message || result.error || 'Invalid TOTP. Please try again.');
      }
    } catch (err: any) {
      console.error('[TOTPSetupModal] verifyOTP error:', err);
      setError(err?.message || err?.error || 'Failed to verify TOTP');
      showError(err?.message || err?.error || 'Failed to verify TOTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

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

  const copyToClipboard = (text: string, label: string = 'Secret') => {
    navigator.clipboard.writeText(text).then(() => {
      showInfo(`${label} copied to clipboard`);
    }).catch(() => {
      showError('Failed to copy to clipboard');
    });
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

      <div className="flex min-h-full items-center justify-center p-2 sm:p-3 md:p-4">
        <div className="relative bg-white/95 backdrop-blur-sm shadow-2xl max-w-sm w-full p-4 sm:p-5 md:p-6 transform transition-all">
          {isSuccess ? (
            <div className="text-center py-6 sm:py-8">
              <div className="mx-auto flex items-center justify-center h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-green-100 mb-3 sm:mb-4">
                <svg className="h-7 w-7 sm:h-8 sm:w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">2FA Setup Complete!</h3>
              <p className="text-sm sm:text-base text-gray-600">Redirecting to dashboard...</p>
            </div>
          ) : (
            <>
              <button
                onClick={onClose}
                className="absolute top-2 right-2 sm:top-4 sm:right-4 text-gray-400 hover:text-gray-600 transition duration-200"
              >
                <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="flex justify-center mb-3">
                <img 
                  src={logoImage} 
                  alt="City of Kigali" 
                  className="h-12 w-auto sm:h-14 md:h-16"
                />
              </div>

              <h1 className="text-base sm:text-lg md:text-xl font-bold text-center text-[#056daa] mb-1" style={{ fontWeight: 700 }}>
                Setup Two-Factor Authentication
              </h1>

              <p className="text-center text-gray-500 mb-4 sm:mb-6 text-xs sm:text-sm">
                Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.) and enter the 6-digit code
              </p>

              {qrCode && (
                <div className="flex justify-center mb-3">
                  <img
                    src={qrCode}
                    alt="TOTP QR Code"
                    className="w-36 h-36 sm:w-44 sm:h-44 md:w-48 md:h-48 border border-gray-200 rounded-lg"
                  />
                </div>
              )}

              {secret && (
                <div className="text-center mb-3 sm:mb-4">
                  <p className="text-xs text-gray-500 mb-1 sm:mb-2">
                    Can't scan? Enter this secret manually:
                  </p>
                  <div className="flex items-center justify-center gap-1 sm:gap-2">
                    <code
                      onClick={() => copyToClipboard(secret, 'Secret')}
                      className="text-xs sm:text-sm cursor-pointer bg-gray-100 px-2 py-1 rounded hover:bg-gray-200 transition-colors select-all"
                      title="Click to copy"
                    >
                      {secret.slice(0, 20)}{secret.length > 20 ? '...' : ''}
                    </code>
                    <button
                      onClick={() => copyToClipboard(secret, 'Secret')}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                      title="Copy secret to clipboard"
                    >
                      <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-center gap-1.5 sm:gap-2 mb-4 sm:mb-6" onPaste={handlePaste} onKeyUp={(e) => {
                if (e.key === 'Enter') {
                  handleVerify();
                }
              }}>
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    id={`totp-setup-${index}`}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 text-center text-base sm:text-lg font-semibold border-2 border-gray-300 rounded-md focus:outline-none focus:border-[#056daa] focus:ring-1 focus:ring-[#056daa] text-gray-800 bg-white"
                    autoFocus={index === 0}
                  />
                ))}
              </div>

              <p className="text-center text-xs sm:text-sm text-gray-500 mb-3 sm:mb-4">
                • Code refreshes every 30 seconds
              </p>

              {error && (
                <p className="text-center text-xs sm:text-sm text-red-600 mb-3 sm:mb-4">{error}</p>
              )}

              <button
                onClick={handleVerify}
                disabled={otp.join('').length !== 6 || isLoading}
                className="w-full cok-btn-primary disabled:opacity-50 disabled:cursor-not-allowed mb-3 sm:mb-4 text-xs sm:text-sm py-2.5 sm:py-3"
              >
                {isLoading ? 'Verifying...' : 'Verify & Enable 2FA'}
              </button>

              <div className="text-center mt-4">
                <button 
                  onClick={onClose}
                  className="cok-btn-outlined w-full text-xs sm:text-sm py-2 sm:py-2.5"
                >
                  Cancel
                </button>
              </div>

              <p className="text-left text-xs text-gray-400 mt-4 sm:mt-5">
                ©CITY OF KIGALI PORTAL
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TOTPSetupModal;