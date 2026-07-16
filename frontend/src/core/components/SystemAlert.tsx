import React, { useEffect } from 'react';

type SystemAlertType = 'error' | 'systemError' | 'warning' | 'success';

interface SystemAlertProps {
  isOpen: boolean;
  type: SystemAlertType;
  message: string | React.ReactNode;
  onClose: () => void;
}

const typeConfig: Record<SystemAlertType, { bg: string; border: string; text: string; button: string; buttonHover: string }> = {
  error: {
    bg: 'rgba(229, 57, 53, 0.12)',
    border: '#E53935',
    text: '#E53935',
    button: '#E53935',
    buttonHover: '#c62828',
  },
  systemError: {
    bg: 'rgba(231, 76, 60, 0.12)',
    border: '#E74C3C',
    text: '#E74C3C',
    button: '#E74C3C',
    buttonHover: '#c0392b',
  },
  warning: {
    bg: 'rgba(255, 152, 0, 0.12)',
    border: '#FF9800',
    text: '#FF9800',
    button: '#FF9800',
    buttonHover: '#e68900',
  },
  success: {
    bg: 'rgba(76, 175, 80, 0.12)',
    border: '#4CAF50',
    text: '#4CAF50',
    button: '#4CAF50',
    buttonHover: '#388E3C',
  },
};

const SystemAlert: React.FC<SystemAlertProps> = ({ isOpen, type, message, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;

    document.body.style.overflow = 'hidden';
    document.body.style.paddingRight = '8px';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const config = typeConfig[type];

  return (
    <>
      <style>{`
        @keyframes system-alert-overlay-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes system-alert-card-in {
          from { opacity: 0; transform: translateY(24px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes system-alert-card-out {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to { opacity: 0; transform: translateY(16px) scale(0.96); }
        }
        .system-alert-overlay {
          animation: system-alert-overlay-in 0.25s ease-out forwards;
        }
        .system-alert-card {
          animation: system-alert-card-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .system-alert-card-closing {
          animation: system-alert-card-out 0.2s ease-in forwards;
        }
        .system-alert-ok-btn {
          transition: background-color 0.2s ease, transform 0.1s ease, box-shadow 0.2s ease;
        }
        .system-alert-ok-btn:hover {
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
        }
        .system-alert-ok-btn:active {
          transform: translateY(1px);
        }
      `}</style>

      <div
        className="system-alert-overlay fixed inset-0 flex items-center justify-center p-4"
        style={{
          zIndex: 9999,
          backgroundColor: config.bg,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          WebkitOverflowScrolling: 'touch',
        }}
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="system-alert-message"
      >
        <div
          className="system-alert-card relative w-full max-w-sm sm:max-w-md md:max-w-lg mx-auto shadow-2xl"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: `2px solid ${config.border}`,
            borderRadius: 0,
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-center p-5 sm:p-7 md:p-8 overflow-y-auto flex-1">
            <p
              id="system-alert-message"
              style={{
                fontFamily: "'Merriweather', serif",
                fontSize: 'clamp(15px, 2.5vw, 17px)',
                fontWeight: 400,
                lineHeight: 1.6,
                color: '#333333',
                margin: 0,
              }}
            >
              {message}
            </p>
          </div>

          <div className="p-4 sm:p-6 md:p-8 pt-0">
            <button
              onClick={onClose}
              className="system-alert-ok-btn w-full py-3.5 text-white uppercase tracking-wider cursor-pointer"
              style={{
                fontFamily: "'Montserrat', sans-serif",
                fontSize: 'clamp(12px, 2vw, 13px)',
                fontWeight: 600,
                letterSpacing: '1px',
                backgroundColor: config.button,
                border: 'none',
                borderRadius: 0,
                cursor: 'pointer',
                outline: 'none',
              }}
              onMouseEnter={(e) => {
                const target = e.currentTarget;
                target.style.backgroundColor = config.buttonHover;
              }}
              onMouseLeave={(e) => {
                const target = e.currentTarget;
                target.style.backgroundColor = config.button;
              }}
              autoFocus
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default SystemAlert;
