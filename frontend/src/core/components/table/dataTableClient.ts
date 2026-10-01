import type { DataTableColumn, DataTableQuery } from './dataTableTypes';
import { isFilterActive } from './dataTableTypes';

const cellValue = <T,>(column: DataTableColumn<T>, row: T): unknown => {
  if (column.value) return column.value(row);
  return (row as Record<string, unknown>)[column.key];
};

const dayOf = (value: unknown): string | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value as string);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const numberOf = (value: unknown): number | null => {
  const parsed = parseFloat(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isNaN(parsed) ? null : parsed;
};

function matches<T>(column: DataTableColumn<T>, row: T, query: DataTableQuery): boolean {
  const filter = query.filters[column.key];
  if (!isFilterActive(filter)) return true;
  const value = cellValue(column, row);
  const target = String(filter.value);
  if (column.filter === 'select') return String(value ?? '').toLowerCase() === target.toLowerCase();
  if (column.filter === 'date') {
    const day = dayOf(value);
    if (!day) return false;
    const mode = filter.mode || 'on';
    if (mode === 'from') return day >= target;
    if (mode === 'to') return day <= target;
    return day === target;
  }
  if (column.filter === 'number') {
    const n = numberOf(value);
    const t = parseFloat(target);
    if (n === null || Number.isNaN(t)) return false;
    const mode = filter.mode || 'min';
    if (mode === 'is') return n === t;
    if (mode === 'max') return n <= t;
    return n >= t;
  }
  return String(value ?? '').toLowerCase().includes(target.toLowerCase());
}

export function applyClientQuery<T>(rows: T[], columns: DataTableColumn<T>[], query: DataTableQuery): { rows: T[]; total: number } {
  const filtered = rows.filter((row) => columns.every((column) => matches(column, row, query)));
  const sortColumn = query.sort.key ? columns.find((c) => c.key === query.sort.key) : null;
  if (sortColumn) {
    const dir = query.sort.dir === 'asc' ? 1 : -1;
    filtered.sort((a, b) => {
      const A = cellValue(sortColumn, a);
      const B = cellValue(sortColumn, b);
      const nA = numberOf(A);
      const nB = numberOf(B);
      if (sortColumn.filter === 'number' && nA !== null && nB !== null) return (nA - nB) * dir;
      const sA = String(A ?? '').toLowerCase();
      const sB = String(B ?? '').toLowerCase();
      if (sA < sB) return -dir;
      if (sA > sB) return dir;
      return 0;
    });
  }
  const start = (query.page - 1) * query.limit;
  return { rows: filtered.slice(start, start + query.limit), total: filtered.length };
}
