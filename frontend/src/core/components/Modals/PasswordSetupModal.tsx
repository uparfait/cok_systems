// PasswordSetupModal - Password setup modal after OTP verification
// For first-time users to set their password

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface PasswordSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  userId?: string;
  email?: string;
  otp?: string;
}

const PasswordSetupModal: React.FC<PasswordSetupModalProps> = ({ isOpen, onClose, onSuccess, userId = '', email = '', otp = '' }) => {
  const { activateAccount } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  
  const [passwordStrength, setPasswordStrength] = useState({
    hasMinLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSymbol: false,
    score: 0
  });
  
  const navigate = useNavigate();

  // Background images
  const cityHallImage = '/cok_hall.jpg';
  const logoImage = '/LOGO_COK.jpg';

  // Password requirements check
  const checkPasswordStrength = (password: string) => {
    const strength = {
      hasMinLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSymbol: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
    };
    
    const score = Object.values(strength).filter(Boolean).length;

    setPasswordStrength({
      ...strength,
      hasLowercase: /[a-z]/.test(password),
      score
    });
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    if (passwordStrength.score <= 2) return 'bg-red-500';
    if (passwordStrength.score === 3) return 'bg-yellow-500';
    if (passwordStrength.score === 4) return 'bg-green-500';
    return '';
  };

  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes
      setTimeout(() => {
        setNewPassword('');
        setConfirmPassword('');
        setShowPassword(false);
        setIsLoading(false);
        setIsSuccess(false);
        setError('');
        setPasswordStrength({
          hasMinLength: false,
          hasUppercase: false,
          hasLowercase: false,
          hasNumber: false,
          hasSymbol: false,
          score: 0
        });
      }, 300);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    if (passwordStrength.score < 3) {
      setError('Please choose a stronger password');
      return;
    }

    if (!userId || !otp) {
      setError('Missing user information. Please try again.');
      return;
    }

    setIsLoading(true);

    try {
      // Call the backend to activate account with OTP verification and password setup
      const result = await activateAccount(userId, otp, newPassword, confirmPassword);
      
      // Check if status is true AND there's no error message
      if (result.status && !result.error) {
        setIsSuccess(true);
        
        // Call onSuccess callback if provided
        if (onSuccess) {
          onSuccess();
        }
        
        // After 2 seconds, go back to login
        setTimeout(() => {
          onClose();
          navigate('/login');
        }, 2000);
      } else {
        // Handle both cases: status false or status true with error message
        setError(result.message || result.error || 'Failed to activate account');
      }
    } catch (err: any) {
      setError(err?.error || err?.message || 'Failed to set password');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

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
        <div className="relative bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl max-w-sm w-full p-5 sm:p-6 transform transition-all">
          {/* Success State */}
          {isSuccess ? (
            <div className="text-center py-8">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Password Set Successfully!</h3>
              <p className="text-gray-600">
                Redirecting to login...
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
                Set Your Password
              </h1>

              {/* Subtitle */}
              <p className="text-center text-gray-600 font-medium mb-4">
                Create a secure password for your account
              </p>

              {/* Email display */}
              <p className="text-center text-sm text-gray-500 mb-6">
                Setting password for: <span className="font-semibold text-gray-700">{email}</span>
              </p>

              {/* Password Setup Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* New Password */}
                <div>
                  <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={handlePasswordChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter new password"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  
                  {/* Password Strength Indicator */}
                  {newPassword && (
                    <div className="mt-2">
                      <div className="flex gap-1 mb-1">
                        {[1, 2, 3, 4].map((level) => (
                          <div
                            key={level}
                            className={`h-1 flex-1 rounded-full ${
                              level <= passwordStrength.score ? getStrengthColor() : 'bg-gray-200'
                            }`}
                          />
                        ))}
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Password strength: <span className={getStrengthColor().replace('bg-', 'text-')}>{getStrengthText()}</span></span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Password Requirements */}
                <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1">
                  <p className="font-medium text-gray-700 mb-2">Password must have:</p>
                  <div className={`flex items-center ${passwordStrength.hasMinLength ? 'text-green-600' : 'text-gray-500'}`}>
                    <span className="mr-1">{passwordStrength.hasMinLength ? '✓' : '○'}</span>
                    At least 8 characters
                  </div>
                  <div className={`flex items-center ${passwordStrength.hasUppercase ? 'text-green-600' : 'text-gray-500'}`}>
                    <span className="mr-1">{passwordStrength.hasUppercase ? '✓' : '○'}</span>
                    One uppercase letter (A-Z)
                  </div>
                  <div className={`flex items-center ${passwordStrength.hasLowercase ? 'text-green-600' : 'text-gray-500'}`}>
                    <span className="mr-1">{passwordStrength.hasLowercase ? '✓' : '○'}</span>
                    One lowercase letter (a-z)
                  </div>
                  <div className={`flex items-center ${passwordStrength.hasNumber ? 'text-green-600' : 'text-gray-500'}`}>
                    <span className="mr-1">{passwordStrength.hasNumber ? '✓' : '○'}</span>
                    One number (0-9)
                  </div>
                  <div className={`flex items-center ${passwordStrength.hasSymbol ? 'text-green-600' : 'text-gray-500'}`}>
                    <span className="mr-1">{passwordStrength.hasSymbol ? '✓' : '○'}</span>
                    One special character (!@#$%^&*)
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm Password
                  </label>
                  <input
                    id="confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Confirm new password"
                  />
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-red-500 mt-1">Passwords don't match</p>
                  )}
                </div>

                {/* Error message */}
                {error && (
                  <p className="text-center text-sm text-red-600">{error}</p>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isLoading || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                  className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Setting Password...' : 'Set Password'}
                </button>
              </form>

              {/* Back to Login link */}
              <div className="text-center mt-4">
                <button 
                  onClick={onClose}
                  className="text-blue-600 hover:text-blue-700 font-medium transition duration-200"
                >
                  ← Back to Login
                </button>
              </div>

              {/* Secure portal footer - left aligned */}
              <p className="text-left text-xs text-gray-400 mt-6">
                © SECURE OFFICIAL CITY OF KIGALI PORTAL
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PasswordSetupModal;
