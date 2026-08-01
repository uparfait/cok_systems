import React from 'react';
import { FiX, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

// COK design constants (same palette as the requests components)
export const COK = {
  primary: '#056daa',
  primaryHover: '#045d94',
  success: '#4CAF50',
  warning: '#F39C12',
  danger: '#E53935',
  pending: '#2563EB',
  gray: '#9E9E9E',
  bgLight: '#F7F9FB',
  textDark: '#333333',
  textMid: '#555555',
  border: '#E0E0E0',
};

export const CARD_SHADOW = '0 8px 40px 0 rgba(0,0,0,0.08)';
export const MODAL_SHADOW = '0 20px 60px rgba(0,0,0,0.25)';
export const FONT = "'Montserrat', sans-serif";

export const formatDateTime = (value?: string | Date | null): string => {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

export const formatDate = (value?: string | Date | null): string => {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

// ==================== Page header ====================
export const HodPageHeader: React.FC<{ title: string; subtitle?: string; actions?: React.ReactNode }> = ({ title, subtitle, actions }) => (
  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
    <div>
      <h1 className="text-lg font-bold uppercase tracking-wide" style={{ color: COK.primary, fontFamily: FONT }}>{title}</h1>
      {subtitle && <p className="text-sm mt-0.5" style={{ color: COK.textMid }}>{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </div>
);

// ==================== Card ====================
export const HodCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white ${className}`} style={{ boxShadow: CARD_SHADOW, borderRadius: 0 }}>
    {children}
  </div>
);

// ==================== Stat tile ====================
export const HodStatCard: React.FC<{ label: string; value: React.ReactNode; accent?: string; hint?: string }> = ({ label, value, accent = COK.primary, hint }) => (
  <div className="bg-white p-4 flex-1 min-w-[150px]" style={{ boxShadow: CARD_SHADOW, borderRadius: 0, borderTop: `3px solid ${accent}` }}>
    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: COK.textMid, fontFamily: FONT }}>{label}</p>
    <p className="text-2xl font-bold mt-1" style={{ color: COK.textDark, fontFamily: FONT }}>{value}</p>
    {hint && <p className="text-xs mt-0.5" style={{ color: COK.gray }}>{hint}</p>}
  </div>
);

// ==================== Tabs (requests-style with colored underline + counts) ====================
export interface HodTab { key: string; label: string; count?: number; color: string }
export const HodTabBar: React.FC<{ tabs: HodTab[]; active: string; onChange: (key: string) => void }> = ({ tabs, active, onChange }) => (
  <div className="flex flex-wrap border-b" style={{ borderColor: COK.border }}>
    {tabs.map(tab => (
      <button
        key={tab.key}
        onClick={() => onChange(tab.key)}
        className="px-4 py-2.5 text-sm font-semibold"
        style={{
          fontFamily: FONT,
          color: active === tab.key ? tab.color : COK.textMid,
          borderBottom: active === tab.key ? `2px solid ${tab.color}` : '2px solid transparent',
          backgroundColor: active === tab.key ? `${tab.color}10` : 'transparent',
          borderRadius: 0,
        }}
      >
        {tab.label}
        {tab.count !== undefined && (
          <span className="ml-1.5 text-xs px-1.5 py-0.5 font-bold" style={{ backgroundColor: `${tab.color}1A`, color: tab.color }}>{tab.count}</span>
        )}
      </button>
    ))}
  </div>
);

// ==================== Status chip ====================
export const HodChip: React.FC<{ label: string; color: string }> = ({ label, color }) => (
  <span className="text-xs px-2 py-0.5 font-bold uppercase" style={{ backgroundColor: `${color}1F`, color, fontFamily: FONT }}>{label}</span>
);

// ==================== Pagination footer ====================
export const HodPagination: React.FC<{ page: number; totalPages: number; onPage: (p: number) => void }> = ({ page, totalPages, onPage }) => (
  <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: COK.border }}>
    <span className="text-xs" style={{ color: COK.textMid, fontFamily: FONT }}>
      Page {page} of {Math.max(totalPages, 1)}
    </span>
    <div className="flex gap-2">
      <button
        className="cok-btn-primary disabled:opacity-50 px-3 py-1.5 flex items-center gap-1 text-xs"
        style={{ borderRadius: 0 }}
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        <FiChevronLeft /> Prev
      </button>
      <button
        className="cok-btn-primary disabled:opacity-50 px-3 py-1.5 flex items-center gap-1 text-xs"
        style={{ borderRadius: 0 }}
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
      >
        Next <FiChevronRight />
      </button>
    </div>
  </div>
);

// ==================== Modal (requests-style: blue sticky header, square, shadowed) ====================
export const HodModal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; maxWidth?: string }> = ({ title, onClose, children, maxWidth = 'max-w-2xl' }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
    <div
      className={`bg-white w-full ${maxWidth} max-h-[90vh] overflow-y-auto`}
      style={{ borderRadius: 0, boxShadow: MODAL_SHADOW }}
      onClick={e => e.stopPropagation()}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-4 cok-bg-primary">
        <h2 className="text-white font-bold text-sm uppercase tracking-wide" style={{ fontFamily: FONT }}>{title}</h2>
        <button onClick={onClose} className="cok-btn-outlined-reverse p-1.5" style={{ borderRadius: 0 }} aria-label="Close">
          <FiX size={16} />
        </button>
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  </div>
);

// ==================== Form field label ====================
export const HodLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: COK.textMid, fontFamily: FONT }}>
    {children}
  </label>
);

// ==================== Empty state ====================
export const HodEmpty: React.FC<{ message: string }> = ({ message }) => (
  <div className="py-12 text-center">
    <p className="text-sm" style={{ color: COK.gray, fontFamily: FONT }}>{message}</p>
  </div>
);

// ==================== Table header cell ====================
export const HodTh: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280', backgroundColor: COK.bgLight, fontFamily: FONT }}>
    {children}
  </th>
);

// ==================== Initials avatar ====================
export const HodAvatar: React.FC<{ name?: string }> = ({ name }) => {
  const initials = (name || '?').split(' ').map(w => w.charAt(0)).slice(0, 2).join('').toUpperCase();
  return (
    <span
      className="inline-flex items-center justify-center w-7 h-7 text-xs font-bold shrink-0"
      style={{ backgroundColor: 'rgba(5,109,170,0.1)', color: COK.primary, fontFamily: FONT }}
    >
      {initials}
    </span>
  );
};
