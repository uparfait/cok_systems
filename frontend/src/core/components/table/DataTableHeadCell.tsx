import React, { useEffect, useState } from 'react';
import type { DataTableColumn, DataTableFilterValue, DataTableSort } from './dataTableTypes';
import { DATE_MODES, NUMBER_MODES } from './dataTableTypes';

interface HeadCellProps<T> {
  column: DataTableColumn<T>;
  filter?: DataTableFilterValue;
  sort: DataTableSort;
  onFilter: (key: string, next: DataTableFilterValue) => void;
  onSort: (key: string) => void;
}

const FIELD = 'w-full border border-gray-300 bg-white px-2 py-1 text-[12px] text-gray-800 focus:outline-none focus:border-[#056daa]';

function SortMark({ state }: { state: 'none' | 'asc' | 'desc' }) {
  const up = state === 'asc' ? '#056daa' : '#cbd5e1';
  const down = state === 'desc' ? '#056daa' : '#cbd5e1';
  return (
    <span className="inline-flex flex-col gap-[2px]" aria-hidden="true">
      <span style={{ width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: `5px solid ${up}` }} />
      <span style={{ width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: `5px solid ${down}` }} />
    </span>
  );
}

function DataTableHeadCell<T>({ column, filter, sort, onFilter, onSort }: HeadCellProps<T>) {
  const [draft, setDraft] = useState(filter?.value ?? '');
  const mode = filter?.mode;

  useEffect(() => {
    setDraft(filter?.value ?? '');
  }, [filter?.value]);

  useEffect(() => {
    if (column.filter !== 'text' && column.filter !== 'number') return undefined;
    if ((filter?.value ?? '') === draft) return undefined;
    const timer = window.setTimeout(() => onFilter(column.key, { value: draft, mode }), 350);
    return () => window.clearTimeout(timer);
  }, [draft]);

  const sortable = column.sortable !== false;
  const sortState: 'none' | 'asc' | 'desc' = sort.key === column.key ? sort.dir : 'none';

  let control: React.ReactNode = <div className="h-7" />;
  if (column.filter === 'text') {
    control = (
      <input
        className={FIELD}
        value={draft}
        placeholder={column.placeholder || `Filter ${column.label.toLowerCase()}`}
        onChange={(e) => setDraft(e.target.value)}
      />
    );
  }
  if (column.filter === 'select') {
    control = (
      <select className={FIELD} value={filter?.value ?? 'ALL'} onChange={(e) => onFilter(column.key, { value: e.target.value })}>
        <option value="ALL">{column.allLabel || 'All'}</option>
        {(column.options || []).map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  }
  if (column.filter === 'date') {
    control = (
      <div className="flex gap-1">
        <select className={`${FIELD} w-16! flex-none`} value={mode || 'on'} onChange={(e) => onFilter(column.key, { value: filter?.value ?? '', mode: e.target.value })}>
          {DATE_MODES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input type="date" className={`${FIELD} min-w-0`} value={filter?.value ?? ''} onChange={(e) => onFilter(column.key, { value: e.target.value, mode: mode || 'on' })} />
      </div>
    );
  }
  if (column.filter === 'number') {
    control = (
      <div className="flex gap-1">
        <select className={`${FIELD} w-15! flex-none`} value={mode || 'min'} onChange={(e) => onFilter(column.key, { value: draft, mode: e.target.value })}>
          {NUMBER_MODES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input type="number" inputMode="numeric" className={`${FIELD} min-w-0`} placeholder="0" value={draft} onChange={(e) => setDraft(e.target.value)} />
      </div>
    );
  }

  return (
    <th scope="col" className="align-top text-left px-3 py-2.5 border-b border-gray-200" style={{ backgroundColor: '#F7F9FB', minWidth: column.width || 150 }}>
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          disabled={!sortable}
          onClick={() => sortable && onSort(column.key)}
          className={`flex items-center justify-between gap-2 text-left ${sortable ? 'cursor-pointer group' : 'cursor-default'}`}
        >
          <span className={`text-[11px] font-semibold tracking-wide uppercase text-gray-600 ${sortable ? 'group-hover:text-[#056daa]' : ''}`}>{column.label}</span>
          {sortable ? <SortMark state={sortState} /> : null}
        </button>
        {control}
      </div>
    </th>
  );
}

export default DataTableHeadCell;
