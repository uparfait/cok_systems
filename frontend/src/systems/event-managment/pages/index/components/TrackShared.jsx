import { FiClock, FiCheckCircle, FiXCircle, FiSlash } from "react-icons/fi";

const PRIMARY = "#056daa";
const PRIMARY_HOVER = "#045d94";
const DANGER = "#E74C3C";
const SUCCESS = "#4CAF50";
const SUCCESS_HOVER = "#388E3C";
const WARNING = "#F39C12";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const WHITE = "#FFFFFF";
const GRAY_DISABLED = "#9E9E9E";

const fontHeading = "'Montserrat', sans-serif";

const CARD_SHADOW = '0 8px 40px 0 rgba(0,0,0,0.08)';
const FOCUS_SHADOW = '0px 4px 8px rgba(7,142,206,0.25)';
const BLUR_SHADOW = '0px 2px 4px rgba(0,0,0,0.1)';

const inputStyle = {
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

const labelStyle = {
  fontFamily: fontHeading,
  fontSize: '13px',
  fontWeight: 600,
  letterSpacing: '0.5px',
  lineHeight: '1.4',
  display: 'block',
  color: NEUTRAL_DARK,
  textTransform: 'uppercase',
  marginBottom: '8px',
};

const getBtnStyle = (variant = 'primary', disabled = false) => {
  const base = {
    fontFamily: fontHeading, fontSize: '13px', fontWeight: 600,
    letterSpacing: '1px', lineHeight: '1.4', textTransform: 'uppercase',
    textAlign: 'center', textDecoration: 'none', display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', gap: '8px',
    cursor: disabled ? 'not-allowed' : 'pointer', boxSizing: 'border-box',
    border: '0', borderRadius: 0,
    transition: 'background-color 0.2s ease, color 0.2s ease, transform 0.1s ease, opacity 0.2s ease',
    padding: '0.9rem', opacity: disabled ? 0.6 : 1,
  };
  if (variant === 'primary') return { ...base, backgroundColor: PRIMARY, color: WHITE };
  if (variant === 'outline') return { ...base, color: PRIMARY, border: `1px solid ${PRIMARY}`, backgroundColor: 'transparent' };
  if (variant === 'danger') return { ...base, backgroundColor: DANGER, color: WHITE };
  return base;
};

const btnHover = (e, bg) => { e.currentTarget.style.backgroundColor = bg; };
const btnLeavePrimary = (e) => { e.currentTarget.style.backgroundColor = PRIMARY; };
const btnLeaveOutline = (e) => { e.currentTarget.style.backgroundColor = 'transparent'; };
const btnLeaveDanger = (e) => { e.currentTarget.style.backgroundColor = DANGER; };

const STATUS_DETAILS = {
  Pending: { bg: "bg-yellow-100", text: "text-yellow-800", icon: FiClock, label: "Pending" },
  Accepted: { bg: "bg-green-100", text: "text-green-800", icon: FiCheckCircle, label: "Accepted" },
  Rejected: { bg: "bg-red-100", text: "text-red-800", icon: FiXCircle, label: "Rejected" },
  Cancelled: { bg: "bg-gray-100", text: "text-gray-800", icon: FiSlash, label: "Cancelled" },
};

function StatusBadge({ status }) {
  const cfg = STATUS_DETAILS[status] || STATUS_DETAILS.Pending;
  const Icon = cfg.icon;
  return <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-sm font-medium ${cfg.bg} ${cfg.text}`}><Icon className="w-4 h-4" />{cfg.label}</span>;
}

function DetailRow({ label, value }) {
  return <div className="py-2 border-b" style={{ borderColor: BORDER }}><p className="text-xs font-medium uppercase tracking-wider" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>{label}</p><p className="text-sm mt-0.5" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>{value || "—"}</p></div>;
}

export {
  PRIMARY, PRIMARY_HOVER, DANGER, SUCCESS, SUCCESS_HOVER, WARNING,
  NEUTRAL_LIGHT, NEUTRAL_DARK, BORDER, WHITE, GRAY_DISABLED, fontHeading,
  CARD_SHADOW, FOCUS_SHADOW, BLUR_SHADOW, inputStyle, labelStyle,
  getBtnStyle, btnHover, btnLeavePrimary, btnLeaveOutline, btnLeaveDanger,
  StatusBadge, DetailRow,
};
