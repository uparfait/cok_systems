import React, { useEffect, useRef } from 'react';
import OverlayCloseButton from './overlay/OverlayCloseButton';

interface SlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  busy?: boolean;
}

const SlideOver: React.FC<SlideOverProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  size = 'md',
  busy = false
}) => {
  const busyRef = useRef(busy);
  busyRef.current = busy;

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busyRef.current) onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const requestClose = () => {
    if (!busyRef.current) onClose();
  };

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity animate-fadeIn"
        onClick={requestClose}
        style={{ animation: 'fadeIn 0.3s ease-out' }}
      />

      <div className="absolute inset-y-0 right-0 flex max-w-full pl-10">
        <div className={`w-screen ${sizeClasses[size]}`}>
          <div className="flex h-full flex-col bg-white shadow-2xl transform transition-transform duration-300 ease-out">

            <div className="flex items-center justify-between gap-3 px-6 py-5 border-b border-gray-100 bg-white">
              <div className="min-w-0">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <span className="w-1 h-6 bg-blue-600 rounded-full"></span>
                  {title}
                </h2>
                {subtitle && (
                  <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
                )}
              </div>
              <OverlayCloseButton onClick={requestClose} disabled={busy} />
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="px-6 py-6">
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
};

export default SlideOver;

