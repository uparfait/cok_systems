import { FiClock, FiActivity, FiCheckCircle, FiAlertCircle } from "react-icons/fi";

export const PRIMARY = '#056daa';
export const PRIMARY_DARK = '#045d94';
export const PRIMARY_LIGHT = '#E6F4F9';
export const DANGER = '#E74C3C';
export const SUCCESS = '#4CAF50';
export const WARNING = '#F39C12';
export const NEUTRAL_LIGHT = '#F7F9FB';
export const NEUTRAL_DARK = '#333333';
export const NEUTRAL_BODY = '#555555';
export const BORDER = '#E0E0E0';
export const WHITE = '#FFFFFF';
export const GRAY_DISABLED = '#9E9E9E';
export const TERTIARY = '#CDB896';

export const fontHeading = "'Montserrat', sans-serif";

export const CARD_SHADOW = '0 8px 40px 0 rgba(0,0,0,0.08)';
export const FOCUS_SHADOW = '0px 4px 8px rgba(7,142,206,0.25)';
export const BLUR_SHADOW = '0px 2px 4px rgba(0,0,0,0.1)';

export const STATUSES = ['Pending', 'In Progress', 'Completed'];

export const STATUS_META = {
  Pending:       { header: '#F59E0B', text: '#B45309', light: '#FFFBEB', border: '#FCD34D', bg: '#FEF3C7', icon: FiClock },
  'In Progress': { header: '#3B82F6', text: '#1D4ED8', light: '#EFF6FF', border: '#BFDBFE', bg: '#DBEAFE', icon: FiActivity },
  Completed:     { header: '#10B981', text: '#065F46', light: '#ECFDF5', border: '#A7F3D0', bg: '#D1FAE5', icon: FiCheckCircle },
};

export function cokInputStyle(focusBorder = PRIMARY) {
  return {
    fontFamily: fontHeading,
    fontSize: '14px',
    fontWeight: 500,
    letterSpacing: '0.2px',
    lineHeight: '1.4',
    width: '100%',
    padding: '12px 1rem',
    color: NEUTRAL_DARK,
    backgroundColor: NEUTRAL_LIGHT,
    boxSizing: 'border-box',
    border: '0',
    borderRadius: 0,
    boxShadow: BLUR_SHADOW,
    outline: 'none',
    borderStyle: 'solid',
    borderWidth: '1px',
    borderColor: BORDER,
    transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
  };
}

export function cokLabelStyle() {
  return {
    fontFamily: fontHeading,
    fontSize: '13px',
    fontWeight: 600,
    letterSpacing: '0.5px',
    lineHeight: '1.4',
    display: 'block',
    color: TERTIARY,
    textTransform: 'uppercase',
    marginBottom: '8px',
  };
}

export function cokBtnStyle(variant = 'primary', disabled = false) {
  const base = {
    fontFamily: fontHeading,
    fontSize: '13px',
    fontWeight: 600,
    letterSpacing: '1px',
    lineHeight: '1.4',
    textTransform: 'uppercase',
    textAlign: 'center',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    boxSizing: 'border-box',
    border: '0',
    borderRadius: 0,
    transition: 'background-color 0.2s ease, color 0.2s ease, transform 0.1s ease, opacity 0.2s ease',
    padding: '0.9rem',
    opacity: disabled ? 0.6 : 1,
  };
  if (variant === 'primary') return { ...base, backgroundColor: PRIMARY, color: WHITE };
  if (variant === 'outline') return { ...base, color: PRIMARY, border: `1px solid ${PRIMARY}`, backgroundColor: 'transparent' };
  if (variant === 'danger') return { ...base, backgroundColor: DANGER, color: WHITE };
  return base;
}

export function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtFull(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function isOverdue(due, status) {
  return status !== 'Completed' && new Date(due) < new Date();
}

export function ErrorBox({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#FFEBEE', border: `1px solid ${DANGER}`, color: '#C62828', fontSize: '13px', borderRadius: 0, padding: '10px 12px' }}>
      <FiAlertCircle style={{ width: '14px', height: '14px', flexShrink: 0 }} />
      {children}
    </div>
  );
}
