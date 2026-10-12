import React, { useEffect, useRef, useState } from 'react';
import { employeeService } from '../../../core/services/adminService';

export interface LeaderOption { _id?: string; full_name?: string; email?: string; title?: string; }

interface LeaderSearchInputProps {
  value: LeaderOption | null;
  onChange: (leader: LeaderOption | null) => void;
  disabled?: boolean;
}

const leaderText = (leader: LeaderOption) => {
  if (leader.full_name) return leader.email ? `${leader.full_name} (${leader.email})` : leader.full_name;
  return leader.email || leader._id || 'Selected leader';
};

const detailText = (emp: LeaderOption) => [emp.email, emp.title].filter(v => v && v !== 'Not specified').join(' - ');

const LeaderSearchInput: React.FC<LeaderSearchInputProps> = ({ value, onChange, disabled }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LeaderOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const requestRef = useRef(0);

  useEffect(() => {
    const q = query.trim();
    requestRef.current += 1;
    const requestId = requestRef.current;
    if (!q) { setResults([]); setSearching(false); setSearched(false); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await employeeService.search(q, 1, 20);
        if (requestId !== requestRef.current) return;
        const list = Array.isArray(r?.data) ? r.data : (r?.data?.data || []);
        setResults(r?.success === false ? [] : list);
      } catch {
        if (requestId === requestRef.current) setResults([]);
      } finally {
        if (requestId === requestRef.current) { setSearching(false); setSearched(true); }
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const pick = (emp: LeaderOption) => {
    onChange({ _id: emp._id, full_name: emp.full_name, email: emp.email, title: emp.title });
    setQuery('');
  };

  if (value) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center px-3 py-1.5 bg-[rgba(5,109,170,0.1)] text-[#056daa] text-sm font-medium max-w-full"><span className="truncate">{leaderText(value)}</span></span>
        <button type="button" onClick={() => onChange(null)} disabled={disabled} className="px-3 py-1.5 cok-btn-outlined text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">Clear</button>
      </div>
    );
  }

  const q = query.trim();
  return (
    <div>
      <input type="text" value={query} onChange={e => setQuery(e.target.value)} disabled={disabled} autoComplete="off" className="w-full px-3 py-2 cok-auth-input text-sm" placeholder="Type a name, email or phone to search employees" />
      {q && (
        <div className="mt-1 border border-gray-200 bg-white max-h-56 overflow-y-auto">
          {searching ? <p className="px-3 py-2 text-xs text-gray-500">Searching...</p>
            : results.length === 0 ? (searched ? <p className="px-3 py-2 text-xs text-gray-500">No employees match</p> : null)
              : results.map(emp => (
                <button type="button" key={emp._id || emp.email} onClick={() => pick(emp)} className="w-full text-left px-3 py-2 hover:bg-[#F7F9FB] cursor-pointer border-b border-gray-100 last:border-b-0">
                  <span className="block text-sm font-medium text-gray-900">{emp.full_name || emp.email}</span>
                  {detailText(emp) && <span className="block text-xs text-gray-500">{detailText(emp)}</span>}
                </button>
              ))}
        </div>
      )}
    </div>
  );
};

export default LeaderSearchInput;
