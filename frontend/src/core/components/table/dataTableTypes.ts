import type React from 'react';

export type FilterKind = 'text' | 'select' | 'date' | 'number' | 'none';

export interface FilterOption {
  value: string;
  label: string;
}

export interface DataTableColumn<T> {
  key: string;
  label: string;
  filter?: FilterKind;
  options?: FilterOption[];
  allLabel?: string;
  placeholder?: string;
  sortable?: boolean;
  width?: number;
  align?: 'left' | 'right' | 'center';
  hiddenByDefault?: boolean;
  render?: (row: T) => React.ReactNode;
  value?: (row: T) => string | number | boolean | null | undefined;
}

export interface DataTableFilterValue {
  value: string;
  mode?: string;
}

export type DataTableFilters = Record<string, DataTableFilterValue>;

export interface DataTableSort {
  key: string | null;
  dir: 'asc' | 'desc';
}

export interface DataTableQuery {
  page: number;
  limit: number;
  filters: DataTableFilters;
  sort: DataTableSort;
}

export const DATE_MODES: FilterOption[] = [
  { value: 'on', label: 'On' },
  { value: 'from', label: 'From' },
  { value: 'to', label: 'Up to' },
];

export const NUMBER_MODES: FilterOption[] = [
  { value: 'min', label: 'Min' },
  { value: 'is', label: 'Is' },
  { value: 'max', label: 'Max' },
];

export const emptyQuery = (limit = 20): DataTableQuery => ({
  page: 1,
  limit,
  filters: {},
  sort: { key: null, dir: 'desc' },
});

export const isFilterActive = (filter?: DataTableFilterValue): boolean =>
  !!filter && filter.value !== undefined && filter.value !== '' && filter.value !== 'ALL';
