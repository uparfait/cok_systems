import { useEffect, useCallback } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useToast } from '../contexts/ToastContext';

interface UseParkingEventsProps {
  refetch?: () => void;
}

export const useParkingEvents = ({ refetch }: UseParkingEventsProps) => {
  const { socket, isConnected } = useSocket();
  const { showSuccess, showError, showWarning, showInfo } = useToast();

  const handleCarCheckin = useCallback((data: any) => {
    console.log('🔔 useParkingEvents: car_checkedin:', data);
    if (data.show_notif === false ) {
      const type = data.type || 'info';
      const message = data.message || 'Vehicle checked in';
      switch (type) {
        case 'success': showSuccess(message); break;
        case 'error': showError(message); break;
        case 'warning': showWarning(message); break;
        default: showInfo(message);
      }
    }
    refetch?.();
  }, [refetch, showSuccess, showError, showWarning, showInfo]);

  const handleCarCheckout = useCallback((data: any) => {
    console.log('🔔 useParkingEvents: car_checkedout:', data);
    if (data.show_notif === false ) {
      const type = data.type || 'info';
      const message = data.message || 'Vehicle checked out';
      switch (type) {
        case 'success': showSuccess(message); break;
        case 'error': showError(message); break;
        case 'warning': showWarning(message); break;
        default: showInfo(message);
      }
    }
    refetch?.();
  }, [refetch, showSuccess, showError, showWarning, showInfo]);

  const handleVisitorCheckin = useCallback((data: any) => {
    console.log('🔔 useParkingEvents: visitor_checkedin:', data);
    if (data.show_notif === false ) {
      const type = data.type || 'info';
      const message = data.message || 'Visitor checked in';
      switch (type) {
        case 'success': showSuccess(message); break;
        case 'error': showError(message); break;
        case 'warning': showWarning(message); break;
        default: showInfo(message);
      }
    }
    refetch?.();
  }, [refetch, showSuccess, showError, showWarning, showInfo]);

  const handleVisitorCheckout = useCallback((data: any) => {
    console.log('🔔 useParkingEvents: visitor_checkedout:', data);
    if (data.show_notif === false ) {
      const type = data.type || 'info';
      const message = data.message || 'Visitor checked out';
      switch (type) {
        case 'success': showSuccess(message); break;
        case 'error': showError(message); break;
        case 'warning': showWarning(message); break;
        default: showInfo(message);
      }
    }
    refetch?.();
  }, [refetch, showSuccess, showError, showWarning, showInfo]);

  const handleParkingAlert = useCallback((data: any) => {
    console.log('🔔 useParkingEvents: parking_alert:', data);
    showWarning(data.message || 'Parking alert');
    refetch?.();
  }, [refetch, showWarning]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.on('car_checkedin', handleCarCheckin);
    socket.on('car_checkedout', handleCarCheckout);
    socket.on('visitor_checkedin', handleVisitorCheckin);
    socket.on('visitor_checkedout', handleVisitorCheckout);
    socket.on('parking_alert', handleParkingAlert);

    return () => {
      socket.off('car_checkedin', handleCarCheckin);
      socket.off('car_checkedout', handleCarCheckout);
      socket.off('visitor_checkedin', handleVisitorCheckin);
      socket.off('visitor_checkedout', handleVisitorCheckout);
      socket.off('parking_alert', handleParkingAlert);
    };
  }, [socket, isConnected, handleCarCheckin, handleCarCheckout, handleVisitorCheckin, handleVisitorCheckout, handleParkingAlert]);

  return { isConnected };
};
