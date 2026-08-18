import React from 'react';
import { FiLoader, FiChevronLeft, FiChevronRight } from 'react-icons/fi';


interface LoadingSpinnerProps {
  message?: string;
  fullPage?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message = 'Loading...', fullPage = false }) => {
  const content = (
    <div className="flex items-center justify-center gap-2">
     <FiLoader className="w-6 h-6 animate-spin text-[#056daa]" />
      <span className="text-sm text-gray-500">{message}</span>
    </div>
  );

  if (fullPage) {
    return <div className="flex items-center justify-center min-h-[400px]">{content}</div>;
  }

  return <tr><td colSpan={99} className="px-4 py-8 text-center">{content}</td></tr>;
};

export default LoadingSpinner;