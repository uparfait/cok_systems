// ToastContext - Global toast notification state management
// Provides methods to show toast notifications from anywhere in the app

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';

// Toast types
export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

// Inline Toast Component
const Toast: React.FC<{
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  onClose: (id: string) => void;
}> = ({ id, type, message, duration = 5000, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    setTimeout(() => setIsVisible(true), 10);
    const timer = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(() => onClose(id), 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, id, onClose]);

  const styles = {
    success: { bg: 'bg-green-50', border: 'border-green-400', icon: 'text-green-500' },
    error: { bg: 'bg-red-50', border: 'border-red-400', icon: 'text-red-500' },
    warning: { bg: 'bg-yellow-50', border: 'border-yellow-400', icon: 'text-yellow-500' },
    info: { bg: 'bg-blue-50', border: 'border-blue-400', icon: 'text-blue-500' },
  };
  const style = styles[type];

  return (
    <div className={`${style.bg} shadow-lg p-4 mb-3 transform transition-all duration-300 ${isVisible && !isLeaving ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`}>
      <div className="flex items-center text-center  justify-center">
        <span className={`text-sm  font-medium ${style.icon === 'text-green-500' ? 'text-green-800' : style.icon === 'text-red-500' ? 'text-red-800' : style.icon === 'text-yellow-500' ? 'text-yellow-800' : 'text-blue-800'}`}>{message?.toLocaleUpperCase()}</span>
        <button onClick={() => { setIsLeaving(true); setTimeout(() => onClose(id), 300); }} className="ml-2 text-gray-400 absolute right-3 top-3 hover:text-gray-600">✕</button>
      </div>
    </div>
  );
};

interface ToastContextType {
  showToast: (type: ToastType, message: string, duration?: number) => void;
  showSuccess: (message: string, duration?: number) => void;
  showError: (message: string, duration?: number) => void;
  showWarning: (message: string, duration?: number) => void;
  showInfo: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Generate unique ID
const generateId = () => `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((type: ToastType, message: string, duration = 5000) => {
    const id = generateId();
    setToasts((prev) => [...prev, { id, type, message, duration }]);
  }, []);

  // Listen for custom toast events from apiClient
  useEffect(() => {
    const handleSuccessEvent = (event: CustomEvent) => {
      showToast('success', event.detail.message);
    };
    
    const handleErrorEvent = (event: CustomEvent) => {
      showToast('error', event.detail.message);
    };
    
    const handleWarningEvent = (event: CustomEvent) => {
      showToast('warning', event.detail.message);
    };

    window.addEventListener('cok:toast-success', handleSuccessEvent as EventListener);
    window.addEventListener('cok:toast-error', handleErrorEvent as EventListener);
    window.addEventListener('cok:toast-warning', handleWarningEvent as EventListener);

    return () => {
      window.removeEventListener('cok:toast-success', handleSuccessEvent as EventListener);
      window.removeEventListener('cok:toast-error', handleErrorEvent as EventListener);
      window.removeEventListener('cok:toast-warning', handleWarningEvent as EventListener);
    };
  }, []);

  const showSuccess = useCallback((message: string, duration?: number) => {
    showToast('success', message, duration);
  }, [showToast]);

  const showError = useCallback((message: string, duration?: number) => {
    showToast('error', message, duration);
  }, [showToast]);

  const showWarning = useCallback((message: string, duration?: number) => {
    showToast('warning', message, duration);
  }, [showToast]);

  const showInfo = useCallback((message: string, duration?: number) => {
    showToast('info', message, duration);
  }, [showToast]);

  const value: ToastContextType = {
    showToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      
      {/* Toast Container - Fixed position at top-right */}
      <div className="fixed top-0 right-0 z-[9999999]  w-full">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            id={toast.id}
            type={toast.type}
            message={toast.message}
            duration={toast.duration}
            onClose={removeToast}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// Custom hook to use toast context
export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export default ToastContext;
