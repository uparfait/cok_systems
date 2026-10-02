import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../core/contexts/AuthContext';
import { useToast } from '../../../../core/contexts/ToastContext';
import { useSocket } from '../../../../core/contexts/SocketContext';
import { statisticsService } from '../../../../core/services/adminService';
import type { ParkingRow } from '../checkoutVehicle/parkingRows';
import { fetchFlaggedVehicles } from './flaggedApi';

export interface DashboardStats {
  totalInside: number;
  totalSlots: number;
  availableSlots: number;
  staffReservedSlots: number;
  visitorReservedSlots: number;
  regularAvailable: number;
  regularTotal: number;
  visitorAvailableSlots: number;
  staffAvailableSlots: number;
}

const EMPTY_STATS: DashboardStats = {
  totalInside: 0,
  totalSlots: 0,
  availableSlots: 0,
  staffReservedSlots: 0,
  visitorReservedSlots: 0,
  regularAvailable: 0,
  regularTotal: 0,
  visitorAvailableSlots: 0,
  staffAvailableSlots: 0,
};

const POLL_MS = 5000;

const statsFrom = (parked: any, slots: any): DashboardStats | null => {
  if (!parked?.success || !parked?.data) return null;
  const slotsData = slots?.success && slots?.data ? slots.data.available_slots : null;
  const totalSlots = Number(slotsData?.totalSlots) || 0;
  const staffReservedSlots = Number(slotsData?.staffReservedSlots) || 0;
  const visitorReservedSlots = Number(slotsData?.visitorsReservedSlots) || 0;
  const regularAvailable = Number(slotsData?.RegularAvailableSlots) || 0;
  const visitorAvailableSlots = Number(slotsData?.visitorsAvailableSlots) || 0;
  const staffAvailableSlots = Number(slotsData?.staffAvailableSlots) || 0;
  return {
    totalInside: Number(parked.data.total) || 0,
    totalSlots,
    availableSlots: visitorAvailableSlots + staffAvailableSlots + regularAvailable,
    staffReservedSlots,
    visitorReservedSlots,
    regularAvailable,
    regularTotal: Math.max(0, totalSlots - staffReservedSlots - visitorReservedSlots),
    visitorAvailableSlots,
    staffAvailableSlots,
  };
};

export const useDashboardData = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const { socket, isConnected, on, off } = useSocket();

  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [statsLoading, setStatsLoading] = useState(true);
  const [flagged, setFlagged] = useState<ParkingRow[]>([]);
  const [flaggedTotal, setFlaggedTotal] = useState(0);
  const [flaggedLoading, setFlaggedLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);

  const applyFlagged = useCallback((page: { rows: ParkingRow[]; total: number } | null) => {
    if (!page) return;
    setFlagged(page.rows);
    setFlaggedTotal(page.total);
  }, []);

  const loadInitial = useCallback(async () => {
    setStatsLoading(true);
    setFlaggedLoading(true);
    try {
      const [parked, slots] = await Promise.all([
        statisticsService.getCurrentlyParkedStats().catch(() => null),
        statisticsService.getParkingSlots().catch(() => null),
      ]);
      const next = statsFrom(parked, slots);
      if (next) setStats(next);
      applyFlagged(await fetchFlaggedVehicles(1).catch(() => null));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setStatsLoading(false);
      setFlaggedLoading(false);
    }
  }, [applyFlagged]);

  const silentRefresh = useCallback(async () => {
    try {
      const [parked, slots, flaggedPage] = await Promise.all([
        statisticsService.getCurrentlyParkedStats().catch(() => null),
        statisticsService.getParkingSlots().catch(() => null),
        fetchFlaggedVehicles(1).catch(() => null),
      ]);
      const next = statsFrom(parked, slots);
      if (next) setStats(next);
      applyFlagged(flaggedPage);
    } catch (error) {
      console.error('Silent refresh error:', error);
    } finally {
      setRefreshToken((value) => value + 1);
    }
  }, [applyFlagged]);

  useEffect(() => {
    if (authLoading) return undefined;
    if (!isAuthenticated) {
      navigate('/login');
      return undefined;
    }
    loadInitial();
    const timer = setInterval(() => {
      silentRefresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [authLoading, isAuthenticated, navigate, loadInitial, silentRefresh]);

  useEffect(() => {
    if (!socket || !isConnected) return undefined;

    const toast = (data: any, fallback: string) => {
      const message = data?.message || fallback;
      switch (data?.type) {
        case 'success': showSuccess(message); break;
        case 'error': showError(message); break;
        case 'warning': showWarning(message); break;
        default: showInfo(message);
      }
    };
    const quietly = (fallback: string) => (data: any) => {
      if (data?.show_notif === false) toast(data, fallback);
      silentRefresh();
    };
    const onParkingUpdate = () => {
      silentRefresh();
      showInfo('Parking data updated');
    };
    const onCarCheckin = (data: any) => {
      toast(data, 'Vehicle checked in');
      silentRefresh();
    };
    const onVisitorUpdated = () => {
      silentRefresh();
    };

    const handlers: [string, (data: any) => void][] = [
      ['parking_checkin', onParkingUpdate],
      ['parking_checkout', onParkingUpdate],
      ['parking_update', onParkingUpdate],
      ['car_checkedin', onCarCheckin],
      ['car_checkedout', quietly('Vehicle checked out')],
      ['visitor_checkedin', quietly('Visitor checked in')],
      ['visitor_checkedout', quietly('Visitor checked out')],
      ['visitor_updated', onVisitorUpdated],
    ];
    handlers.forEach(([event, handler]) => on(event, handler));
    return () => {
      handlers.forEach(([event, handler]) => off(event, handler));
    };
  }, [socket, isConnected, on, off, silentRefresh, showSuccess, showError, showWarning, showInfo]);

  return {
    authLoading,
    stats,
    statsLoading,
    flagged,
    flaggedTotal,
    flaggedLoading,
    silentRefresh,
    refreshToken,
  };
};
