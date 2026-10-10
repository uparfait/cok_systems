import { useCallback, useEffect, useRef, useState } from 'react';
import { serviceDeliveryService } from '../../../../core/services/adminService';
import { failureOf } from '../../../../core/components/visitor/visitorApi';
import { useSocket } from '../../../../core/contexts/SocketContext';
import { useToast } from '../../../../core/contexts/ToastContext';
import type { InHouseVisit } from './types';

const LIST_LIMIT = 50;
const SEARCH_LIMIT = 20;
const REFRESH_MS = 5000;
const LIVE_EVENTS = ['visitor_updated', 'visitor_checkedin', 'visitor_checkedout', 'car_checkedin', 'car_checkedout'];

interface ListResponse {
  success?: boolean;
  data?: InHouseVisit[];
  total?: number;
  limit?: number;
  pages?: number;
}

export const useInHouseVisits = (enabled: boolean, paused: boolean) => {
  const { socket } = useSocket();
  const { showError } = useToast();
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<InHouseVisit[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const sequence = useRef(0);
  const liveTimer = useRef<number | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const load = useCallback(async (silent = false) => {
    const current = ++sequence.current;
    if (!silent) setLoading(true);
    const text = term.trim();
    try {
      const response: ListResponse = text
        ? await serviceDeliveryService.search(text, page, SEARCH_LIMIT, true)
        : await serviceDeliveryService.getAll(page, LIST_LIMIT, true);
      if (current !== sequence.current) return;
      const data = Array.isArray(response?.data) ? response.data : [];
      const count = Number(response?.total) || 0;
      const limit = Number(response?.limit) || (text ? SEARCH_LIMIT : LIST_LIMIT);
      const pageCount = Math.max(1, Number(response?.pages) || Math.ceil(count / limit) || 1);
      setRows(data);
      setTotal(count);
      setPages(pageCount);
      if (page > pageCount) setPage(pageCount);
    } catch (error) {
      if (current === sequence.current && !silent) showError(failureOf(error).message);
    } finally {
      if (current === sequence.current) {
        setLoading(false);
        setLoaded(true);
      }
    }
  }, [term, page, showError]);

  useEffect(() => {
    if (enabled) load();
  }, [enabled, load]);

  useEffect(() => {
    if (search.trim() === term.trim()) return undefined;
    const timer = window.setTimeout(() => {
      setTerm(search);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, term]);

  useEffect(() => {
    if (!enabled || !loaded) return undefined;
    const timer = window.setInterval(() => {
      if (!pausedRef.current) load(true);
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [enabled, loaded, load]);

  useEffect(() => {
    if (!socket || !enabled) return undefined;
    const refresh = () => {
      if (liveTimer.current) window.clearTimeout(liveTimer.current);
      liveTimer.current = window.setTimeout(() => load(true), 400);
    };
    LIVE_EVENTS.forEach((name) => socket.on(name, refresh));
    return () => {
      LIVE_EVENTS.forEach((name) => socket.off(name, refresh));
      if (liveTimer.current) window.clearTimeout(liveTimer.current);
    };
  }, [socket, enabled, load]);

  const applySearch = useCallback(() => {
    if (search.trim() === term.trim() && page === 1) {
      load();
      return;
    }
    setTerm(search);
    setPage(1);
  }, [search, term, page, load]);

  const goTo = useCallback((next: number) => {
    if (next < 1 || next > pages || next === page) return;
    setPage(next);
  }, [page, pages]);

  const removeRow = useCallback((id: string) => {
    setRows((prev) => prev.filter((row) => row._id !== id));
    setTotal((count) => Math.max(0, count - 1));
  }, []);

  return {
    rows,
    total,
    page,
    pages,
    loading,
    loaded,
    search,
    term,
    setSearch,
    applySearch,
    goTo,
    removeRow,
    reload: load,
  };
};

export default useInHouseVisits;
