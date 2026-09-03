// SmartParkingDashboard - Smart Parking System Dashboard
// Gate Officer Dashboard with City of Kigali (CoK) institutional design

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useToast } from '../../../core/contexts/ToastContext';
import { useSocket } from '../../../core/contexts/SocketContext';
import { smartParkingService, statisticsService, parkingService, reservationService } from '../../../core/services/adminService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import ParkingLotMap from '../../../core/components/ParkingLotMap';
import {
  FiTruck, FiShield, FiCheckCircle, FiAlertTriangle, FiUser, FiUserPlus,
  FiPhone, FiX, FiEdit, FiActivity, FiCalendar, FiMapPin, FiTrendingUp, FiUsers, FiInfo, FiClock, FiCheck, FiDownload
} from 'react-icons/fi';
import { BsShieldCheck, BsExclamationTriangle } from 'react-icons/bs';
import { MdOutlineLocalParking, MdOutlineWarning } from 'react-icons/md';
import { FaRegIdCard } from 'react-icons/fa';
import ExportVisitorsModal from '../../../core/components/requests/ExportVisitorsModal';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// City of Kigali (CoK) institutional design constants
const PRIMARY = "#056daa";
const PRIMARY_HOVER = "#045d94";
const SUCCESS = "#4CAF50";
const SUCCESS_HOVER = "#388E3C";
const WARNING = "#F39C12";
const DANGER = "#E74C3C";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const TERTIARY = "#CDB896";
const WHITE = "#FFFFFF";
const GRAY_DISABLED = "#9E9E9E";
const ACCENT_DARK_BLUE = "#2980B9";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";

interface VehicleData {
  plate_number?: string;
  vehicle_category?: string;
  is_currently_parked?: boolean;
  is_reserved?: boolean;
  is_flagged?: boolean;
  was_ever_flagged?: boolean;
  badge_number?: string;
  identification?: any;
  driver_details?: {
    name?: string;
    telephone?: string;
    email?: string;
    type?: string;
    gender?: string;
    identification?: any;
  };
  driver_name?: string;
  driver_telephone?: string;
  driver_type?: string;
  staff_details?: {
    plate_number?: string;
    owner_name?: string;
    department_name?: string;
    telephone?: string;
    email?: string;
    gender?: string;
    identification?: string;
  };
  emergency_reservation_details?: any;
  parking_details?: any;
}

interface FlaggedVehicle {
  plate_no: string;
  entry_time: string;
  duration: string;
  driver_name?: string;
  driver_type?: string;
  status?: string;
  _id?: string;
}

