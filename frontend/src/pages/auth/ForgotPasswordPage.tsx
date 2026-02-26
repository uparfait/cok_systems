import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../core/contexts/AuthContext';
import PasswordResetOTPModal from '../../core/components/Modals/PasswordResetOTPModal';

interface ForgotPasswordPageProps {
  onVerified?: (userId: string, tempToken?: string) => void;
}

const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({ onVerified }) => {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState('');
  const [showOTPModal, setShowOTPModal] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      const result = await requestPasswordReset(email);
      
      if (result.status) {
        // Store userId for next step
        if (result.data?.userId) {
          setUserId(result.data.userId);
          sessionStorage.setItem('resetUserId', result.data.userId);
          sessionStorage.setItem('resetEmail', email);
        }
        // Show OTP modal directly after successful email submission
        setShowOTPModal(true);
      } else {
        setError(result.error || 'Failed to send reset code');
      }
    } catch (err: any) {
      setError(err?.error || err?.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle OTP verification success
  const handleOTPSuccess = (verifiedUserId: string, tempToken: string) => {
    console.log(tempToken);
    setShowOTPModal(false);
    // Navigate to reset password page with userId
    navigate(`/reset-password?userId=${verifiedUserId}`);
  };

  // Handle continue to OTP verification
  const handleContinue = () => {
    // If onVerified callback is provided, call it
    if (onVerified) {
      onVerified(userId);
    } else {
      // Default behavior - navigate to reset password page
      navigate(`/reset-password?userId=${userId}`);
    }
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

  return (
    <div className="min-h-screen flex">
      {/* Left side - Image with overlay */}
      <div className="hidden lg:flex lg:w-1/2 relative">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: 'url(/cok_hall.jpg)' }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent" />
        </div>
        
        <div className="relative z-10 flex flex-col justify-end p-7 lg:p-10 text-white w-full h-full">
          {/* COK OFFICIAL PORTAL pill */}
          <div className="inline-flex items-center px-3 py-1.5 mb-3 bg-white/10 backdrop-blur-sm rounded-full border border-white/20 text-xs font-semibold tracking-wide uppercase w-max cok-badge-animated">
            <span className="mr-1.5 inline-flex h-3 w-3 items-center justify-center rounded-full border border-white/60">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            </span>
            <span className="font-bold">COK Official Portal</span>
          </div>

          {/* Main heading and description */}
          <div className="space-y-2 max-w-xl">
            <h1 className="poetsen-one-regular text-2xl md:text-3xl lg:text-4xl tracking-tight leading-snug">
              Smart Entry & <br/> Service Management
            </h1>
            <p className="public-sans-regular text-xs md:text-sm text-[#EFF6FF] font-semibold">
              Serving the City of Kigali with efficiency and security.
            </p>
            <p className="public-sans-regular text-xs text-[#EFF6FF] font-semibold max-w-md">
              Access the KSESM portal to manage administrative tasks and secure entry logs.
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Forgot Password form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-3 sm:px-4 lg:px-6 py-6 lg:py-8 bg-white">
        <div className="max-w-sm lg:max-w-md w-full">
          {/* Back button */}
          <Link to="/login" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6 sm:mb-8 transition-colors">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back
          </Link>

          {/* City of Kigali Logo */}
          <div className="mb-6 ml-4  flex justify-center">
            <img
              src="/LOGO_COK.jpg"
              alt="City of Kigali"
              className="h-30 w-auto"
            />
          </div>

          {!isSubmitted ? (
            <>
              {/* Forgot Password Header */}
              <h2 className="text-xl lg:text-2xl font-bold text-gray-900 mb-2">Forgot Password?</h2>
              <p className="text-sm text-gray-600 mb-6">
                Don't worry, it happens. Enter your<br />
                registered email to receive a recovery link.
              </p>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600 text-center">{error}</p>
                  </div>
                )}
                
                <div>
                  <label htmlFor="email" className="block text-xs lg:text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    className="w-full px-3 lg:px-4 py-2.5 lg:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="evode@cok.gov.rw"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 lg:py-3 px-3 lg:px-4 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

              {/* Return to Log In link */}
              <div className="mt-6 text-center">
                <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">
                  Return to Log In
                </Link>
              </div>
            </>
          ) : (
            <>
              {/* Success state */}
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
                
{/* Continue to OTP verification */}
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

          {/* Secure Portal footer */}
          <p className="text-center text-xs text-gray-400 mt-8">
            Secure Official City of Kigali Portal
          </p>
        </div>
      </div>

      {/* Password Reset OTP Modal */}
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
