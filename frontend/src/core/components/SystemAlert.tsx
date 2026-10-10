import React from 'react';
import OverlayShell from './overlay/OverlayShell';

type SystemAlertType = 'error' | 'systemError' | 'warning' | 'success';

interface SystemAlertProps {
  isOpen: boolean;
  type: SystemAlertType;
  message: string | React.ReactNode;
  onClose: () => void;
}

const typeConfig: Record<SystemAlertType, { title: string; bg: string; border: string; text: string; button: string; buttonHover: string }> = {
  error: {
    title: 'Error',
    bg: 'rgba(229, 57, 53, 0.12)',
    border: '#E53935',
    text: '#E53935',
    button: '#E53935',
    buttonHover: '#c62828',
  },
  systemError: {
    title: 'System error',
    bg: 'rgba(231, 76, 60, 0.12)',
    border: '#E74C3C',
    text: '#E74C3C',
    button: '#E74C3C',
    buttonHover: '#c0392b',
  },
  warning: {
    title: 'Warning',
    bg: 'rgba(255, 152, 0, 0.12)',
    border: '#FF9800',
    text: '#FF9800',
    button: '#FF9800',
    buttonHover: '#e68900',
  },
  success: {
    title: 'Success',
    bg: 'rgba(76, 175, 80, 0.12)',
    border: '#4CAF50',
    text: '#4CAF50',
    button: '#4CAF50',
    buttonHover: '#388E3C',
  },
};

const SystemAlert: React.FC<SystemAlertProps> = ({ isOpen, type, message, onClose }) => {
  if (!isOpen) return null;

  const config = typeConfig[type];

  return (
    <OverlayShell title={config.title} onClose={onClose} width="md" zIndex={9999}>
      <div
        className="px-4 py-4"
        style={{ backgroundColor: config.bg, borderLeft: `3px solid ${config.border}` }}
      >
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
    </OverlayShell>
  );
};

export default SystemAlert;
