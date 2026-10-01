import React, { useEffect, useRef, useState } from 'react';
import OverlayCloseButton from '../overlay/OverlayCloseButton';

interface ConfigColumn {
  key: string;
  label: string;
}

interface DataTableConfigProps {
  columns: ConfigColumn[];
  hidden: Set<string>;
  onToggle: (key: string) => void;
  limit: number;
  pageSizes: number[];
  onLimit: (limit: number) => void;
}

const DataTableConfig: React.FC<DataTableConfigProps> = ({ columns, hidden, onToggle, limit, pageSizes, onLimit }) => {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="px-3 py-1.5 text-[12px] font-semibold uppercase tracking-wide border border-gray-300 bg-white text-gray-700 hover:border-[#056daa] hover:text-[#056daa] cursor-pointer"
      >
        Columns
      </button>
      {open ? (
        <div className="absolute left-0 mt-2 w-[260px] bg-white border border-gray-300 shadow-lg z-40 p-3 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <span className="text-[12px] font-semibold text-gray-800">Table configuration</span>
            <OverlayCloseButton small onClick={() => setOpen(false)} />
          </div>
          <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
            Rows to show
            <select
              className="border border-gray-300 px-2 py-1 text-[12px] text-gray-800 normal-case font-normal"
              value={limit}
              onChange={(e) => onLimit(parseInt(e.target.value, 10))}
            >
              {pageSizes.map((n) => <option key={n} value={n}>{n} rows</option>)}
            </select>
          </label>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-600 mb-1">Columns</div>
            <div className="grid grid-cols-2 gap-1.5 max-h-[200px] overflow-y-auto pr-1">
              {columns.map((c) => (
                <label key={c.key} className="flex items-center gap-1.5 text-[12px] text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={!hidden.has(c.key)} onChange={() => onToggle(c.key)} />
                  <span className="truncate">{c.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default DataTableConfig;
