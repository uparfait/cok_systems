import React, { useState, useEffect, useRef } from 'react';

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
        <div className="fixed inset-0 bg-black/30" />
        <div className="relative bg-white shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
          <div className="px-4 py-3 border-b flex justify-between items-center"><h3 className="text-sm font-bold text-gray-900">Transfer Visitor</h3><button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button></div>
          <div className="p-4 space-y-3">
            <div><label className="text-xs font-medium text-gray-700 mb-0.5 block">Department</label><select value={transferDepartment} onChange={e => onDepartmentChange(e.target.value)} className="w-full px-2.5 py-1.5 border text-sm"><option value="">Select</option>{departments.filter((d: any) => !d.sub_department_mng?.is_sub_department).map((d: any) => <option key={d._id} value={d._id}>{d.department_name}</option>)}</select></div>
            {units.length > 0 && <div><label className="text-xs font-medium text-gray-700 mb-0.5 block">Unit</label><select value={selectedUnit} onChange={e => onUnitChange(e.target.value)} className="w-full px-2.5 py-1.5 border text-sm"><option value="">No unit</option>{units.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>}
          </div>
          <div className="px-4 py-3 border-t flex justify-end gap-2"><button onClick={onClose} className="px-3 py-1.5 border text-sm hover:bg-gray-50">Cancel</button><button onClick={onTransfer} disabled={transferring || !transferDepartment} className="px-3 py-1.5 bg-purple-600 text-white text-sm hover:bg-purple-700 disabled:opacity-50">{transferring ? 'Transferring...' : 'Transfer'}</button></div>
        </div>
      </div>
    </div>
  );
};