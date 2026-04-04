// ErrorModal Component - Custom error dialog modal
// Used for displaying detailed error messages with multiple error items

import React from 'react';
import type { ReactNode } from 'react';
import { FiAlertTriangle, FiX } from 'react-icons/fi';

interface ErrorItem {
  row?: number;
  field?: string;
  message?: string;
  errors?: string[];
  value?: string;
}

interface ErrorModalProps {
  isOpen: boolean;
  title: string;
  message: string | ReactNode;
  errors?: ErrorItem[];
  onClose: () => void;
  type?: 'error' | 'warning';
}

const ErrorModal: React.FC<ErrorModalProps> = ({
  isOpen,
  title,
  message,
  errors = [],
  onClose,
  type = 'error',
}) => {
  if (!isOpen) return null;

  const getTypeStyles = () => {
    switch (type) {
      case 'error':
        return {
          icon: 'bg-red-100 text-red-600',
          header: 'bg-red-50 border-red-200',
          iconElement: <FiAlertTriangle className="w-6 h-6" />
        };
      case 'warning':
      default:
        return {
          icon: 'bg-yellow-100 text-yellow-600',
          header: 'bg-yellow-50 border-yellow-200',
          iconElement: <FiAlertTriangle className="w-6 h-6" />
        };
    }
  };

  const styles = getTypeStyles();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden transform animate-scaleIn">
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${styles.header}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 ${styles.icon} rounded-xl flex items-center justify-center`}>
              {styles.iconElement}
            </div>
            <h3 className="text-xl font-bold text-gray-900">
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            title="Close"
          >
            <FiX className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Main Message */}
          <div className="mb-4">
            <p className="text-gray-700 font-medium">
              {message}
            </p>
          </div>
          
          {/* Error List */}
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <FiAlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <span className="font-semibold text-red-800">Error Details:</span>
              </div>
              <ul className="space-y-2">
                {errors.map((err, index) => (
                  <li key={index} className="text-sm text-red-700 bg-white p-3 rounded-lg border border-red-100">
                    {err.row && (
                      <span className="font-semibold text-red-800">Row {err.row}: </span>
                    )}
                    {err.field && (
                      <span className="font-medium text-red-700">[{err.field}] </span>
                    )}
                    {err.message || (err.errors && err.errors.join(', '))}
                    {err.value && (
                      <span className="text-red-600 ml-1">({err.value})</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            <FiX className="w-4 h-4" />
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ErrorModal;
