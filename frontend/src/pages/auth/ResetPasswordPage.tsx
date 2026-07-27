// ResetPasswordPage - Password reset page
// Page for setting new password after reset request
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { verifyPasswordResetOTP, resetPassword, setup2FA, verify2FASetup } from '../../core/services/authService';
import { useToast } from '../../core/contexts/ToastContext';

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const token = searchParams.get('token');
  const userIdFromUrl = searchParams.get('userId');

  const userId = userIdFromUrl || sessionStorage.getItem('resetUserId') || '';

  const [otp, setOtp] = useState('');
  const [tempToken, setTempToken] = useState(() => {
    return token || sessionStorage.getItem('resetTempToken') || '';
  });
  const [step, setStep] = useState(() => (token || userIdFromUrl || sessionStorage.getItem('resetUserId')) ? 'reset' : 'verify');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState({ hasMinLength: false, hasUppercase: false, hasNumber: false, hasSymbol: false, score: 0 });

  const [showTOTPSetup, setShowTOTPSetup] = useState(false);
  const [totpQrCode, setTotpQrCode] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [totpStep, setTotpStep] = useState<'setup' | 'verify'>('setup');
  const [totpOtp, setTotpOtp] = useState(['', '', '', '', '', '']);
  const [totpIsLoading, setTotpIsLoading] = useState(false);
  const [totpError, setTotpError] = useState('');
  const [totpSuccess, setTotpSuccess] = useState(false);

  useEffect(() => {
    if (userIdFromUrl) {
      sessionStorage.setItem('resetUserId', userIdFromUrl);
    }
  }, [userIdFromUrl]);

  const checkPasswordStrength = (password: string) => {
    const strength = { hasMinLength: password.length >= 8, hasUppercase: /[A-Z]/.test(password), hasNumber: /[0-9]/.test(password), hasSymbol: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(password) };
    const score = Object.values(strength).filter(Boolean).length;
    setPasswordStrength({ ...strength, score });
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => { setNewPassword(e.target.value); checkPasswordStrength(e.target.value); };
  const getStrengthText = () => { if (passwordStrength.score === 0) return ''; if (passwordStrength.score <= 2) return 'Weak'; if (passwordStrength.score === 3) return 'Medium'; return 'Strong'; };
  const getStrengthColor = () => { if (passwordStrength.score <= 2) return 'text-red-500'; if (passwordStrength.score === 3) return 'text-yellow-500'; return 'text-green-500'; };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (step === 'verify') {
      if (!userId || !otp) { showWarning('User ID and OTP are required'); return; }
      setIsLoading(true);
      try {
        const result = await verifyPasswordResetOTP(userId, otp);
        if (result.status && result.data?.signature) {
          setTempToken(result.data.signature);
          setStep('reset');
          showSuccess('OTP verified! Please enter your new password.');
        }
        else { showError(result.message || 'Invalid OTP. Please try again.'); }
      } catch (err: any) {
        console.log(err.message)
      } finally { setIsLoading(false); }
    } else {
      if (!userId) { showError('User ID is missing. Please start the password reset process again.'); return; }
      if (!tempToken) { showError('Verification token is missing. Please start the password reset process again.'); return; }
      if (newPassword !== confirmPassword) { showWarning("Passwords don't match"); return; }
      setIsLoading(true);
      try {
        const result = await resetPassword(userId, tempToken, newPassword, confirmPassword);
        if (result.status) {
          setIsSuccess(true);
          showSuccess('Password reset successfully!');
          sessionStorage.removeItem('resetUserId');
          sessionStorage.removeItem('resetTempToken');

          if (result.data?.requiresTOTPSetup) {
            setTotpQrCode(result.data.qrCode || '');
            setTotpSecret(result.data.secret || '');
            setShowTOTPSetup(true);
            setTotpStep('setup');
          } else {
            setTimeout(() => {
              navigate('/login');
            }, 2000);
          }
        }
        else { showError(result.message || result.error || 'Failed to reset password'); }
      } catch (err: any) {
         console.log(err.message)
      } finally { setIsLoading(false); }
    }
  };

  const handleTOTPVerify = async () => {
    const otpString = totpOtp.join('');
    if (otpString.length !== 6) {
      showWarning('Please enter all 6 digits');
      return;
    }

    setTotpIsLoading(true);
    setTotpError('');
    try {
      const result = await verify2FASetup(userId, otpString);
      if (result.status) {
        setTotpSuccess(true);
        showSuccess('2FA setup verified! You can now login with two-factor authentication.');
      } else {
        setTotpError(result.message || 'Invalid TOTP. Please try again.');
        showError(result.message || 'Invalid TOTP. Please try again.');
      }
    } catch (err: any) {
       console.log(err.message)
      setTotpError(err?.message || err?.error || 'Failed to verify TOTP. Please try again.');
      showError(err?.message || err?.error || 'Failed to verify TOTP. Please try again.');
    } finally {
      setTotpIsLoading(false);
    }
  };

  const handleTOTPChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newOtp = [...totpOtp];
    newOtp[index] = value;
    setTotpOtp(newOtp);
    if (value && index < 5) {
      const next = document.getElementById(`totp-setup-${index + 1}`);
      if (next) next.focus();
    }
  };

  const handleTOTPKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !totpOtp[index] && index > 0) {
      const prev = document.getElementById(`totp-setup-${index - 1}`);
      if (prev) prev.focus();
    }
  };

  const handleTOTPPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6).split('');
    const newOtp = [...totpOtp];
    pastedData.forEach((value, index) => {
      if (index < 6 && /[0-9]/.test(value)) newOtp[index] = value;
    });
    setTotpOtp(newOtp);
  };

  const maskSecret = (secret: string) => {
    if (!secret || secret.length <= 8) return secret || '';
    return secret.slice(0, 8) + '••••••••';
  };

  const copyToClipboard = (text: string, label: string = 'Secret') => {
    navigator.clipboard.writeText(text).then(() => {
      showInfo(`${label} copied to clipboard`);
    }).catch(() => {
      showError('Failed to copy to clipboard');
    });
  };

  const cityHallImage = '/cok_hall.jpg';
  const logoImage = '/LOGO_COK.png';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${cityHallImage})` }}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent" />
      </div>

      <div className="flex min-h-full items-center justify-center p-2 sm:p-3 md:p-4">
        <div className="relative bg-white/95 backdrop-blur-sm shadow-2xl max-w-sm w-full p-4 sm:p-5 md:p-6 transform transition-all">
          {showTOTPSetup && !totpSuccess ? (
            <>
              <button
                onClick={() => setShowTOTPSetup(false)}
                className="absolute top-2 right-2 sm:top-4 sm:right-4 text-gray-400 hover:text-gray-600 transition duration-200"
              >
                <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="flex justify-center mb-3">
                <img src={logoImage} alt="City of Kigali" className="h-12 w-auto sm:h-14" />
              </div>

              <h1 className="text-lg sm:text-xl font-bold text-center text-[#056daa] mb-1" style={{ fontWeight: 700 }}>
                Two-Factor Authentication
              </h1>

              <p className="text-center text-gray-600 text-xs sm:text-sm mb-4">
                Set up your authenticator app to secure your account
              </p>

              {totpQrCode && (
                <div className="flex justify-center mb-3">
                  <img src={totpQrCode} alt="TOTP QR Code" className="w-36 h-36 sm:w-44 sm:h-44 md:w-48 md:h-48 border border-gray-200 rounded-lg" />
                </div>
              )}

              {totpSecret && (
                <div className="text-center mb-3">
                  <p className="text-xs text-gray-500 mb-1">
                    Can't scan? Enter this secret manually
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <code
                      onClick={() => copyToClipboard(totpSecret, 'Secret')}
                      className="text-xs sm:text-sm cursor-pointer bg-gray-100 px-2 py-1 rounded hover:bg-gray-200 transition-colors select-all"
                      title="Click to copy"
                    >
                      {totpSecret.slice(0, 20)}{totpSecret.length > 20 ? '...' : ''}
                    </code>
                    <button
                      onClick={() => copyToClipboard(totpSecret, 'Secret')}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                      title="Copy secret"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2 text-center">
                  Enter 6-digit code from your authenticator app
                </label>
                <div className="flex justify-center gap-1.5 sm:gap-2" onPaste={handleTOTPPaste}>
                  {[0,1,2,3,4,5].map((i) => (
                    <input
                      key={i}
                      id={`totp-setup-${i}`}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={totpOtp[i] || ''}
                      onChange={(e) => handleTOTPChange(i, e.target.value.replace(/\D/g, ''))}
                      onKeyDown={(e) => handleTOTPKeyDown(i, e)}
                      className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 text-center text-base sm:text-lg font-semibold border-2 border-gray-300 rounded-md focus:outline-none focus:border-[#056daa] focus:ring-1 focus:ring-[#056daa] text-gray-800 bg-white"
                      autoFocus={i === 0}
                    />
                  ))}
                </div>
              </div>

              {totpError && (
                <p className="text-center text-xs sm:text-sm text-red-600 mb-3">{totpError}</p>
              )}

              <button
                onClick={handleTOTPVerify}
                disabled={totpOtp.join('').length !== 6 || totpIsLoading}
                className="w-full cok-btn-primary disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm py-2.5 sm:py-3"
              >
                {totpIsLoading ? 'Verifying...' : 'Verify & Enable 2FA'}
              </button>

              <div className="text-center mt-4">
                <p className="text-xs text-gray-400">
                  Code refreshes every 30 seconds
                </p>
              </div>
            </>
          ) : totpSuccess ? (
            <div className="text-center py-6">
              <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-green-100 mb-3">
                <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">2FA Enabled!</h2>
              <p className="text-sm text-gray-600 mb-4">
                Your account is now secured with two-factor authentication.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="cok-btn-primary w-full"
              >
                Go to Login
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => navigate('/forgot-password')}
                className="absolute top-2 right-2 sm:top-4 sm:right-4 text-gray-400 hover:text-gray-600 transition duration-200"
              >
                <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>

              <div className="flex justify-center mb-3">
                <img src={logoImage} alt="City of Kigali" className="h-12 w-auto sm:h-14" />
              </div>

              <h1 className="text-lg sm:text-xl font-bold text-center text-[#056daa] mb-1" style={{ fontWeight: 700, letterSpacing: '-0.5px' }}>
                Set New Password
              </h1>

              <p className="text-center text-gray-600 text-xs sm:text-sm mb-4">
                Create a secure password for your account
              </p>

              {error && (
                <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-xs sm:text-sm text-red-600 text-center">{error}</p>
                </div>
              )}

              {step === 'verify' && (
                <>
                  <label htmlFor="otp" className="block text-xs sm:text-sm font-medium text-gray-700 mb-2 text-center">VERIFICATION CODE</label>
                  <div className="flex justify-center gap-1.5 sm:gap-2 mb-3">
                    {[0,1,2,3,4].map((i) => (
                      <input
                        key={i}
                        id={`otp-reset-${i}`}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={otp[i] || ''}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          const newOtp = otp.split('');
                          newOtp[i] = val;
                          setOtp(newOtp.join(''));
                          if (val && i < 4) {
                            const next = document.getElementById(`otp-reset-${i+1}`);
                            if (next) next.focus();
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Backspace' && !otp[i] && i > 0) {
                            const prev = document.getElementById(`otp-reset-${i-1}`);
                            if (prev) prev.focus();
                          }
                        }}
                        className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 text-center text-base sm:text-lg font-semibold border-2 border-gray-300 rounded-md focus:outline-none focus:border-[#056daa] focus:ring-1 focus:ring-[#056daa] text-gray-800 bg-white"
                        autoFocus={i === 0}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5 text-center">Enter the code sent to your email</p>
                </>
              )}

              {step === 'reset' && (
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div>
                    <label htmlFor="new-password" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">NEW PASSWORD</label>
                    <div className="relative">
                      <input
                        id="new-password"
                        name="new-password"
                        type={showPassword ? "text" : "password"}
                        required
                        className="cok-auth-input pl-9 sm:pl-10 pr-9 py-2.5 sm:py-3 placeholder:text-gray-400 text-sm sm:text-base"
                        placeholder="Enter new password"
                        value={newPassword}
                        onChange={handlePasswordChange}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-2 sm:pr-3 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? (
                          <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                        ) : (
                          <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        )}
                      </button>
                    </div>

                    {newPassword && (
                      <div className="mt-1.5">
                        <div className="flex gap-1 mb-1">
                          {[1, 2, 3, 4].map((level) => (
                            <div
                              key={level}
                              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                                level <= passwordStrength.score ? (passwordStrength.score <= 2 ? 'bg-red-500' : passwordStrength.score === 3 ? 'bg-yellow-500' : 'bg-green-500') : 'bg-gray-200'
                              }`}
                            />
                          ))}
                        </div>
                        <p className={`text-xs font-medium ${getStrengthColor()}`}>{getStrengthText()}</p>
                      </div>
                    )}
                  </div>

                  {newPassword && (
                    <div className="bg-gray-50 rounded-lg p-2.5 sm:p-3 text-xs space-y-1">
                      <p className="font-medium text-gray-700 mb-1.5">Password must have:</p>
                      <div className={`flex items-center ${passwordStrength.hasMinLength ? 'text-green-600' : 'text-gray-500'}`}>
                        <span className="mr-1">{passwordStrength.hasMinLength ? '✓' : '○'}</span>At least 8 characters
                      </div>
                      <div className={`flex items-center ${passwordStrength.hasUppercase ? 'text-green-600' : 'text-gray-500'}`}>
                        <span className="mr-1">{passwordStrength.hasUppercase ? '✓' : '○'}</span>One uppercase letter (A-Z)
                      </div>
                      <div className={`flex items-center ${passwordStrength.hasNumber ? 'text-green-600' : 'text-gray-500'}`}>
                        <span className="mr-1">{passwordStrength.hasNumber ? '✓' : '○'}</span>One number (0-9)
                      </div>
                      <div className={`flex items-center ${passwordStrength.hasSymbol ? 'text-green-600' : 'text-gray-500'}`}>
                        <span className="mr-1">{passwordStrength.hasSymbol ? '✓' : '○'}</span>One special character
                      </div>
                    </div>
                  )}

                  <div>
                    <label htmlFor="confirm-password" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">CONFIRM PASSWORD</label>
                    <input
                      id="confirm-password"
                      name="confirm-password"
                      type="password"
                      required
                      className="cok-auth-input pl-9 sm:pl-10 pr-9 py-2.5 sm:py-3 placeholder:text-gray-400 text-sm sm:text-base"
                      placeholder="Re-enter new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    {confirmPassword && newPassword !== confirmPassword && (
                      <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || (step === 'reset' && (passwordStrength.score < 4 || newPassword !== confirmPassword))}
                    className="w-full cok-btn-primary disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base py-2.5 sm:py-3"
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-2 sm:mr-3 h-4 w-4 sm:h-5 sm:w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        Resetting...
                      </span>
                    ) : 'Reset Password'}
                  </button>
                </form>
              )}

              <div className="mt-4 sm:mt-5">
                <button
                  onClick={() => navigate('/login')}
                  className="cok-btn-outlined w-full text-xs sm:text-sm py-2 sm:py-2.5"
                >
                  Back to Login
                </button>
              </div>

              <p className="text-left text-xs text-gray-400 mt-4 sm:mt-5">
                © {new Date().getFullYear()} City of Kigali. All rights reserved.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;