import React, { useEffect, useRef, useState } from 'react';
import { departmentService } from '../../../../core/services/adminService';

export interface DepartmentChoice {
  id: string;
  name: string;
  kind: 'all' | 'general' | 'department' | 'unit';
}

interface DepartmentSearchSelectProps {
  value: string;
  valueName?: string;
  onChange: (choice: DepartmentChoice) => void;
  disabled?: boolean;
  className?: string;
}

const FIXED: DepartmentChoice[] = [
  { id: 'all', name: 'All', kind: 'all' },
  { id: 'general', name: 'General', kind: 'general' },
];

const isUnit = (d: Record<string, any>): boolean => !!d.is_unit || !!(d.sub_department_mng && d.sub_department_mng.is_sub_department);

const toChoices = (list: unknown): DepartmentChoice[] => (Array.isArray(list) ? list : [])
  .filter((d: Record<string, any>) => d && (d.department_id || d._id))
  .map((d: Record<string, any>) => ({ id: String(d.department_id || d._id), name: String(d.department_name || ''), kind: isUnit(d) ? 'unit' : 'department' }));

const DepartmentSearchSelect: React.FC<DepartmentSearchSelectProps> = ({ value, valueName, onChange, disabled = false, className = '' }) => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [results, setResults] = useState<DepartmentChoice[]>([]);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement | null>(null);
  const sequence = useRef(0);

  const chosenName = FIXED.find((f) => f.id === value)?.name || valueName || '';

  useEffect(() => {
    if (!open) return undefined;
    const current = ++sequence.current;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await departmentService.search(text.trim());
        if (current !== sequence.current) return;
        setResults(toChoices(response?.data));
      } catch {
        if (current === sequence.current) setResults([]);
      } finally {
        if (current === sequence.current) setSearching(false);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [open, text]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event: MouseEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const typed = text.trim().toLowerCase();
  const options = [...FIXED.filter((f) => !typed || f.name.toLowerCase().includes(typed)), ...results];

  const pick = (choice: DepartmentChoice) => {
    onChange(choice);
    setText('');
    setOpen(false);
  };

  const onKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'Enter') setOpen(true);
      return;
    }
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive((i) => Math.min(options.length - 1, i + 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (event.key === 'Enter') { event.preventDefault(); if (options[active]) pick(options[active]); }
    else if (event.key === 'Escape') setOpen(false);
  };

  return (
    <div ref={box} className={`relative ${className}`}>
      <input
        type="text"
        value={open ? text : chosenName}
        disabled={disabled}
        placeholder="Search a department or unit"
        onFocus={() => { setOpen(true); setActive(0); }}
        onChange={(e) => { setText(e.target.value); setActive(0); if (!open) setOpen(true); }}
        onKeyDown={onKey}
        className="cok-auth-input w-full text-sm"
        style={{ paddingLeft: '12px', minHeight: '38px' }}
      />
      {open ? (
        <div className="absolute left-0 right-0 z-30 mt-1 max-h-64 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {options.map((option, index) => (
            <button
              key={`${option.kind}-${option.id}`}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(option)}
              className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm cursor-pointer ${index === active ? 'bg-[#056daa]/10 text-[#056daa]' : 'text-gray-800 hover:bg-gray-50'} ${option.id === value ? 'font-semibold' : ''}`}
            >
              <span className="truncate">{option.name}</span>
              {option.kind === 'unit' ? <span className="shrink-0 rounded-full bg-gray-100 px-2 text-[10px] uppercase tracking-wide text-gray-500">Unit</span> : null}
              {option.kind === 'department' ? <span className="shrink-0 rounded-full bg-[#056daa]/10 px-2 text-[10px] uppercase tracking-wide text-[#056daa]">Department</span> : null}
            </button>
          ))}
          {searching ? (
            <div className="flex justify-center py-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-[#056daa] border-t-transparent" /></div>
          ) : null}
          {!searching && results.length === 0 && typed ? <p className="px-3 py-2 text-xs text-gray-500">No department matches</p> : null}
        </div>
      ) : null}
    </div>
  );
};

export default DepartmentSearchSelect;
