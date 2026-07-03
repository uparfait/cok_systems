import React from 'react';

interface LoadingSpinnerProps {
  message?: string;
  fullPage?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message = 'Loading...', fullPage = false }) => {
  const content = (
    <div className="flex items-center justify-center gap-2">
      <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
      <span className="text-sm text-gray-500">{message}</span>
    </div>
  );

  if (fullPage) {
    return <div className="flex items-center justify-center min-h-[400px]">{content}</div>;
  }

  return <tr><td colSpan={99} className="px-4 py-8 text-center">{content}</td></tr>;
};

export default LoadingSpinner;