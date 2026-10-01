import React from 'react';
import type { ReactNode } from 'react';
import { FiAlertTriangle, FiCheck, FiLoader } from 'react-icons/fi';
import OverlayShell from '../overlay/OverlayShell';

const PRIMARY = '#056daa';
const WHITE = '#FFFFFF';
const NEUTRAL_DARK = '#333333';
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
          iconElement: <FiAlertTriangle className="w-5 h-5" style={{ color: NEUTRAL_DARK }} />,
        };
      case 'warning':
        return {
          iconBg: WARNING,
          iconElement: <FiAlertTriangle className="w-5 h-5" style={{ color: NEUTRAL_DARK }} />,
        };
      case 'success':
        return {
          iconBg: SUCCESS,
          iconElement: <FiCheck className="w-5 h-5" style={{ color: NEUTRAL_DARK }} />,
        };
      case 'info':
      default:
        return {
          iconBg: PRIMARY,
          iconElement: <FiAlertTriangle className="w-5 h-5" style={{ color: NEUTRAL_DARK }} />,
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
    <OverlayShell
      title={
        <span className="flex items-center gap-3">
          <span className="flex-shrink-0 flex items-center">{styles.iconElement}</span>
          <span className="truncate">{title}</span>
        </span>
      }
      onClose={onCancel}
      busy={isLoading}
      width="sm"
      footer={
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
      }
    >
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
    </OverlayShell>
  );
};

export default ConfirmModal;
