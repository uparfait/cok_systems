import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../core/contexts/AuthContext';
import { useToast } from '../../core/contexts/ToastContext';
import PasswordResetOTPModal from '../../core/components/Modals/PasswordResetOTPModal';

interface ForgotPasswordPageProps {
  onVerified?: (userId: string, tempToken?: string) => void;
}

const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({ onVerified }) => {
  const { requestPasswordReset } = useAuth();
  const { showSuccess, showError } = useToast();
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState('');
  const [showOTPModal, setShowOTPModal] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const result = await requestPasswordReset(email);
      
      if (result.status && !result.error) {
        if (result.data?.userId) {
          setUserId(result.data.userId);
          sessionStorage.setItem('resetUserId', result.data.userId);
          sessionStorage.setItem('resetEmail', email);
        }
        showSuccess('Reset code sent successfully! Please check your email.');
        setShowOTPModal(true);
      } else {
        showError(result.message || result.error || 'Failed to send reset code');
      }
    } catch (err: any) {
      showError(err?.message || err?.error || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOTPSuccess = (verifiedUserId: string, tempToken: string) => {
    console.log(tempToken);
    setShowOTPModal(false);
    navigate(`/reset-password?userId=${verifiedUserId}`);
  };

  const handleContinue = () => {
    if (onVerified) {
      onVerified(userId);
    } else {
      navigate(`/reset-password?userId=${userId}`);
    }
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

  return (
    <div className="min-h-screen relative">
      <div
        className="fixed inset-0 bg-cover bg-center"
        style={{ backgroundImage: 'url(/cok_hall.jpg)' }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent" />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center p-0 sm:p-4">
        <div className="w-full max-w-none sm:max-w-md bg-white/95 backdrop-blur-sm shadow-2xl flex flex-col justify-center min-h-screen sm:min-h-0 px-4 py-6 sm:px-8 sm:py-6">

          <div className="mb-6 flex justify-center">
            <img
              src="/LOGO_COK.png"
              alt="City of Kigali"
              className="h-20 w-auto"
            />
          </div>

          {!isSubmitted ? (
            <>
              <h2 className="text-xl lg:text-2xl font-bold text-[#056daa] mb-2">Forgot Password?</h2>
              <p className="text-sm text-gray-600 mb-6">
               Enter your registered email to receive a recovery link.
              </p>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-xs lg:text-sm font-medium text-gray-700 mb-1 cok-req">
                    Email Address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    className="w-full px-3 lg:px-4 py-2.5 lg:py-3 cok-auth-input"
                    placeholder="email@domain.example"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 lg:py-3 px-3 lg:px-4 bg-blue-600 text-white text-sm cok-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Sending...
                    </span>
                  ) : (
                    'Send Reset Code'
                  )}
                </button>
              </form>
              <Link to="/login" >
              <button className="mt-6 w-full cok-btn-outlined">
                  Return to LogIn
              </button>
              </Link>
            </>
          ) : (
            <>
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                  <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Check Your Email</h2>
                <p className="text-gray-600 mb-2">
                  We've sent a reset code to:
                </p>
                <p className="text-blue-600 font-medium mb-6">{maskEmail(email)}</p>
                
                <button
                  onClick={handleContinue}
                  className="inline-block w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors mb-4"
                >
                  Continue to Verify Code
                </button>
                
                <button
                  onClick={() => setIsSubmitted(false)}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Didn't receive? Try again
                </button>
              </div>
            </>
          )}

          
        </div>
      </div>

      {showOTPModal && (
        <PasswordResetOTPModal
          isOpen={showOTPModal}
          onClose={() => setShowOTPModal(false)}
          email={email}
          onVerified={handleOTPSuccess}
        />
      )}
    </div>
  );
};

export default ForgotPasswordPage;
