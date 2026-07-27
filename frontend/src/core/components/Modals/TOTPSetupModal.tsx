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
  const { showSuccess, showError, showWarning } = useToast();
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
              <h3 className="text-2xl font-bold text-gray-900 mb-2">2FA Setup Complete!</h3>
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
                Setup Two-Factor Authentication
              </h1>

              <p className="text-center text-gray-500 mb-6">
                Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.) and enter the 6-digit code
              </p>

              {qrCode && (
                <div className="flex justify-center mb-4">
                  <img
                    src={qrCode}
                    alt="TOTP QR Code"
                    className="w-48 h-48 border border-gray-200 rounded-lg"
                  />
                </div>
              )}

              {secret && (
                <div className="text-center mb-4">
                  <p className="text-xs text-gray-500 mb-1">
                    Can't scan? Enter this secret manually:
                  </p>
                  <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                    {secret}
                  </code>
                </div>
              )}

              <div className="flex justify-center gap-2 mb-4" onPaste={handlePaste} onKeyUp={(e) => {
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
                disabled={otp.join('').length !== 6 || isLoading}
                className="w-full cok-btn-primary disabled:opacity-50 disabled:cursor-not-allowed mb-4"
              >
                {isLoading ? 'Verifying...' : 'Verify & Enable 2FA'}
              </button>

              <div className="text-center mt-4">
                <button 
                  onClick={onClose}
                  className="cok-btn-outlined w-full"
                >
                  Cancel
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

export default TOTPSetupModal;
