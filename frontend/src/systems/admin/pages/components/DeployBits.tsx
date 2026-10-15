import React from 'react';

export const PRIMARY = '#056daa';
export const DANGER = '#E74C3C';
export const SUCCESS = '#4CAF50';
export const WARNING = '#F39C12';
export const NEUTRAL_LIGHT = '#F7F9FB';
export const MUTED = '#6B7280';
export const INK = '#333333';
export const WHITE = '#FFFFFF';
export const CARD_SHADOW = '0 8px 40px 0 rgba(0,0,0,0.08)';
export const fontHeading = "'Montserrat', sans-serif";

export function button_style(color: string, ghost: boolean, disabled = false): React.CSSProperties {
  return {
    fontFamily: fontHeading,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: ghost ? color : WHITE,
    backgroundColor: ghost ? 'transparent' : color,
    border: `1px solid ${color}`,
    borderRadius: 0,
    padding: '0.65rem 1.1rem',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    transition: 'background-color 0.2s ease, opacity 0.2s ease',
  };
}

export const message_of = (error: unknown, fallback: string) => {
  const value = error as { message?: string; error?: string } | null;
  return (value && (value.message || value.error)) || fallback;
};

export const card_style: React.CSSProperties = {
  backgroundColor: WHITE,
  borderRadius: 0,
  boxShadow: CARD_SHADOW,
  padding: 20,
  marginBottom: 18,
};

export const label_style: React.CSSProperties = {
  fontFamily: fontHeading,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.6,
  textTransform: 'uppercase',
  color: MUTED,
  margin: 0,
};

export const value_style: React.CSSProperties = {
  fontFamily: fontHeading,
  fontSize: 13,
  color: INK,
  margin: '2px 0 0',
  wordBreak: 'break-word',
};

interface BannerProps {
  tone: 'warning' | 'danger' | 'success';
  icon?: React.ReactNode;
  title: string;
  children: React.ReactNode;
}

export const Banner: React.FC<BannerProps> = ({ tone, icon, title, children }) => {
  const color = tone === 'danger' ? DANGER : tone === 'success' ? SUCCESS : WARNING;
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        backgroundColor: WHITE,
        borderLeft: `4px solid ${color}`,
        borderRadius: 0,
        boxShadow: CARD_SHADOW,
        padding: '12px 16px',
        marginBottom: 14,
      }}
    >
      {icon ? <span style={{ color, display: 'flex', marginTop: 2 }}>{icon}</span> : null}
      <div>
        <p style={{ fontFamily: fontHeading, fontSize: 13, fontWeight: 700, color: INK, margin: 0 }}>{title}</p>
        <p style={{ fontFamily: fontHeading, fontSize: 12.5, color: MUTED, margin: '2px 0 0' }}>{children}</p>
      </div>
    </div>
  );
};

interface ProgressBarProps {
  percent: number;
  color?: string;
  height?: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ percent, color = PRIMARY, height = 8 }) => (
  <div
    role="progressbar"
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={Math.max(0, Math.min(100, Math.round(percent)))}
    style={{ width: '100%', height, backgroundColor: '#E5E7EB', borderRadius: 0, overflow: 'hidden' }}
  >
    <div
      style={{
        width: `${Math.max(0, Math.min(100, percent))}%`,
        height: '100%',
        backgroundColor: color,
        transition: 'width 0.3s ease',
      }}
    />
  </div>
);
