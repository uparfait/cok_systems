// Toast Component - Temporary notification message
// Displays success, error, warning, or info messages with animations

import React, { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  onClose: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ id, type, message, duration = 5000, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    setTimeout(() => setIsVisible(true), 10);

    // Auto close after duration
    const timer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(() => {
      onClose(id);
    }, 300); // Wait for exit animation
  };

  // Type-specific styles
  const styles = {
    success: {
      bg: 'bg-green-50',
      border: 'border-green-400',
      icon: 'text-green-500',
      title: 'text-green-800',
      message: 'text-green-700',
      iconPath: 'M5 13l4 4L19 7'
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-400',
      icon: 'text-red-500',
      title: 'text-red-800',
      message: 'text-red-700',
      iconPath: 'M6 18L18 6M6 6l12 12'
    },
    warning: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-400',
      icon: 'text-yellow-500',
      title: 'text-yellow-800',
      message: 'text-yellow-700',
      iconPath: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-400',
      icon: 'text-blue-500',
      title: 'text-blue-800',
      message: 'text-blue-700',
      iconPath: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
    }
  };

  const style = styles[type];

  return (
    <div
      className={`
        ${style.bg} ${style.border} border-l-4 rounded-md shadow-lg p-4 mb-3
        transform transition-all duration-300 ease-in-out
        ${isVisible && !isLeaving ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'}
      `}
      role="alert"
    >
      <div className="flex items-start">
        {/* Icon */}
        <div className={`flex-shrink-0 ${style.icon}`}>
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d={style.iconPath}
            />
          </svg>
        </div>

        {/* Content */}
        <div className="ml-3 flex-1">
          <p className={`text-sm font-medium ${style.title}`}>
            {message}
          </p>
        </div>

        {/* Close button */}
        <div className="ml-auto">
          <button
            onClick={handleClose}
            className={`${style.icon} hover:opacity-70 transition-opacity`}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Toast;
