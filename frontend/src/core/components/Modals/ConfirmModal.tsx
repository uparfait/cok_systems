import React from 'react';
import type { ReactNode } from 'react';
import { FiAlertTriangle, FiCheck, FiX, FiLoader } from 'react-icons/fi';

// CoK Design System Colors
const PRIMARY = '#056daa';
const WHITE = '#FFFFFF';
const NEUTRAL_DARK = '#333333';
const NEUTRAL_LIGHT = '#F7F9FB';
const BORDER = '#E0E0E0';
const DANGER = '#E74C3C';
const WARNING = '#F39C12';
const SUCCESS = '#4CAF50';
const fontHeading = "'Montserrat', sans-serif";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string | ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'danger' | 'warning' | 'info' | 'success';
  isLoading?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  type = 'danger',
  isLoading = false,
}) => {
  const [isConfirmHovered, setIsConfirmHovered] = React.useState(false);

  if (!isOpen) return null;

  const getIconColor = () => {
    switch (type) {
      case 'danger': return DANGER;
      case 'warning': return WARNING;
      case 'success': return SUCCESS;
      case 'info':
      default: return PRIMARY;
    }
  };

  const getTypeStyles = () => {
    switch (type) {
      case 'danger':
        return {
          iconBg: DANGER,
          iconElement: <FiAlertTriangle className="w-5 h-5" style={{ color: WHITE }} />,
        };
      case 'warning':
        return {
          iconBg: WARNING,
          iconElement: <FiAlertTriangle className="w-5 h-5" style={{ color: WHITE }} />,
        };
      case 'success':
        return {
          iconBg: SUCCESS,
          iconElement: <FiCheck className="w-5 h-5" style={{ color: WHITE }} />,
        };
      case 'info':
      default:
        return {
          iconBg: PRIMARY,
          iconElement: <FiAlertTriangle className="w-5 h-5" style={{ color: WHITE }} />,
        };
    }
  };

  const getConfirmButtonStyle = (): React.CSSProperties => {
    const baseStyle = {
      backgroundColor: DANGER,
      color: WHITE,
      border: 0,
      borderRadius: 0,
      padding: '0.6rem 1rem',
      width: '100%',
      cursor: 'pointer',
      fontFamily: fontHeading,
      fontSize: '13px',
      fontWeight: 600,
      letterSpacing: '1px',
      textTransform: 'uppercase' as const,
      opacity: isLoading ? 0.5 : 1,
      transition: 'background-color 0.2s ease',
    };

    switch (type) {
      case 'danger':
        return { ...baseStyle, backgroundColor: DANGER };
      case 'warning':
        return { ...baseStyle, backgroundColor: WARNING };
      case 'success':
        return { ...baseStyle, backgroundColor: SUCCESS };
      case 'info':
      default:
        return { ...baseStyle, backgroundColor: PRIMARY };
    }
  };

  const getConfirmButtonHoverStyle = (): React.CSSProperties => {
    switch (type) {
      case 'danger': return { backgroundColor: '#C62828' };
      case 'warning': return { backgroundColor: '#E65100' };
      case 'success': return { backgroundColor: '#388E3C' };
      case 'info':
      default: return { backgroundColor: '#045d94' };
    }
  };

  const confirmButtonStyle = {
    ...getConfirmButtonStyle(),
    ...(isConfirmHovered && !isLoading ? getConfirmButtonHoverStyle() : {}),
  };

  const styles = getTypeStyles();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />
      
      {/* Modal Content - CoK Design */}
      <div className="relative bg-white w-full max-w-md flex flex-col" style={{ borderRadius: 0 }}>
        {/* Header with primary color */}
        <div 
          className="px-6 py-4 flex items-center justify-between flex-shrink-0" 
          style={{ 
            backgroundColor: PRIMARY, 
            borderRadius: 0 
          }}
        >
          <div className="flex items-center gap-3">
            <div 
              className="p-2 flex-shrink-0" 
              style={{ 
                backgroundColor: 'rgba(255,255,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {styles.iconElement}
            </div>
            <h3 
              className="text-lg font-semibold" 
              style={{ 
                color: WHITE, 
                fontFamily: fontHeading,
                margin: 0,
              }}
            >
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            style={{
              padding: '0.4rem 0.8rem',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.3)',
              color: WHITE,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <FiX className="w-4 h-4" style={{ color: WHITE }} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <p 
            className="text-sm leading-relaxed" 
            style={{ 
              color: NEUTRAL_DARK, 
              fontFamily: fontHeading,
              margin: 0,
            }}
          >
            {message}
          </p>
        </div>

        {/* Actions */}
        <div 
          className="px-6 py-4 flex flex-col sm:flex-row gap-3" 
          style={{ 
            borderTop: `1px solid ${BORDER}`,
            flexDirection: 'column',
          }}
        >
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            style={confirmButtonStyle}
            onMouseEnter={() => setIsConfirmHovered(true)}
            onMouseLeave={() => setIsConfirmHovered(false)}
            className="flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <FiLoader className="w-4 h-4 animate-spin" style={{ color: WHITE }} />
                {confirmText}
              </>
            ) : (
              confirmText
            )}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '0.6rem 1rem',
              backgroundColor: 'transparent',
              color: NEUTRAL_DARK,
              border: `1px solid ${BORDER}`,
              borderRadius: 0,
              cursor: 'pointer',
              fontFamily: fontHeading,
              fontSize: '13px',
              fontWeight: 600,
              letterSpacing: '1px',
              textTransform: 'uppercase',
              transition: 'all 0.2s ease',
              opacity: isLoading ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = NEUTRAL_LIGHT;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;