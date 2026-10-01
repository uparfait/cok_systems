import React, { useEffect, useMemo, useState } from 'react';
import DataTableHeadCell from './DataTableHeadCell';
import DataTablePager from './DataTablePager';
import DataTableConfig from './DataTableConfig';
import { applyClientQuery } from './dataTableClient';
import type { DataTableColumn, DataTableFilterValue, DataTableQuery } from './dataTableTypes';
import { emptyQuery, isFilterActive } from './dataTableTypes';

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  mode?: 'client' | 'server';
  total?: number;
  loading?: boolean;
  query?: DataTableQuery;
  onQueryChange?: (query: DataTableQuery) => void;
  initialQuery?: Partial<DataTableQuery>;
  onRowClick?: (row: T) => void;
  actions?: React.ReactNode;
  emptyTitle?: string;
  emptyText?: string;
  minWidth?: number;
  maxHeight?: string;
  pageSizes?: number[];
  storageKey?: string;
}

const readHidden = (storageKey: string | undefined, fallback: string[]): Set<string> => {
  if (!storageKey) return new Set(fallback);
  try {
    const saved = window.localStorage.getItem(`cok-table:${storageKey}`);
    if (saved) return new Set(JSON.parse(saved) as string[]);
  } catch {
    return new Set(fallback);
  }
  return new Set(fallback);
};

function DataTable<T>({
  columns,
  rows,
  rowKey,
  mode = 'client',
  total,
  loading = false,
  query: controlled,
  onQueryChange,
  initialQuery,
  onRowClick,
  actions,
  emptyTitle = 'Nothing matches these filters',
  emptyText = 'Change or clear the filters in the column headers.',
  minWidth = 900,
  maxHeight = '62vh',
  pageSizes = [10, 20, 50, 100],
  storageKey,
}: DataTableProps<T>) {
  const [local, setLocal] = useState<DataTableQuery>(() => ({ ...emptyQuery(pageSizes[1] || 20), ...initialQuery }));
  const [hidden, setHidden] = useState<Set<string>>(() => readHidden(storageKey, columns.filter((c) => c.hiddenByDefault).map((c) => c.key)));
  const query = mode === 'server' && controlled ? controlled : local;

  const setQuery = (next: DataTableQuery) => {
    if (mode === 'server' && onQueryChange) onQueryChange(next);
    else setLocal(next);
  };

  useEffect(() => {
    if (!storageKey) return;
    try {
      window.localStorage.setItem(`cok-table:${storageKey}`, JSON.stringify([...hidden]));
    } catch {
      return;
    }
  }, [hidden, storageKey]);

  const visible = columns.filter((c) => !hidden.has(c.key));
  const computed = useMemo(
    () => (mode === 'client' ? applyClientQuery(rows, columns, query) : { rows, total: total ?? rows.length }),
    [mode, rows, columns, query, total],
  );
  const pages = Math.max(1, Math.ceil(computed.total / query.limit));
  const activeFilters = Object.values(query.filters).some((f) => isFilterActive(f));

  useEffect(() => {
    if (query.page > pages) setQuery({ ...query, page: pages });
  }, [pages]);

  const onFilter = (key: string, next: DataTableFilterValue) => setQuery({ ...query, page: 1, filters: { ...query.filters, [key]: next } });
  const onSort = (key: string) => {
    const dir: 'asc' | 'desc' = query.sort.key === key && query.sort.dir === 'asc' ? 'desc' : 'asc';
    setQuery({ ...query, page: 1, sort: { key, dir } });
  };
  const clearFilters = () => setQuery({ ...query, page: 1, filters: {} });

  return (
    <div className="bg-white border border-gray-200 p-3 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <DataTableConfig
            columns={columns.map((c) => ({ key: c.key, label: c.label }))}
            hidden={hidden}
            onToggle={(key) => setHidden((prev) => {
              const next = new Set(prev);
              if (next.has(key)) next.delete(key);
              else next.add(key);
              return next;
            })}
            limit={query.limit}
            pageSizes={pageSizes}
            onLimit={(limit) => setQuery({ ...query, page: 1, limit })}
          />
          {activeFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="px-3 py-1.5 text-[12px] font-semibold uppercase tracking-wide border border-[#056daa] bg-[#056daa]/5 text-[#056daa] hover:bg-[#056daa]/10 cursor-pointer"
            >
              Clear filters
            </button>
          ) : null}
          <span className="text-[12px] text-gray-500">
            {loading ? 'Loading...' : `${computed.total} ${computed.total === 1 ? 'record' : 'records'}`}
          </span>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>

      <div className="border border-gray-200">
        <div className="cok-table-scroll" style={{ ['--cok-table-max-h' as string]: maxHeight } as React.CSSProperties}>
          <table className="w-full text-left" style={{ minWidth }}>
            <thead>
              <tr>
                {visible.map((column) => (
                  <DataTableHeadCell
                    key={column.key}
                    column={column}
                    filter={query.filters[column.key]}
                    sort={query.sort}
                    onFilter={onFilter}
                    onSort={onSort}
                  />
                ))}
              </tr>
            </thead>
            <tbody className="text-[13px]">
              {computed.rows.map((row, index) => (
                <tr
                  key={rowKey(row, index)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`border-b border-gray-100 hover:bg-[#056daa]/5 ${onRowClick ? 'cursor-pointer' : ''}`}
                >
                  {visible.map((column) => (
                    <td key={column.key} className={`px-3 py-2.5 text-gray-700 border-b border-gray-100 ${column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : ''}`}>
                      {column.render ? column.render(row) : String((column.value ? column.value(row) : (row as Record<string, unknown>)[column.key]) ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && computed.rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <h3 className="text-[13px] font-semibold text-gray-800">{emptyTitle}</h3>
            <p className="text-[12px] text-gray-500 mt-0.5">{emptyText}</p>
          </div>
        ) : null}
      </div>

      <DataTablePager page={Math.min(query.page, pages)} pages={pages} disabled={loading} onPage={(page) => setQuery({ ...query, page })} />
    </div>
  );
}

export default DataTable;
