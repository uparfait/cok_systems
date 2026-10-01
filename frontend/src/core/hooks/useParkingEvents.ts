import { useEffect, useCallback } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useToast } from '../contexts/ToastContext';

interface UseParkingEventsProps {
  refetch?: () => void;
}

export const useParkingEvents = ({ refetch }: UseParkingEventsProps) => {
  const { socket, isConnected } = useSocket();
  const { showSuccess, showError, showWarning, showInfo } = useToast();

  const notify = useCallback((data: any, fallback: string) => {
    if (data?.show_notif !== false) return;
    const message = data.message || fallback;
    switch (data.type || 'info') {
      case 'success': showSuccess(message); break;
      case 'error': showError(message); break;
      case 'warning': showWarning(message); break;
      default: showInfo(message);
    }
  }, [showSuccess, showError, showWarning, showInfo]);

  const handleCarCheckin = useCallback((data: any) => {
    notify(data, 'Vehicle checked in');
    refetch?.();
  }, [notify, refetch]);

  const handleCarCheckout = useCallback((data: any) => {
    notify(data, 'Vehicle checked out');
    refetch?.();
  }, [notify, refetch]);

  const handleVisitorCheckin = useCallback((data: any) => {
    notify(data, 'Visitor checked in');
    refetch?.();
  }, [notify, refetch]);

  const handleVisitorCheckout = useCallback((data: any) => {
    notify(data, 'Visitor checked out');
    refetch?.();
  }, [notify, refetch]);

  const handleVisitorUpdated = useCallback(() => {
    refetch?.();
  }, [refetch]);

  const handleParkingAlert = useCallback((data: any) => {
    showWarning(data?.message || 'Parking alert');
    refetch?.();
  }, [refetch, showWarning]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.on('car_checkedin', handleCarCheckin);
    socket.on('car_checkedout', handleCarCheckout);
    socket.on('visitor_checkedin', handleVisitorCheckin);
    socket.on('visitor_checkedout', handleVisitorCheckout);
    socket.on('visitor_updated', handleVisitorUpdated);
    socket.on('parking_alert', handleParkingAlert);

    return () => {
      socket.off('car_checkedin', handleCarCheckin);
      socket.off('car_checkedout', handleCarCheckout);
      socket.off('visitor_checkedin', handleVisitorCheckin);
      socket.off('visitor_checkedout', handleVisitorCheckout);
      socket.off('visitor_updated', handleVisitorUpdated);
      socket.off('parking_alert', handleParkingAlert);
    };
  }, [socket, isConnected, handleCarCheckin, handleCarCheckout, handleVisitorCheckin, handleVisitorCheckout, handleVisitorUpdated, handleParkingAlert]);

  return { isConnected };
};
