// ForgotPasswordPage - Password recovery page
// Page for requesting password reset with real API integration

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../core/contexts/AuthContext';

const ForgotPasswordPage = () => {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState('');

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
        }
        setIsSubmitted(true);
      } else {
        setError(result.error || 'Failed to send reset code');
      }
    } catch (err: any) {
      setError(err?.error || err?.message || 'An error occurred');
    } finally {
      setIsLoading(false);
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
          style={{ backgroundImage: 'url(/src/assets/cok_hall.jpg)' }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-blue-900/50 to-black/80"></div>
        </div>
        
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <div>
            <h1 className="text-4xl font-bold mb-2">KSESM</h1>
          </div>
          
          <div className="space-y-2">
            <p className="text-xl text-gray-200">Need Help?</p>
            <p className="text-sm text-gray-300 max-w-md">
              Contact support at support@kigali.rw or visit the IT department
            </p>
          </div>
          
          <div className="flex items-center text-sm text-gray-400">
            <span>© 2026 City of Kigali</span>
          </div>
        </div>
      </div>

      {/* Right side - Forgot Password form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-8 bg-white">
        <div className="max-w-md w-full space-y-8">
          {/* Back button */}
          <Link to="/login" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6 sm:mb-8 transition-colors">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back
          </Link>

          {/* City of Kigali text */}
          <div className="mb-6">
            <p className="text-sm text-gray-500 uppercase tracking-wider">CITY OF KIGALI</p>
          </div>

          {!isSubmitted ? (
            <>
              {/* Forgot Password Header */}
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Forgot Password?</h2>
              <p className="text-gray-600 mb-8">
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
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="evode@cok.gov.rw"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                <Link
                  to={`/reset-password?userId=${userId}`}
                  className="inline-block w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors mb-4"
                >
                  Continue to Verify Code
                </Link>
                
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
    </div>
  );
};

export default ForgotPasswordPage;
