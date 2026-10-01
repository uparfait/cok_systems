import { useCallback, useEffect, useRef, useState } from 'react';
import { smartParkingService } from '../../../../core/services/adminService';
import { failureOf } from '../../../../core/components/visitor/visitorApi';
import type { ParkingRow } from './parkingRows';
import { rowKey } from './parkingRows';

export const PARKING_PAGE_SIZE = 50;
const POLL_MS = 5000;
const DEBOUNCE_MS = 300;

type Loader = (nextQuery: string, nextPage: number, silent?: boolean) => Promise<void>;

export const useActiveParking = (enabled: boolean, onError: (message: string) => void) => {
  const [rows, setRows] = useState<ParkingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingText, setLoadingText] = useState('Loading...');
  const paramsRef = useRef({ query: '', page: 1 });
  const requestRef = useRef(0);
  const pausedRef = useRef(false);
  const errorRef = useRef(onError);
  const loadRef = useRef<Loader | null>(null);
  errorRef.current = onError;

  const load = useCallback<Loader>(async (nextQuery, nextPage, silent = false) => {
    const id = requestRef.current + 1;
    requestRef.current = id;
    paramsRef.current = { query: nextQuery, page: nextPage };
    const term = nextQuery.trim();
    if (!silent) {
      setLoadingText(term ? 'Searching...' : nextPage > 1 ? 'Loading page...' : 'Loading...');
      setLoading(true);
    }
    try {
      const response = term
        ? await smartParkingService.search(term, nextPage, PARKING_PAGE_SIZE)
        : await smartParkingService.getAllPaginated(nextPage, PARKING_PAGE_SIZE, 'active');
      if (id !== requestRef.current) return;
      const data: ParkingRow[] = Array.isArray(response?.data) ? response.data : [];
      const count = Number(response?.total) || data.length;
      const lastPage = Math.max(1, Math.ceil(count / PARKING_PAGE_SIZE));
      if (data.length === 0 && count > 0 && nextPage > lastPage && loadRef.current) {
        await loadRef.current(nextQuery, lastPage, silent);
        return;
      }
      setRows(data.filter((row) => row.status === 'active'));
      setTotal(count);
      setPage(nextPage);
    } catch (error) {
      if (id !== requestRef.current || silent) return;
      errorRef.current(failureOf(error).message || 'Failed to load parking records');
      setRows([]);
      setTotal(0);
    } finally {
      if (id === requestRef.current) {
        setLoading(false);
      }
    }
  }, []);
  loadRef.current = load;

  useEffect(() => {
    if (!enabled) return undefined;
    load(paramsRef.current.query, paramsRef.current.page);
    return undefined;
  }, [enabled, load]);

  useEffect(() => {
    if (query === paramsRef.current.query) return undefined;
    const timer = setTimeout(() => {
      if (query !== paramsRef.current.query) load(query, 1);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, load]);

  useEffect(() => {
    if (!enabled) return undefined;
    const timer = setInterval(() => {
      if (pausedRef.current) return;
      load(paramsRef.current.query, paramsRef.current.page, true);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [enabled, load]);

  const searchNow = useCallback(() => {
    load(query, 1);
  }, [query, load]);

  const goToPage = useCallback((target: number) => {
    load(paramsRef.current.query, target);
  }, [load]);

  const reloadSilently = useCallback(() => {
    load(paramsRef.current.query, paramsRef.current.page, true);
  }, [load]);

  const removeRow = useCallback((row: ParkingRow) => {
    const key = rowKey(row);
    setRows((previous) => previous.filter((item) => rowKey(item) !== key));
    setTotal((previous) => Math.max(0, previous - 1));
  }, []);

  const setPaused = useCallback((value: boolean) => {
    pausedRef.current = value;
  }, []);

  return {
    rows,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PARKING_PAGE_SIZE)),
    query,
    setQuery,
    loading,
    loadingText,
    searchNow,
    goToPage,
    reloadSilently,
    removeRow,
    setPaused,
  };
};
