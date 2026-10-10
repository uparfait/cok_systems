import React from 'react';
import type { ReactNode } from 'react';
import { FiAlertTriangle } from 'react-icons/fi';
import OverlayShell from '../overlay/OverlayShell';

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
          iconElement: <FiAlertTriangle className="w-6 h-6" />
        };
      case 'warning':
      default:
        return {
          icon: 'bg-yellow-100 text-yellow-600',
          iconElement: <FiAlertTriangle className="w-6 h-6" />
        };
    }
  };

  const styles = getTypeStyles();

  return (
    <OverlayShell
      title={
        <span className="flex items-center gap-3">
          <span className={`w-10 h-10 ${styles.icon} rounded-none flex items-center justify-center flex-shrink-0`}>
            {styles.iconElement}
          </span>
          <span className="truncate">{title}</span>
        </span>
      }
      onClose={onClose}
      width="md"
    >
      <div className="mb-4">
        <p className="text-gray-700 font-medium">
          {message}
        </p>
      </div>

      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-none p-4">
          <div className="flex items-center gap-2 mb-3">
            <FiAlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <span className="font-semibold text-red-800">Error Details:</span>
          </div>
          <ul className="space-y-2">
            {errors.map((err, index) => (
              <li key={index} className="text-sm text-red-700 bg-white p-3 rounded-none border border-red-100">
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
    </OverlayShell>
  );
};

export default ErrorModal;
