import { FiLoader, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

import React, { useState, useEffect } from 'react';

interface LoadingSpinnerProps {
  /** Optional size class for the spinner - defaults to 'h-12 w-12' */
  size?: 'sm' | 'md' | 'lg';
  /** Optional message to show - defaults to 'Loading...' */
  message?: string;
  /** Optional message to show when loading takes too long - defaults to 'This is taking longer than usual...' */
  longLoadingMessage?: string;
  /** Time in ms before showing the long loading message - defaults to 3000ms (3 seconds) */
  longLoadingDelay?: number;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show the message below the spinner */
  showMessage?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  message = 'Loading...',
  longLoadingMessage = 'This is taking longer than usual...',
  longLoadingDelay = 3000,
  className = '',
  showMessage = true,
}) => {
  const [showLongLoadingMessage, setShowLongLoadingMessage] = useState(false);

  useEffect(() => {
    // Reset state when message changes (component re-renders)
    setShowLongLoadingMessage(false);

    // Set timer to show long loading message
    const timer = setTimeout(() => {
      setShowLongLoadingMessage(true);
    }, longLoadingDelay);

    // Cleanup timer on unmount or when dependencies change
    return () => clearTimeout(timer);
  }, [longLoadingDelay, message]);

  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#056daa", borderTopColor: "transparent" }} />
      
      {showMessage && (
        <div className="mt-4 text-center">
          <p className="text-gray-600 font-medium animate-pulse">
            {message}
          </p>
          
          {/* Show long loading message after delay */}
          {showLongLoadingMessage && (
            <p className="text-amber-600 text-sm mt-2 animate-pulse">
              {longLoadingMessage}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default LoadingSpinner;





