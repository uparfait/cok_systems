import React, { useState, useEffect, useRef } from 'react';

// City of Kigali institutional design constants
const PRIMARY = "#056daa";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const TERTIARY = "#CDB896";
const WHITE = "#FFFFFF";
const GRAY_DISABLED = "#9E9E9E";
const ACCENT_DARK_BLUE = "#2980B9";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";
const btnStyle: React.CSSProperties = { fontFamily: fontHeading, fontSize: "13px", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", borderRadius: 0 };
const labelStyle: React.CSSProperties = { fontFamily: fontHeading, fontSize: "13px", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase", color: TERTIARY };
const inputStyle: React.CSSProperties = { fontFamily: fontHeading, fontSize: "14px", backgroundColor: NEUTRAL_LIGHT, border: "1px solid transparent", borderRadius: 0, boxShadow: "0px 2px 4px rgba(0,0,0,0.1)", color: NEUTRAL_DARK };
const focusInput = (e: React.FocusEvent<HTMLElement>) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = "0px 4px 8px rgba(5,109,170,0.25)"; };
const blurInput = (e: React.FocusEvent<HTMLElement>) => { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.boxShadow = "0px 2px 4px rgba(0,0,0,0.1)"; };

export const validateIdNumber = (idType: string, idNumber: string): string | null => {
  if (!idNumber?.trim()) return null;
  const t = idNumber.trim();
  if (idType === 'National ID') { if (t.length !== 16) return 'National ID must be 16 digits'; if (!/^\d+$/.test(t)) return 'Must contain only numbers'; }
  else if (idType === 'Passport') { if (t.length < 6) return 'Passport must be at least 6 characters'; if (!/^[A-Z0-9]+$/i.test(t)) return 'Must contain only letters and numbers'; }
  else if (idType === 'Driving Licence') { if (t.length < 8) return 'Driving Licence must be at least 8 characters'; if (!/^[A-Z0-9]+$/i.test(t)) return 'Must contain only letters and numbers'; }
  return null;
};

export const validateEmail = (email: string): string | null => {
  if (!email?.trim()) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? null : 'Invalid email';
};

export const LiveTimer: React.FC<{ startTime: string }> = ({ startTime }) => {
  const [e, setE] = useState(0);
  useEffect(() => { if (!startTime) return; const s = new Date(startTime).getTime(); const u = () => setE(Math.max(0, Math.floor((Date.now() - s) / 1000))); u(); const i = setInterval(u, 1000); return () => clearInterval(i); }, [startTime]);
  return <span className="font-mono tracking-widest">{String(Math.floor(e / 3600)).padStart(2, '0')}:{String(Math.floor((e % 3600) / 60)).padStart(2, '0')}:{String(e % 60).padStart(2, '0')}</span>;
};

export const TransferModal: React.FC<{ show: boolean; onClose: () => void; departments: any[]; units: any[]; transferDepartment: string; selectedUnit: string; transferring: boolean; onDepartmentChange: (id: string) => void; onUnitChange: (id: string) => void; onTransfer: () => void; }> = ({ show, onClose, departments, units, transferDepartment, selectedUnit, transferring, onDepartmentChange, onUnitChange, onTransfer }) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" onClick={onClose}>
      <div className="flex min-h-screen items-center justify-center p-2 sm:p-4">
        <div className="fixed inset-0 bg-black/40" />
        <div className="relative w-full max-w-md" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW, borderRadius: 0 }} onClick={e => e.stopPropagation()}>
          <div className="px-4 py-3 flex justify-between items-center" style={{ borderBottom: `1px solid ${BORDER}` }}><h3 className="text-sm" style={{ fontFamily: fontHeading, fontWeight: 700, color: NEUTRAL_DARK }}>Transfer Visitor</h3><button onClick={onClose} className="hover:text-gray-600" style={{ color: GRAY_DISABLED }}>✕</button></div>
          <div className="p-4 space-y-3">
            <div><label className="mb-0.5 block" style={labelStyle}>Department</label><select value={transferDepartment} onChange={e => onDepartmentChange(e.target.value)} className="w-full px-2.5 py-1.5 outline-none transition-all" style={inputStyle} onFocus={focusInput} onBlur={blurInput}><option value="">Select</option>{departments.filter((d: any) => !d.sub_department_mng?.is_sub_department).map((d: any) => <option key={d._id} value={d._id}>{d.department_name}</option>)}</select></div>
            {units.length > 0 && <div><label className="mb-0.5 block" style={labelStyle}>Unit</label><select value={selectedUnit} onChange={e => onUnitChange(e.target.value)} className="w-full px-2.5 py-1.5 outline-none transition-all" style={inputStyle} onFocus={focusInput} onBlur={blurInput}><option value="">No unit</option>{units.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>}
          </div>
          <div className="px-4 py-3 flex justify-end gap-2" style={{ borderTop: `1px solid ${BORDER}` }}><button onClick={onClose} className="px-3 py-1.5 bg-transparent hover:bg-gray-100 transition-colors" style={{ ...btnStyle, border: `1px solid ${PRIMARY}`, color: PRIMARY }}>Cancel</button><button onClick={onTransfer} disabled={transferring || !transferDepartment} className="px-3 py-1.5 disabled:opacity-50 transition-colors" style={{ ...btnStyle, backgroundColor: ACCENT_DARK_BLUE, color: WHITE }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#21618C'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ACCENT_DARK_BLUE; }}>{transferring ? 'Transferring...' : 'Transfer'}</button></div>
        </div>
      </div>
    </div>
  );
};
