import { useCallback, useEffect, useRef, useState } from 'react';
import { statisticsService } from '../../../../core/services/adminService';
import { useSocket } from '../../../../core/contexts/SocketContext';
import { failureOf } from '../../../../core/components/visitor/visitorApi';

export type MovementRange = 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'custom';

export interface MovementPoint {
  key: string;
  label: string;
  check_in: number;
  check_out: number;
  flagged: number;
}

export interface Movement {
  range: MovementRange;
  auto: boolean;
  label: string;
  unit: 'hour' | 'day' | 'week' | 'month' | 'year';
  from: string;
  to: string;
  from_day: string;
  to_day: string;
  chart_from: string;
  earliest_inside: { check_in: string; plate_number: string } | null;
  totals: { check_in: number; check_out: number; flagged: number };
  points: MovementPoint[];
}

export interface CustomDates {
  from: string;
  to: string;
}

interface MovementRequest {
  range: MovementRange | 'default';
  from?: string;
  to?: string;
}

const RELOAD_MS = 60 * 1000;
const LIVE_EVENTS = ['car_checkedin', 'car_checkedout', 'parking_checkin', 'parking_checkout', 'parking_update'];

const dayOf = (value: string | Date): string => {
  const date = new Date(value);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

export const todayString = (): string => dayOf(new Date());

export function useParkingMovement(enabled: boolean) {
  const { on, off, isConnected } = useSocket();
  const [request, setRequest] = useState<MovementRequest>({ range: 'default' });
  const [data, setData] = useState<Movement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);
  const liveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (silent = false) => {
    const current = ++sequence.current;
    if (!silent) setLoading(true);
    try {
      const params = request.range === 'custom' ? { range: 'custom', from: request.from, to: request.to } : { range: request.range };
      const response = await statisticsService.getParkingMovement(params);
      if (current !== sequence.current) return;
      if (response?.success && response.data) {
        setData(response.data as Movement);
        setError(null);
      } else {
        setError(response?.message || 'Failed to load vehicle movement');
      }
    } catch (failure) {
      if (current === sequence.current) setError(failureOf(failure).message);
    } finally {
      if (current === sequence.current) setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    if (!enabled) return undefined;
    load();
    const timer = setInterval(() => load(true), RELOAD_MS);
    return () => clearInterval(timer);
  }, [enabled, load]);

  useEffect(() => {
    if (!enabled || !isConnected) return undefined;
    const refresh = () => {
      if (liveTimer.current) clearTimeout(liveTimer.current);
      liveTimer.current = setTimeout(() => load(true), 1000);
    };
    LIVE_EVENTS.forEach((event) => on(event, refresh));
    return () => {
      LIVE_EVENTS.forEach((event) => off(event, refresh));
      if (liveTimer.current) clearTimeout(liveTimer.current);
    };
  }, [enabled, isConnected, on, off, load]);

  const range: MovementRange = request.range === 'default' ? (data ? data.range : 'today') : request.range;
  const custom: CustomDates = request.range === 'custom'
    ? { from: request.from || '', to: request.to || '' }
    : data && data.range === 'custom'
      ? { from: data.from_day, to: data.to_day }
      : { from: '', to: '' };

  const setRange = useCallback((next: MovementRange) => {
    if (next !== 'custom') {
      setRequest({ range: next });
      return;
    }
    const since = data?.earliest_inside?.check_in;
    const from = custom.from || (since ? dayOf(since) : todayString());
    setRequest({ range: 'custom', from, to: custom.to || todayString() });
  }, [data, custom.from, custom.to]);

  const applyCustom = useCallback((dates: CustomDates) => {
    setRequest({ range: 'custom', from: dates.from, to: dates.to });
  }, []);

  return { range, custom, setRange, applyCustom, data, loading, error, reload: () => load() };
}

export default useParkingMovement;
