// ResetPasswordPage - Password reset page
// Page for setting new password after reset request
import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { verifyPasswordResetOTP, resetPassword, setup2FA, verify2FASetup } from '../../core/services/authService';
import { useToast } from '../../core/contexts/ToastContext';

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showSuccess, showError, showWarning } = useToast();
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
        // Error toast is already shown by apiClient interceptor
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
          
          // Check if TOTP setup is required
          if (result.data?.requiresTOTPSetup) {
            setTotpQrCode(result.data.qrCode || '');
            setTotpSecret(result.data.secret || '');
            setShowTOTPSetup(true);
            setTotpStep('verify');
          } else {
            setTimeout(() => {
              navigate('/login');
            }, 2000);
          }
        }
        else { showError(result.message || result.error || 'Failed to reset password'); }
      } catch (err: any) {
        // Error toast is already shown by apiClient interceptor
      } finally { setIsLoading(false); }
    }
  };

  const handleTOTPVerify = async () => {
    const otpString = totpOtp.join('');
    if (otpString.length !== 6) {
      showWarning('Please enter all 6 digits');
      return;
    }

    setIsLoading(true);
    try {
      const result = await verify2FASetup(userId, otpString);
      if (result.status) {
        showSuccess('TOTP setup verified! You can now login with 2FA.');
        setTotpStep('verify');
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        showError(result.message || 'Invalid TOTP. Please try again.');
      }
    } catch (err: any) {
      showError(err?.message || 'Failed to verify TOTP. Please try again.');
    } finally {
      setIsLoading(false);
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

  if (isSuccess && showTOTPSetup) {
    return (
      <div className="min-h-screen flex">
        <div className="hidden lg:flex lg:w-1/2 relative">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url(/cok_hall.jpg)' }}>
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent" />
          </div>
          <div className="relative z-10 flex flex-col justify-end p-7 lg:p-10 text-white w-full h-full">
            <div className="inline-flex items-center px-3 py-1.5 mb-3 bg-white/10 backdrop-blur-sm rounded-full border border-white/20 text-xs font-semibold tracking-wide uppercase w-max cok-badge-animated">
              <span className="mr-1.5 inline-flex h-3 w-3 items-center justify-center rounded-full border border-white/60"><span className="h-1.5 w-1.5 rounded-full bg-white" /></span>
              <span className="font-bold">COK Official Portal</span>
            </div>
            <div className="space-y-2 max-w-xl">
              <h1 className="poetsen-one-regular text-2xl md:text-3xl lg:text-4xl tracking-tight leading-snug">Smart Entry & Service Management</h1>
              <p className="public-sans-regular text-xs md:text-sm text-[#EFF6FF] font-semibold">Serving the City of Kigali with efficiency and security.</p>
            </div>
          </div>
        </div>
        <div className="w-full md:w-full lg:w-1/2 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-6 lg:py-8 bg-white">
          <div className="w-full max-w-lg px-2 sm:px-4">
            <div className="mb-6 flex justify-center">
              <img src="/LOGO_COK.png" alt="City of Kigali" className="h-16 w-auto" />
            </div>
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-green-100 mb-6">
                <svg className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Password updated successfully!</h2>
              <p className="text-xl text-gray-600 mb-6">Setup Two-Factor Authentication</p>
              <p className="text-sm text-gray-600 mb-6">
                Scan the QR code below with your authenticator app (Google Authenticator, Authy, etc.)
              </p>
              
              {totpQrCode && (
                <div className="flex justify-center mb-4">
                  <img src={totpQrCode} alt="TOTP QR Code" className="w-48 h-48 border border-gray-200 rounded-lg" />
                </div>
              )}
              
              {totpSecret && (
                <div className="text-center mb-6">
                  <p className="text-xs text-gray-500 mb-1">Can't scan? Enter this secret manually:</p>
                  <code className="text-sm bg-gray-100 px-2 py-1 rounded">{totpSecret}</code>
                </div>
              )}

              {totpStep === 'verify' && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Enter 6-digit code to verify</label>
                  <div className="flex justify-center gap-2">
                    {[0,1,2,3,4,5].map((i) => (
                      <input
                        key={i}
                        id={`totp-setup-${i}`}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={totpOtp[i] || ''}
                        onChange={(e) => handleTOTPChange(i, e.target.value.replace(/\D/g, ''))}
                        onKeyDown={(e) => handleTOTPKeyDown(i, e)}
                        className="w-12 h-12 text-center text-lg font-semibold border-2 border-gray-300 rounded-md focus:outline-none focus:border-[#056daa] focus:ring-1 focus:ring-[#056daa] text-gray-800 bg-white"
                        autoFocus={i === 0}
                      />
                    ))}
                  </div>
                  <button
                    onClick={handleTOTPVerify}
                    disabled={totpOtp.join('').length !== 6 || isLoading}
                    className="mt-4 w-full cok-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Verifying...' : 'Verify & Enable 2FA'}
                  </button>
                </div>
              )}

              <p className="text-sm text-gray-500">Redirecting to login...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex">
        <div className="hidden lg:flex lg:w-1/2 relative">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url(/cok_hall.jpg)' }}>
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent" />
          </div>
          <div className="relative z-10 flex flex-col justify-end p-7 lg:p-10 text-white w-full h-full">
            <div className="inline-flex items-center px-3 py-1.5 mb-3 bg-white/10 backdrop-blur-sm rounded-full border border-white/20 text-xs font-semibold tracking-wide uppercase w-max cok-badge-animated">
              <span className="mr-1.5 inline-flex h-3 w-3 items-center justify-center rounded-full border border-white/60"><span className="h-1.5 w-1.5 rounded-full bg-white" /></span>
              <span className="font-bold">COK Official Portal</span>
            </div>
            <div className="space-y-2 max-w-xl">
              <h1 className="poetsen-one-regular text-2xl md:text-3xl lg:text-4xl tracking-tight leading-snug">Smart Entry & Service Management</h1>
              <p className="public-sans-regular text-xs md:text-sm text-[#EFF6FF] font-semibold">Serving the City of Kigali with efficiency and security.</p>
            </div>
          </div>
        </div>
        <div className="w-full md:w-full lg:w-1/2 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-6 lg:py-8 bg-white">
          <div className="w-full max-w-lg px-2 sm:px-4">
            <div className="mb-6 flex justify-center">
              <img src="/LOGO_COK.png" alt="City of Kigali" className="h-16 w-auto" />
            </div>
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-green-100 mb-6">
                <svg className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Password updated</h2>
              <p className="text-xl text-gray-600 mb-8">successfully! Redirecting to login...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 relative">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url(/cok_hall.jpg)' }}>
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent" />
        </div>
        <div className="relative z-10 flex flex-col justify-end p-7 lg:p-10 text-white w-full h-full">
          <div className="inline-flex items-center px-3 py-1.5 mb-3 bg-white/10 backdrop-blur-sm rounded-full border border-white/20 text-xs font-semibold tracking-wide uppercase w-max cok-badge-animated">
            <span className="mr-1.5 inline-flex h-3 w-3 items-center justify-center rounded-full border border-white/60"><span className="h-1.5 w-1.5 rounded-full bg-white" /></span>
            <span className="font-bold">COK Official Portal</span>
          </div>
          <div className="space-y-2 max-w-xl">
            <h1 className="poetsen-one-regular text-2xl md:text-3xl lg:text-4xl tracking-tight leading-snug">Smart Entry & Service Management</h1>
            <p className="public-sans-regular text-xs md:text-sm text-[#EFF6FF] font-semibold">Serving the City of Kigali with efficiency and security.</p>
          </div>
        </div>
      </div>
      <div className="w-full md:w-full lg:w-1/2 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-6 lg:py-8 bg-white">
        <div className="w-full max-w-lg px-2 sm:px-4 space-y-5 sm:space-y-6">
          <Link to="/forgot-password" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6 sm:mb-8 transition-colors">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>Back
          </Link>
          <div className="mb-6 flex justify-center">
            <img src="/LOGO_COK.png" alt="City of Kigali" className="h-16 w-auto" />
          </div>
          <h2 className="text-xl lg:text-2xl font-bold text-gray-900 mb-2">Update Credentials</h2>
          <p className="text-sm text-gray-600 mb-6">Secure your account for KSESM access</p>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg"><p className="text-sm text-red-600 text-center">{error}</p></div>}
                  {step === 'verify' && (
                  <div>
                    <label htmlFor="otp" className="block text-xs lg:text-sm font-medium text-gray-700 mb-1">VERIFICATION CODE</label>
                    <div className="flex justify-center gap-2 mb-4">
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
                          className="w-12 h-12 text-center text-lg font-semibold border-2 border-gray-300 rounded-md focus:outline-none focus:border-[#056daa] focus:ring-1 focus:ring-[#056daa] text-gray-800 bg-white"
                        />
                      ))}
                    </div>
                    <p className="text-xs lg:text-sm text-gray-500 mt-1.5 lg:mt-2 text-center">Enter the code sent to your email</p>
                  </div>
                )}
            <div>
              <label htmlFor="new-password" className="block text-xs lg:text-sm font-medium text-gray-700 mb-1">NEW PASSWORD</label>
              <div className="relative">
                <input id="new-password" name="new-password" type={showPassword ? "text" : "password"} required className="cok-auth-input pl-10 pr-10 py-3 placeholder:text-gray-400" placeholder="SuperSecureP@ss123" value={newPassword} onChange={handlePasswordChange} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700">
                  {showPassword ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268 2.943-9.542-7z" /></svg> : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>}
                </button>
              </div>
            </div>
            {newPassword && (
              <div className="space-y-2">
                <div className="flex items-center justify-between"><span className="text-sm text-gray-600">Password Strength</span><span className={`text-sm font-medium ${getStrengthColor()}`}>{getStrengthText()}</span></div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center space-x-2"><span className={passwordStrength.hasMinLength ? 'text-green-500' : 'text-gray-400'}>{passwordStrength.hasMinLength ? '✓' : '○'}</span><span className={passwordStrength.hasMinLength ? 'text-gray-700' : 'text-gray-400'}>8+ Characters</span></div>
                  <div className="flex items-center space-x-2"><span className={passwordStrength.hasUppercase ? 'text-green-500' : 'text-gray-400'}>{passwordStrength.hasUppercase ? '✓' : '○'}</span><span className={passwordStrength.hasUppercase ? 'text-gray-700' : 'text-gray-400'}>1 Uppercase</span></div>
                  <div className="flex items-center space-x-2"><span className={passwordStrength.hasNumber ? 'text-green-500' : 'text-gray-400'}>{passwordStrength.hasNumber ? '✓' : '○'}</span><span className={passwordStrength.hasNumber ? 'text-gray-700' : 'text-gray-400'}>1 Number</span></div>
                  <div className="flex items-center space-x-2"><span className={passwordStrength.hasSymbol ? 'text-green-500' : 'text-gray-400'}>{passwordStrength.hasSymbol ? '✓' : '○'}</span><span className={passwordStrength.hasSymbol ? 'text-gray-700' : 'text-gray-400'}>1 Symbol</span></div>
                </div>
              </div>
            )}
            <div>
              <label htmlFor="confirm-password" className="block text-xs lg:text-sm font-medium text-gray-700 mb-1">CONFIRM NEW PASSWORD</label>
              <input id="confirm-password" name="confirm-password" type="password" required className="cok-auth-input pl-10 pr-10 py-3 placeholder:text-gray-400" placeholder="Re-enter password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            <button type="submit" disabled={isLoading || (step === 'reset' && (passwordStrength.score < 4 || newPassword !== confirmPassword))} className="w-full cok-btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
              {isLoading ? <span className="flex items-center justify-center"><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>{step === 'verify' ? 'Verifying...' : 'Updating...'}</span> : step === 'verify' ? 'VERIFY CODE' : 'UPDATE PASSWORD'}
            </button>
          </form>
          <div className="mt-8 text-center"><p className="text-sm text-gray-500">Need help? <button className="text-blue-600 hover:text-blue-700 font-medium">Contact IT Support</button></p></div>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