const SmartParkingDashboard: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const { socket, isConnected, on, off } = useSocket();

  // Loading states
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [plateNumber, setPlateNumber] = useState('');
  const [statsLoading, setStatsLoading] = useState(true);
  const [flaggedLoading, setFlaggedLoading] = useState(true);
  const [modalFlaggedLoading, setModalFlaggedLoading] = useState(false);

   // Modal states
   const [showFoundModal, setShowFoundModal] = useState(false);
   const [showFlaggedModal, setShowFlaggedModal] = useState(false);
   const [showCheckoutConfirmModal, setShowCheckoutConfirmModal] = useState(false);
   const [checkoutVehicle, setCheckoutVehicle] = useState<FlaggedVehicle | null>(null);
   const [isEditingDriver, setIsEditingDriver] = useState(false);
   const [driverInfo, setDriverInfo] = useState({
     name: '',
     telephone: '',
     badge_number: ''
   });

   // Export modal state
   const [showExportModal, setShowExportModal] = useState(false);

  // Data states
  const [verifiedData, setVerifiedData] = useState<VehicleData | null>(null);

   // Stats data from API
   const [stats, setStats] = useState({
     availableSlots: 0,
     totalSlots: 0,
     staffVehicles: 0,
     visitorVehicles: 0,
     reservedSlots: 0,
     newVisitors: 0,
     totalInside: 0,
     totalOutside: 0,
     flaggedButInside: 0,
     staffReserved: 0,
     visitorReserved: 0,
     staffReservedSlots: 0,
     visitorReservedSlots: 0,
     regularAvailable: 0,
     regularReserved: 0,
     regularTotal: 0,
     visitorAvailableSlots: 0,
      staffAvailableSlots: 0
   });

  // Parking lot map data: slot totals + currently parked vehicles + active reservations
  const [parkingLot, setParkingLot] = useState<{ totalSlots: number; vehicles: any[]; reservations: any[] }>({ totalSlots: 0, vehicles: [], reservations: [] });

  // Flagged vehicles
  const [flaggedVehicles, setFlaggedVehicles] = useState<FlaggedVehicle[]>([]);
  const [modalFlaggedVehicles, setModalFlaggedVehicles] = useState<FlaggedVehicle[]>([]);
  
  // Pagination for flagged vehicles
  const [flaggedPage, setFlaggedPage] = useState(1);
  const [modalFlaggedPage, setModalFlaggedPage] = useState(1);
  const [flaggedTotal, setFlaggedTotal] = useState(0);
  const flaggedLimit = 50;

  // Hourly analytics data
  const [hourlyParkingData, setHourlyParkingData] = useState<{
    hour: number;
    check_in: number;
    check_out: number;
  }[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [firstLoad, setFirstLoad] = useState(true);

  // Ref for interval
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Helper function to map flagged vehicle data
  const mapFlaggedVehicle = (vehicle: any): FlaggedVehicle => ({
    plate_no: vehicle.plate_number || vehicle.plate_no,
    entry_time: vehicle.check_in || vehicle.entry_time,
    duration: vehicle.duration || 'N/A',
    driver_name: vehicle.driver_details?.name || vehicle.driver_name,
    driver_type: vehicle.driver_type,
    status: vehicle.status || 'active',
    _id: vehicle._id
  });

  // Fetch flagged vehicles with pagination
  const fetchFlaggedVehicles = useCallback(async (page: number, isForModal: boolean = false) => {
    try {
      const response = await smartParkingService.getFlaggedActiveVehicles(page, flaggedLimit);
      if (response.success && response.data) {
        const mappedVehicles = response.data.map(mapFlaggedVehicle);
        if (isForModal) {
          setModalFlaggedVehicles(mappedVehicles);
        } else {
          setFlaggedVehicles(mappedVehicles);
        }
        setFlaggedTotal(response.total || 0);
      }
    } catch (error) {
      console.error('Error fetching flagged vehicles:', error);
    }
  }, [flaggedLimit]);

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    setStatsLoading(true);
    setFlaggedLoading(true);
    try {
      const currentlyParkedResponse = await statisticsService.getCurrentlyParkedStats();
      const slotsResponse = await statisticsService.getParkingSlots();

      // Lot map data: every active vehicle + active reservations (same sources as the mayor overview map)
      const [activeVehiclesRes, reservationsRes] = await Promise.all([
        parkingService.getAllPaginated(1, 200, 'active').catch(() => null),
        reservationService.getAll().catch(() => null),
      ]);
      const activeVehiclesRaw = (activeVehiclesRes as any)?.data || [];
      const reservationsRaw = (reservationsRes as any)?.reservations || [];
      setParkingLot({
        totalSlots: Number((slotsResponse as any)?.data?.available_slots?.totalSlots) || 0,
        vehicles: Array.isArray(activeVehiclesRaw) ? activeVehiclesRaw : [],
        reservations: (Array.isArray(reservationsRaw) ? reservationsRaw : []).filter((r: any) => r?.status === 'active'),
      });

  if (currentlyParkedResponse.success && currentlyParkedResponse.data) {
         const { total, by_driver_type } = currentlyParkedResponse.data;
         const slotsData = slotsResponse.success && slotsResponse.data ? slotsResponse.data.available_slots : null;

         const totalSlots = slotsData?.totalSlots || 0;
         const staffReservedSlots = slotsData?.staffReservedSlots || 0;
         const visitorReservedSlots = slotsData?.visitorsReservedSlots || 0;
         const regularAvailableSlots = slotsData?.RegularAvailableSlots || 0;
         // Regular total = total slots minus staff reserved slots minus visitor reserved slots (auto-calculated)
         const regularTotal = Math.max(0, totalSlots - staffReservedSlots - visitorReservedSlots);

         setStats(prev => ({
           ...prev,
           totalInside: total || 0,
           totalSlots: totalSlots,
           availableSlots: (slotsData?.visitorsAvailableSlots || 0) + (slotsData?.staffAvailableSlots || 0) + regularAvailableSlots,
           // Backend groups by raw driver_type values, which are lowercase
           visitorVehicles: by_driver_type?.visitor || 0,
           staffVehicles: (by_driver_type?.staff || 0) + (by_driver_type?.regular || 0),
           staffReserved: slotsData?.staffReservationCount || 0,
           staffReservedSlots: staffReservedSlots,
           visitorReserved: slotsData?.visitorReservationCount || 0,
           visitorReservedSlots: visitorReservedSlots,
           regularAvailable: regularAvailableSlots,
           regularReserved: slotsData?.RegularReservedSlots || 0,
           regularTotal: regularTotal,
            visitorAvailableSlots: slotsData?.visitorsAvailableSlots || 0,
            staffAvailableSlots: slotsData?.staffAvailableSlots || 0
         }));
         setStatsLoading(false);
       }


      await fetchFlaggedVehicles(flaggedPage, false);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setStatsLoading(false);
      setFlaggedLoading(false);
    }
  }, [flaggedPage, fetchFlaggedVehicles]);

  // Fetch hourly analytics data
  const fetchHourlyAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const response = await statisticsService.getHourlyParkingStats();
      if (response.success && response.data) {
        setHourlyParkingData(response.data.hourly || []);
      }
    } catch (error) {
      console.error('Error fetching hourly analytics:', error);
    } finally {
      setAnalyticsLoading(false);
      setFirstLoad(false);
    }
  }, []);

  // Silent refresh function - updates data without showing loading indicators
  const silentRefresh = useCallback(async () => {
    try {
      // Fetch all data silently
      const [currentlyParkedResponse, slotsResponse, activeVehiclesRes, reservationsRes, hourlyResponse] = await Promise.all([
        statisticsService.getCurrentlyParkedStats().catch(() => null),
        statisticsService.getParkingSlots().catch(() => null),
        parkingService.getAllPaginated(1, 200, 'active').catch(() => null),
        reservationService.getAll().catch(() => null),
        statisticsService.getHourlyParkingStats().catch(() => null)
      ]);

      // Update parking lot data
      const activeVehiclesRaw = (activeVehiclesRes as any)?.data || [];
      const reservationsRaw = (reservationsRes as any)?.reservations || [];
      setParkingLot({
        totalSlots: Number((slotsResponse as any)?.data?.available_slots?.totalSlots) || 0,
        vehicles: Array.isArray(activeVehiclesRaw) ? activeVehiclesRaw : [],
        reservations: (Array.isArray(reservationsRaw) ? reservationsRaw : []).filter((r: any) => r?.status === 'active'),
      });

      // Update stats
      if (currentlyParkedResponse?.success && currentlyParkedResponse?.data) {
        const { total, by_driver_type } = currentlyParkedResponse.data;
        const slotsData = slotsResponse?.success && slotsResponse.data ? slotsResponse.data.available_slots : null;
        const totalSlots = slotsData?.totalSlots || 0;
        const staffReservedSlots = slotsData?.staffReservedSlots || 0;
        const visitorReservedSlots = slotsData?.visitorsReservedSlots || 0;
        const regularAvailableSlots = slotsData?.RegularAvailableSlots || 0;
        const regularTotal = Math.max(0, totalSlots - staffReservedSlots - visitorReservedSlots);

        setStats(prev => ({
          ...prev,
          totalInside: total || 0,
          totalSlots: totalSlots,
          availableSlots: (slotsData?.visitorsAvailableSlots || 0) + (slotsData?.staffAvailableSlots || 0) + regularAvailableSlots,
          visitorVehicles: by_driver_type?.visitor || 0,
          staffVehicles: (by_driver_type?.staff || 0) + (by_driver_type?.regular || 0),
          staffReserved: slotsData?.staffReservationCount || 0,
          staffReservedSlots: staffReservedSlots,
          visitorReserved: slotsData?.visitorReservationCount || 0,
          visitorReservedSlots: visitorReservedSlots,
          regularAvailable: regularAvailableSlots,
          regularReserved: slotsData?.RegularReservedSlots || 0,
          regularTotal: regularTotal,
          visitorAvailableSlots: slotsData?.visitorsAvailableSlots || 0,
          staffAvailableSlots: slotsData?.staffAvailableSlots || 0
        }));
      }

      // Update flagged vehicles
      const flaggedResponse = await smartParkingService.getFlaggedActiveVehicles(flaggedPage, flaggedLimit).catch(() => null);
      if (flaggedResponse?.success && flaggedResponse?.data) {
        const mappedVehicles = flaggedResponse.data.map(mapFlaggedVehicle);
        setFlaggedVehicles(mappedVehicles);
        setFlaggedTotal(flaggedResponse.total || 0);
      }

      // Update hourly analytics
      if (hourlyResponse?.success && hourlyResponse?.data) {
        setHourlyParkingData(hourlyResponse.data.hourly || []);
      }

    } catch (error) {
      console.error('Silent refresh error:', error);
    }
  }, [flaggedPage, flaggedLimit]);

  // Handle real-time updates
  const handleParkingUpdate = useCallback((data: any) => {
    console.log('Parking update received:', data);
    silentRefresh();
    showInfo('Parking data updated');
  }, [silentRefresh, showInfo]);

  // Initial data fetch and set up silent refresh interval
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
      return;
    }
    
    // Initial data load with loading indicators
    fetchDashboardData();
    fetchHourlyAnalytics();

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Set up silent refresh every 5 seconds
    intervalRef.current = setInterval(() => {
      silentRefresh();
    }, 5000);

    // Cleanup interval on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAuthenticated, authLoading, navigate, fetchDashboardData, fetchHourlyAnalytics, silentRefresh]);

  // Socket event listeners
  useEffect(() => {
    if (socket && isConnected) {
      on('parking_checkin', handleParkingUpdate);
      on('parking_checkout', handleParkingUpdate);
      on('parking_update', handleParkingUpdate);

      const handleCarCheckin = (data: any) => {
        console.log('Car check-in event received:', data);
        switch (data.type) {
          case 'success': showSuccess(data.message); break;
          case 'error': showError(data.message); break;
          case 'warning': showWarning(data.message); break;
          default: showInfo(data.message);
        }
        silentRefresh();
      };
      on('car_checkedin', handleCarCheckin);

      const handleCarCheckout = (data: any) => {
        console.log('Car check-out event received:', data);
        if (data.show_notif === false) {
          const message = data.message || 'Vehicle checked out';
          const type = data.type || 'info';
          if (type === 'success') showSuccess(message);
          else if (type === 'error') showError(message);
          else if (type === 'warning') showWarning(message);
          else showInfo(message);
        }
        silentRefresh();
      };
      on('car_checkedout', handleCarCheckout);

      const handleVisitorCheckin = (data: any) => {
        console.log('Visitor check-in event received:', data);
        if (data.show_notif === false) {
          const message = data.message || 'Visitor checked in';
          const type = data.type || 'info';
          if (type === 'success') showSuccess(message);
          else if (type === 'error') showError(message);
          else if (type === 'warning') showWarning(message);
          else showInfo(message);
        }
        silentRefresh();
      };
      on('visitor_checkedin', handleVisitorCheckin);

      const handleVisitorCheckout = (data: any) => {
        console.log('Visitor check-out event received:', data);
        if (data.show_notif === false) {
          const message = data.message || 'Visitor checked out';
          const type = data.type || 'info';
          if (type === 'success') showSuccess(message);
          else if (type === 'error') showError(message);
          else if (type === 'warning') showWarning(message);
          else showInfo(message);
        }
        silentRefresh();
      };
      on('visitor_checkedout', handleVisitorCheckout);

      return () => {
        off('parking_checkin', handleParkingUpdate);
        off('parking_checkout', handleParkingUpdate);
        off('parking_update', handleParkingUpdate);
        off('car_checkedin', handleCarCheckin);
        off('car_checkedout', handleCarCheckout);
        off('visitor_checkedin', handleVisitorCheckin);
        off('visitor_checkedout', handleVisitorCheckout);
      };
    }
  }, [socket, isConnected, on, off, handleParkingUpdate, silentRefresh, showSuccess, showError, showWarning, showInfo]);

  // Helper function to get background color based on duration
  const getDurationBgColor = (duration: string) => {
    const hours = parseFloat(duration.replace(/[^0-9.]/g, ''));
    if (hours >= 9) return 'bg-[rgba(231,76,60,0.12)] text-[#E74C3C] border border-[#E0E0E0]';
    if (hours >= 5) return 'bg-[rgba(243,156,18,0.12)] text-[#F39C12] border border-[#E0E0E0]';
    return 'bg-[rgba(51,51,51,0.08)] text-[#555555] border border-[#E0E0E0]';
  };

  // Helper function to get card colors based on occupancy percentage
  const getOccupancyColors = (occupied: number, total: number) => {
    const percentage = (occupied / total) * 100;
    if (percentage >= 100) return {
      bg: 'bg-[rgba(231,76,60,0.12)]',
      text: 'text-[#E74C3C]',
      border: 'border-[#E0E0E0]',
      icon: 'text-[#E74C3C]'
    };
    if (percentage >= 90) return {
      bg: 'bg-[rgba(243,156,18,0.12)]',
      text: 'text-[#F39C12]',
      border: 'border-[#E0E0E0]',
      icon: 'text-[#F39C12]'
    };
    if (percentage >= 80) return {
      bg: 'bg-[rgba(243,156,18,0.1)]',
      text: 'text-[#F39C12]',
      border: 'border-[#E0E0E0]',
      icon: 'text-[#F39C12]'
    };
    return {
      bg: 'bg-[rgba(5,109,170,0.12)]',
      text: 'text-[#056daa]',
      border: 'border-[#E0E0E0]',
      icon: 'text-[#056daa]'
    };
  };

  const handleVerify = async () => {
    if (!plateNumber.trim()) {
      showWarning('Please enter license plate number');
      return;
    }

    setVerifying(true);
    setVerifiedData(null);

    try {
      const response = await smartParkingService.verifyCar(plateNumber.trim());

      if (response.success && response.data) {
        const data = response.data;
        setVerifiedData(data);
        setDriverInfo({
          name: data.driver_details?.name || data.driver_name || '',
          telephone: data.driver_details?.telephone || data.driver_telephone || '',
          badge_number: (data as any).badge_number || ''
        });
        setShowFoundModal(true);
      } else {
        showInfo('Vehicle not found in system');
        setShowFoundModal(false);
      }
    } catch (err: any) {
      console.error('Verify error:', err);
      showError(err?.message || 'Failed to verify vehicle');
    } finally {
      setVerifying(false);
    }
  };

  const handleConfirmEntry = async () => {
    if (!verifiedData?.plate_number) return;

    if (verifiedData.is_currently_parked) {
      showWarning('This vehicle is already checked in');
      return;
    }

    if (!verifiedData.is_reserved && !driverInfo.badge_number?.trim()) {
      showWarning('Badge number is required');
      return;
    }

    setLoading(true);
    try {
      const identification = verifiedData.driver_details?.identification || null;

      const response = await smartParkingService.checkIn({
        plate_number: verifiedData.plate_number,
        driver_name: driverInfo.name || verifiedData.driver_details?.name || verifiedData.driver_name || '',
        driver_telephone: driverInfo.telephone || verifiedData.driver_details?.telephone || verifiedData.driver_telephone || '',
        driver_type: verifiedData.driver_type || verifiedData.vehicle_category || verifiedData.driver_details?.type || '',
        driver_identification: identification,
        badge_number: driverInfo.badge_number?.trim() || null,
      });

      if (response.success) {
        setShowFoundModal(false);
        setPlateNumber('');
        setVerifiedData(null);
        showSuccess('Vehicle checked in.');
        silentRefresh();
      } else {
        showError(response.message || 'Failed to check in vehicle');
      }
    } catch (err: any) {
      showError(err?.message || 'Failed to check in vehicle');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckoutClick = (vehicle: FlaggedVehicle) => {
    setCheckoutVehicle(vehicle);
    setShowCheckoutConfirmModal(true);
  };

  const handleConfirmCheckout = async () => {
    if (!checkoutVehicle?.plate_no) return;

    setLoading(true);
    try {
      const response = await smartParkingService.checkOutByPlate(checkoutVehicle.plate_no);
      if (response.success) {
        showSuccess('Vehicle checked out.');
        silentRefresh();
        if (showFlaggedModal) {
          await fetchFlaggedVehicles(modalFlaggedPage, true);
        }
      } else {
        showError(response.message || 'Failed to checkout');
      }
    } catch (err: any) {
      showError(err?.message || 'Failed to checkout');
    } finally {
      setLoading(false);
      closeAllModals();
    }
  };

  // Handle flagged vehicles page change in modal
  const handleModalFlaggedPageChange = async (newPage: number) => {
    setModalFlaggedLoading(true);
    setModalFlaggedPage(newPage);
    try {
      const response = await smartParkingService.getFlaggedActiveVehicles(newPage, flaggedLimit);
      if (response.success && response.data) {
        const mappedVehicles = response.data.map(mapFlaggedVehicle);
        setModalFlaggedVehicles(mappedVehicles);
        setFlaggedTotal(response.total || 0);
      }
    } catch (error) {
      console.error('Error fetching flagged vehicles page:', error);
    } finally {
      setModalFlaggedLoading(false);
    }
  };

  const closeAllModals = () => {
    setShowFoundModal(false);
    setShowFlaggedModal(false);
    setShowCheckoutConfirmModal(false);
    setCheckoutVehicle(null);
    setIsEditingDriver(false);
    setDriverInfo({ name: '', telephone: '', badge_number: '' });
    setPlateNumber('');
    setVerifiedData(null);
  };

  const handleDriverInfoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setDriverInfo(prev => ({ ...prev, [name]: value }));
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#056daa] border-t-transparent mx-auto mb-4"></div>
          <p className="text-[#555555] font-medium">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <MainLayout>
      <div className="min-h-screen p-2 sm:p-3 md:p-4 lg:p-6" style={{ backgroundColor: NEUTRAL_LIGHT }}>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-4">
          <div className="p-3 transition-shadow duration-300" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium mb-0.5" style={{ color: PRIMARY, fontFamily: fontHeading }}>Available Slots</p>
                {statsLoading ? (
                  <div className="h-7 w-12 animate-pulse mt-1" style={{ backgroundColor: 'rgba(5,109,170,0.12)' }}></div>
                ) : (
                  <h3 className="text-xl font-bold" style={{ color: PRIMARY, fontFamily: fontHeading }}>{stats.availableSlots}</h3>
                )}
                <p className="text-[#555555] text-xs mt-1 flex items-center gap-1">
                  <FiMapPin className="w-3 h-3" />
                  Out of {stats.totalSlots} total
                </p>
              </div>
              <div className="p-2" style={{ backgroundColor: 'rgba(5,109,170,0.08)' }}>
                <MdOutlineLocalParking className="w-5 h-5" style={{ color: PRIMARY }} />
              </div>
            </div>
</div>

          <div className="p-3 transition-shadow duration-300" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium mb-0.5" style={{ color: SUCCESS_HOVER, fontFamily: fontHeading }}>Regular Available</p>
                {statsLoading ? (
                  <div className="h-7 w-12 animate-pulse mt-1" style={{ backgroundColor: 'rgba(76,175,80,0.12)' }}></div>
                ) : (
                  <h3 className="text-xl font-bold" style={{ color: SUCCESS_HOVER, fontFamily: fontHeading }}>{stats.regularAvailable}</h3>
                )}
                <p className="text-[#555555] text-xs mt-1 flex items-center gap-1">
                  <FiMapPin className="w-3 h-3" /> {stats.regularTotal} allocated
                </p>
              </div>
              <div className="p-2" style={{ backgroundColor: 'rgba(76,175,80,0.1)' }}>
                <FiTruck className="w-5 h-5" style={{ color: SUCCESS }} />
              </div>
            </div>
          </div>


          {/* Staff Reserved */}
          <div className="p-3 transition-shadow duration-300" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium mb-0.5" style={{ color: ACCENT_DARK_BLUE, fontFamily: fontHeading }}>Staff Reserved</p>
{statsLoading ? (
                   <div className="h-7 w-12 animate-pulse mt-1" style={{ backgroundColor: 'rgba(41,128,185,0.12)' }}></div>
                 ) : (
                   <h3 className="text-xl font-bold" style={{ color: ACCENT_DARK_BLUE, fontFamily: fontHeading }}>{stats.staffAvailableSlots}</h3>
                 )}
                 <p className="text-[#333333] text-xs mt-1 flex items-center gap-1">
                    <FiUsers className="w-3 h-3" />
                    Out of {stats.staffReservedSlots} allocated
                  </p>
               </div>
              <div className="p-2" style={{ backgroundColor: 'rgba(41,128,185,0.1)' }}>
                <FiShield className="w-5 h-5" style={{ color: ACCENT_DARK_BLUE }} />
              </div>
            </div>
          </div>

          {/* Visitor Reserved */}
          <div className="p-3 transition-shadow duration-300" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium mb-0.5" style={{ color: WARNING, fontFamily: fontHeading }}>Visitor Reserved</p>
{statsLoading ? (
                   <div className="h-7 w-12 animate-pulse mt-1" style={{ backgroundColor: 'rgba(243,156,18,0.12)' }}></div>
                 ) : (
                   <h3 className="text-xl font-bold" style={{ color: WARNING, fontFamily: fontHeading }}>{stats.visitorAvailableSlots}</h3>
                 )}
                  <p className="text-[#333333] text-xs mt-1 flex items-center gap-1">
                    <FiTrendingUp className="w-3 h-3" />
                    Out of {stats.visitorReservedSlots} allocated
                  </p>
               </div>
              <div className="p-2" style={{ backgroundColor: 'rgba(243,156,18,0.1)' }}>
                <FiUserPlus className="w-5 h-5" style={{ color: WARNING }} />
              </div>
            </div>
          </div>

          {/* Parking Status - shows occupied percentage */}
          <div className="p-3 transition-shadow duration-300 col-span-2 sm:col-span-3 lg:col-span-1" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW }}>
            <div className="flex items-center gap-1.5 mb-2">
              <MdOutlineLocalParking className="w-4 h-4" style={{ color: PRIMARY }} />
              <p className="text-xs font-medium" style={{ color: PRIMARY, fontFamily: fontHeading }}>Parking Status</p>
            </div>
            {statsLoading ? (
              <div className="flex items-center justify-center h-24">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#056daa] border-t-transparent"></div>
              </div>
            ) : (
              <div>
                <p className="text-2xl sm:text-3xl font-bold" style={{ color: PRIMARY, fontFamily: fontHeading }}>
                  {parkingLot.totalSlots > 0
                    ? `${((parkingLot.vehicles.length / parkingLot.totalSlots) * 100).toFixed(3)}%`
                    : "0%"}
                </p>
                <p className="text-[#555555] text-xs mt-1" style={{ fontFamily: fontHeading }}>
                  {parkingLot.vehicles.length} of {parkingLot.totalSlots} occupied
                </p>
                <div className="w-full bg-[#E0E0E0] h-1.5 mt-2">
                  <div
                    className="h-1.5 transition-all duration-500"
                    style={{
                      width: `${parkingLot.totalSlots > 0
                        ? Math.round((parkingLot.vehicles.length / parkingLot.totalSlots) * 100)
                        : 0}%`,
                      backgroundColor: PRIMARY,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Export Visitors Button */}
        <div className="mb-4">
          <button
            onClick={() => setShowExportModal(true)}
            className="w-full px-6 py-3 text-white font-bold text-sm sm:text-base transition-colors flex items-center justify-center gap-2 cursor-pointer"
            style={{ backgroundColor: PRIMARY, borderRadius: 0, fontFamily: fontHeading, letterSpacing: '1px', textTransform: 'uppercase' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
          >
            <FiDownload className="w-5 h-5" />
            EXPORT VISITORS DATA
          </button>
        </div>

        {/* Hourly Analytics Graph */}
        <div className="p-3 sm:p-4 md:p-5 mb-6" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW }}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2" style={{ backgroundColor: 'rgba(5,109,170,0.1)' }}>
                <FiTrendingUp className="w-5 h-5 text-[#056daa]" />
              </div>
              <h2 className="text-base sm:text-lg font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Hourly Parking Analytics</h2>
            </div>
            <button
              onClick={fetchHourlyAnalytics}
              className="px-3 py-1.5 text-white transition-colors flex items-center justify-center gap-1 cursor-pointer w-full sm:w-auto"
              style={{ backgroundColor: PRIMARY, borderRadius: 0, fontFamily: fontHeading, fontSize: 13, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
            >
              <FiActivity className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>

          {(analyticsLoading && firstLoad) ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#056daa] border-t-transparent"></div>
            </div>
          ) : hourlyParkingData.length > 0 ? (
            <div className="overflow-x-auto">
              <div className="h-56 sm:h-64 w-full min-w-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={hourlyParkingData} margin={{ top: 20, right: 10, left: 0, bottom: 25 }}>
                    <defs>
                      <linearGradient id="colorCheckIn" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#056daa" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#056daa" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="colorCheckOut" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#E74C3C" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#E74C3C" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                    <XAxis
                      dataKey="hour"
                      tickFormatter={(value: number) => `${value.toString().padStart(2, '0')}:00`}
                      stroke={GRAY_DISABLED}
                      tick={{ fontSize: 10, fill: GRAY_DISABLED }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      stroke={GRAY_DISABLED}
                      tick={{ fontSize: 10, fill: GRAY_DISABLED }}
                      axisLine={false}
                      tickLine={false}
                      width={36}
                    />
                    <Tooltip contentStyle={{
                      backgroundColor: WHITE,
                      border: `1px solid ${BORDER}`,
                      borderRadius: 0,
                      boxShadow: CARD_SHADOW
                    }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="check_in" name="Check-ins" stroke="#056daa" strokeWidth={2} fillOpacity={1} fill="url(#colorCheckIn)" dot={{ r: 3, fill: '#fff', stroke: '#056daa', strokeWidth: 2 }} />
                    <Area type="monotone" dataKey="check_out" name="Check-outs" stroke="#E74C3C" strokeWidth={2} fillOpacity={1} fill="url(#colorCheckOut)" dot={{ r: 3, fill: '#fff', stroke: '#E74C3C', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-4 pt-4 border-t border-[#E0E0E0]">
                <div className="text-center">
                  <p className="text-xs sm:text-sm text-[#555555]">Total Check-ins Today</p>
                  <p className="text-xl sm:text-2xl font-bold text-[#056daa]" style={{ fontFamily: fontHeading }}>
                    {hourlyParkingData.reduce((sum, d) => sum + d.check_in, 0)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs sm:text-sm text-[#555555]">Total Check-outs Today</p>
                  <p className="text-xl sm:text-2xl font-bold text-[#E74C3C]" style={{ fontFamily: fontHeading }}>
                    {hourlyParkingData.reduce((sum, d) => sum + d.check_out, 0)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-[#9E9E9E]">
              <FiTrendingUp className="w-12 h-12 mb-2 opacity-50" />
              <p className="text-sm">No hourly data available</p>
              <button
                onClick={fetchHourlyAnalytics}
                className="mt-2 text-sm text-[#056daa] hover:underline"
              >
                Click to refresh
              </button>
            </div>
          )}
        </div>

        {/* Flagged Vehicles Section */}
        <div className="p-4 sm:p-5" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2" style={{ backgroundColor: 'rgba(231,76,60,0.1)' }}>
                <BsExclamationTriangle className="w-5 h-5 text-[#E74C3C]" />
              </div>
              <h2 className="text-lg font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Flagged Vehicles</h2>
            </div>
            <div className="flex items-center gap-2">
              {flaggedTotal > 0 && (
                <span className="text-sm text-[#555555]">
                  Page {flaggedPage} of {Math.ceil(flaggedTotal / flaggedLimit)}
                </span>
              )}
              <button
                onClick={() => {
                  setModalFlaggedPage(flaggedPage);
                  setModalFlaggedVehicles(flaggedVehicles);
                  setShowFlaggedModal(true);
                }}
                className="px-3 py-1.5 text-white transition-colors"
                style={{ backgroundColor: PRIMARY, borderRadius: 0, fontFamily: fontHeading, fontSize: 13, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
              >
                View All ({flaggedTotal})
              </button>
            </div>
          </div>

          {flaggedLoading ? (
            <div className="flex flex-col items-center justify-center py-8 text-[#9E9E9E]">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#056daa] border-t-transparent mb-2"></div>
              <p className="text-sm">Loading flagged vehicles...</p>
            </div>
          ) : flaggedVehicles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-[#9E9E9E]">
              <BsShieldCheck className="w-12 h-12 mb-2 opacity-50" />
              <p className="text-sm">No flagged vehicles at the moment</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[rgba(231,76,60,0.06)]">
                  <tr>
                    <th className="text-left py-3 px-4 text-[#E74C3C] font-semibold text-xs uppercase tracking-wide">Plate No.</th>
                    <th className="text-left py-3 px-4 text-[#E74C3C] font-semibold text-xs uppercase tracking-wide">Driver</th>
                    <th className="text-left py-3 px-4 text-[#E74C3C] font-semibold text-xs uppercase tracking-wide">Type</th>
                    <th className="text-left py-3 px-4 text-[#E74C3C] font-semibold text-xs uppercase tracking-wide">Entry Time</th>
                    <th className="text-left py-3 px-2 text-[#E74C3C] font-semibold text-xs uppercase tracking-wide">Duration</th>
                    <th className="text-left py-3 px-4 text-[#E74C3C] font-semibold text-xs uppercase tracking-wide">Status</th>
                    <th className="text-right py-3 px-4 text-[#E74C3C] font-semibold text-xs uppercase tracking-wide">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E0E0E0]">
                  {flaggedVehicles.slice(0, 1).map((vehicle, index) => (
                    <tr key={index} className="hover:bg-[#F7F9FB] cursor-pointer transition-colors" onClick={() => handleCheckoutClick(vehicle)}>
                      <td className="py-3 px-4 font-mono font-bold text-[#E74C3C] text-sm">{vehicle.plate_no}</td>
                      <td className="py-3 px-4 text-[#333333] text-sm">{vehicle.driver_name || '-'}</td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 text-xs font-medium bg-[rgba(51,51,51,0.08)] text-[#333333]">
                          {vehicle.driver_type || '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#555555] text-xs">
                        {vehicle.entry_time ? new Date(vehicle.entry_time).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true
                        }) : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 text-xs font-medium ${getDurationBgColor(vehicle.duration)}`}>
                          {vehicle.duration || '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 text-xs font-medium ${vehicle.status === 'active'
                            ? 'bg-[rgba(76,175,80,0.12)] text-[#388E3C]'
                            : 'bg-[rgba(51,51,51,0.08)] text-[#555555]'
                          }`}>
                          {vehicle.status === 'active' ? 'Inside' : 'Out'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {vehicle.status === 'active' ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCheckoutClick(vehicle);
                            }}
                            className="px-3 py-1.5 text-xs text-white transition-colors"
                            style={{ backgroundColor: DANGER, borderRadius: 0, fontFamily: fontHeading, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#C0392B'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = DANGER; }}
                          >
                            Checkout
                          </button>
                        ) : (
                          <span className="text-xs text-[#9E9E9E]">-</span>
                        )}
                      </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>
      </div>

      {showExportModal && (
        <ExportVisitorsModal onClose={() => setShowExportModal(false)} />
      )}
    </MainLayout>
  );
};

export default SmartParkingDashboard;