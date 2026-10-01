import React from 'react';
import { FiX } from 'react-icons/fi';

interface OverlayCloseButtonProps {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
  small?: boolean;
}

const OverlayCloseButton: React.FC<OverlayCloseButtonProps> = ({ onClick, disabled = false, label = 'Close', small = false }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    title={disabled ? 'Please wait until the current action finishes' : label}
    className="cok-close-x"
    style={small ? { width: 26, height: 26 } : undefined}
  >
    <FiX style={{ width: small ? 15 : 18, height: small ? 15 : 18 }} />
  </button>
);

export default OverlayCloseButton;
