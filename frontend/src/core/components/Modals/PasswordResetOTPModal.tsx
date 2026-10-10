import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { verifyPasswordResetOTP } from '../../services/authService';
import { useToast } from '../../contexts/ToastContext';
import OverlayCloseButton from '../overlay/OverlayCloseButton';

interface PasswordResetOTPModalProps {
  isOpen: boolean;
  onClose: () => void;
  email?: string;
  onVerified?: (userId: string, signature: string) => void;
}

const PasswordResetOTPModal: React.FC<PasswordResetOTPModalProps> = ({ isOpen, onClose, email: initialEmail = '', onVerified }) => {
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState(['', '', '', '', '']);
  const [timeLeft, setTimeLeft] = useState(300);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [userId, setUserId] = useState('');

  const { showError, showWarning, showSuccess } = useToast();

  
  
  const navigate = useNavigate();

  const cityHallImage = '/cok_hall.jpg';
  const logoImage = '/LOGO_COK.png';

  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setEmail(initialEmail);
        setOtp(['', '', '', '', '']);
        setTimeLeft(300);
        setError('');
        setIsSuccess(false);
        setUserId('');
      }, 300);
      console.log(userId)
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
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isOpen, timeLeft, isSuccess]);

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError('');

    if (value && index < 4) {
      const nextInput = document.getElementById(`otp-reset-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-reset-${index - 1}`);
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
      showWarning('Please enter all 5 digits');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const storedUserId = sessionStorage.getItem('resetUserId');
      if (!storedUserId) {
        showError('Session expired. Please start the process again.');
        setIsLoading(false);
        return;
      }

      const result = await verifyPasswordResetOTP(storedUserId, otpString);
      
      if (result.status && result.data?.signature) {
        setIsSuccess(true);
        showSuccess('OTP verified successfully! Proceeding to reset password...');
        
        sessionStorage.setItem('resetTempToken', result.data.signature);
        
        if (onVerified) {
          onVerified(storedUserId, result.data.signature);
        } else {
          setTimeout(() => {
            onClose();
            navigate(`/reset-password?userId=${storedUserId}`);
          }, 1500);
        }
      } else {
        showError(result.message || result.error || 'Invalid OTP. Please try again.');
      }
    } catch (err: any) {
    
      showWarning(err.error || err.message || "Try again later!" )
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    setError('');

    try {
      const storedUserId = sessionStorage.getItem('resetUserId');
      const storedEmail = sessionStorage.getItem('resetEmail');
      
      if (!storedUserId || !storedEmail) {
        showError('Session expired. Please start the process again.');
        setIsResending(false);
        return;
      }

      setTimeLeft(300);
    } catch (err: any) {
    } finally {
      setIsResending(false);
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
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Verification Successful!</h3>
              <p className="text-gray-600">
                Redirecting to login...
              </p>
            </div>
          ) : (
            <>
              <div className="absolute top-4 right-4">
                <OverlayCloseButton onClick={onClose} disabled={isLoading || isResending} />
              </div>

              <div className="flex justify-center mb-4">
                <img 
                  src={logoImage} 
                  alt="City of Kigali" 
                  className="h-20 w-auto"
                />
              </div>

              <h1 className="text-2xl font-bold text-center text-[#056daa] mb-2">
                Reset Your Password
              </h1>

            

              <p className="text-center text-gray-500 mb-6">
                We've sent a 5-digit verification code to<br />
                <span className="font-semibold text-gray-700">{maskEmail(email)}</span>
              </p>

              <div className="flex justify-center gap-2 mb-4" onPaste={handlePaste}>
                {otp.map((digit, index) => (
                    <input
                      key={index}
                      id={`otp-reset-${index}`}
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
                - OTP expires in {formatTime(timeLeft)}
              </p>

              {error && (
                <p className="text-center text-sm text-red-600 mb-4">{error}</p>
              )}

              <button
                onClick={handleVerify}
                disabled={otp.join('').length !== 5 || isLoading}
                className="w-full cok-btn-primary disabled:opacity-50 disabled:cursor-not-allowed mb-4"
              >
                {isLoading ? 'Verifying...' : 'Verify Your OTP'}
              </button>

              <div className="text-center">
                <button
                  onClick={handleResend}
                  disabled={timeLeft > 0 || isResending}
                  className="w-full cok-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResending ? 'Resending...' : timeLeft > 0 ? `Resend OTP (${formatTime(timeLeft)})` : 'Resend OTP'}
                </button>
              </div>

              <p className="text-left text-xs text-gray-400 mt-8">
                (c) CITY OF KIGALI PORTAL
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PasswordResetOTPModal;
