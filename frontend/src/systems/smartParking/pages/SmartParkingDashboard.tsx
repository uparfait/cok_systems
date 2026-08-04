// SmartParkingDashboard - Smart Parking System Dashboard
// Gate Officer Dashboard with City of Kigali (CoK) institutional design

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useToast } from '../../../core/contexts/ToastContext';
import { useSocket } from '../../../core/contexts/SocketContext';
import { smartParkingService, statisticsService } from '../../../core/services/adminService';
import MainLayout from '../../../core/components/Layout/MainLayout';
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

  // Handle real-time updates
  const handleParkingUpdate = useCallback((data: any) => {
    console.log('Parking update received:', data);
    fetchDashboardData();
    showInfo('Parking data updated');
  }, [fetchDashboardData, showInfo]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
      return;
    }
    fetchDashboardData();
    fetchHourlyAnalytics();
  }, [isAuthenticated, authLoading, navigate, fetchDashboardData, fetchHourlyAnalytics]);

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
        fetchDashboardData();
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
        fetchDashboardData();
        fetchHourlyAnalytics();
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
        fetchDashboardData();
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
        fetchDashboardData();
        fetchHourlyAnalytics();
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
  }, [socket, isConnected, on, off, handleParkingUpdate, fetchDashboardData, fetchHourlyAnalytics, showSuccess, showError, showWarning, showInfo]);

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
        showSuccess('Vehicle checked in successfully');
        fetchDashboardData();
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
        showSuccess('Vehicle checked out successfully');
        fetchDashboardData();
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
          <div className="p-5 transition-shadow duration-300" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium mb-1" style={{ color: PRIMARY, fontFamily: fontHeading }}>Available Slots</p>
                {statsLoading ? (
                  <div className="h-9 w-16 animate-pulse mt-1" style={{ backgroundColor: 'rgba(5,109,170,0.12)' }}></div>
                ) : (
                  <h3 className="text-3xl font-bold" style={{ color: PRIMARY, fontFamily: fontHeading }}>{stats.availableSlots}</h3>
                )}
                <p className="text-[#555555] text-xs mt-2 flex items-center gap-1">
                  <FiMapPin className="w-3 h-3" />
                  Out of {stats.totalSlots} total
                </p>
              </div>
              <div className="p-3" style={{ backgroundColor: 'rgba(5,109,170,0.08)' }}>
                <MdOutlineLocalParking className="w-6 h-6" style={{ color: PRIMARY }} />
              </div>
            </div>
</div>

          <div className="p-5 transition-shadow duration-300" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium mb-1" style={{ color: SUCCESS_HOVER, fontFamily: fontHeading }}>Regular Available</p>
                {statsLoading ? (
                  <div className="h-9 w-16 animate-pulse mt-1" style={{ backgroundColor: 'rgba(76,175,80,0.12)' }}></div>
                ) : (
                  <h3 className="text-3xl font-bold" style={{ color: SUCCESS_HOVER, fontFamily: fontHeading }}>{stats.regularAvailable}</h3>
                )}
                <p className="text-[#555555] text-xs mt-2 flex items-center gap-1">
                  <FiMapPin className="w-3 h-3" /> {stats.regularTotal} allocated
                </p>
              </div>
              <div className="p-3" style={{ backgroundColor: 'rgba(76,175,80,0.1)' }}>
                <FiTruck className="w-6 h-6" style={{ color: SUCCESS }} />
              </div>
            </div>
          </div>


          {/* Staff Reserved */}
          <div className="p-5 transition-shadow duration-300" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium mb-1" style={{ color: ACCENT_DARK_BLUE, fontFamily: fontHeading }}>Staff Reserved</p>
{statsLoading ? (
                   <div className="h-9 w-16 animate-pulse mt-1" style={{ backgroundColor: 'rgba(41,128,185,0.12)' }}></div>
                 ) : (
                   <h3 className="text-3xl font-bold" style={{ color: ACCENT_DARK_BLUE, fontFamily: fontHeading }}>{stats.staffAvailableSlots}</h3>
                 )}
                 <p className="text-[#333333] text-xs mt-2 flex items-center gap-1">
                    <FiUsers className="w-3 h-3" />
                    {stats.staffReservedSlots} allocated
                  </p>
               </div>
              <div className="p-3" style={{ backgroundColor: 'rgba(41,128,185,0.1)' }}>
                <FiShield className="w-6 h-6" style={{ color: ACCENT_DARK_BLUE }} />
              </div>
            </div>
          </div>

          {/* Visitor Reserved */}
          <div className="p-5 transition-shadow duration-300" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium mb-1" style={{ color: WARNING, fontFamily: fontHeading }}>Visitor Reserved</p>
{statsLoading ? (
                   <div className="h-9 w-16 animate-pulse mt-1" style={{ backgroundColor: 'rgba(243,156,18,0.12)' }}></div>
                 ) : (
                   <h3 className="text-3xl font-bold" style={{ color: WARNING, fontFamily: fontHeading }}>{stats.visitorAvailableSlots}</h3>
                 )}
                  <p className="text-[#333333] text-xs mt-2 flex items-center gap-1">
                    <FiTrendingUp className="w-3 h-3" />
                    {stats.visitorReservedSlots} allocated
                  </p>
               </div>
              <div className="p-3" style={{ backgroundColor: 'rgba(243,156,18,0.1)' }}>
                <FiUserPlus className="w-6 h-6" style={{ color: WARNING }} />
              </div>
            </div>
          </div>
        </div>

        {/* Export Visitors Button */}
        <div className="mb-4">
          <button
            onClick={() => setShowExportModal(true)}
            className="w-full px-6 py-3 text-white font-bold text-sm sm:text-base transition-colors flex items-center justify-center gap-2"
            style={{ backgroundColor: PRIMARY, borderRadius: 0, fontFamily: fontHeading, letterSpacing: '1px', textTransform: 'uppercase' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
          >
            <FiDownload className="w-5 h-5" />
            EXPORT VISITORS DATA
          </button>
        </div>

        {/* Hourly Analytics Graph */}
        <div className="p-4 sm:p-5 mb-6" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2" style={{ backgroundColor: 'rgba(5,109,170,0.1)' }}>
                <FiTrendingUp className="w-5 h-5 text-[#056daa]" />
              </div>
              <h2 className="text-lg font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Hourly Parking Analytics</h2>
            </div>
            <button
              onClick={fetchHourlyAnalytics}
              className="px-3 py-1.5 text-white transition-colors flex items-center gap-1"
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
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={hourlyParkingData} margin={{ top: 20, right: 30, left: 20, bottom: 25 }}>
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
                      tick={{ fontSize: 12, fill: GRAY_DISABLED }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      stroke={GRAY_DISABLED}
                      tick={{ fontSize: 12, fill: GRAY_DISABLED }}
                      axisLine={false}
                      tickLine={false}
                      label={{
                        value: 'Number of Vehicles',
                        angle: -90,
                        position: 'insideLeft',
                        style: { fill: NEUTRAL_DARK, fontSize: 12, fontWeight: 500, textAnchor: 'middle' },
                        offset: 0
                      }}
                    />
                    <Tooltip contentStyle={{
                      backgroundColor: WHITE,
                      border: `1px solid ${BORDER}`,
                      borderRadius: 0,
                      boxShadow: CARD_SHADOW
                    }} />
                    <Legend />
                    <Area type="monotone" dataKey="check_in" name="Check-ins" stroke="#056daa" strokeWidth={2} fillOpacity={1} fill="url(#colorCheckIn)" dot={{ r: 4, fill: '#fff', stroke: '#056daa', strokeWidth: 2 }} />
                    <Area type="monotone" dataKey="check_out" name="Check-outs" stroke="#E74C3C" strokeWidth={2} fillOpacity={1} fill="url(#colorCheckOut)" dot={{ r: 4, fill: '#fff', stroke: '#E74C3C', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-[#E0E0E0]">
                <div className="text-center">
                  <p className="text-sm text-[#555555]">Total Check-ins Today</p>
                  <p className="text-2xl font-bold text-[#056daa]" style={{ fontFamily: fontHeading }}>
                    {hourlyParkingData.reduce((sum, d) => sum + d.check_in, 0)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-[#555555]">Total Check-outs Today</p>
                  <p className="text-2xl font-bold text-[#E74C3C]" style={{ fontFamily: fontHeading }}>
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

      {/* Found Vehicle Modal */}
      {showFoundModal && verifiedData && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="w-full max-w-lg mx-2 sm:mx-auto overflow-hidden animate-scaleIn" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW }}>
            <div className={`px-4 sm:px-6 py-4 flex items-center justify-between border-b ${
              verifiedData.is_flagged && verifiedData.is_currently_parked
                ? 'bg-[rgba(231,76,60,0.1)] border-[#E0E0E0]'
                : verifiedData.was_ever_flagged && !verifiedData.is_currently_parked
                  ? 'bg-[rgba(243,156,18,0.1)] border-[#E0E0E0]'
                  : verifiedData.is_currently_parked
                    ? 'bg-[rgba(243,156,18,0.1)] border-[#E0E0E0]'
                    : 'bg-[rgba(76,175,80,0.1)] border-[#E0E0E0]'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-3 ${
                  verifiedData.is_flagged && verifiedData.is_currently_parked
                    ? 'bg-[rgba(231,76,60,0.15)]'
                    : verifiedData.was_ever_flagged && !verifiedData.is_currently_parked
                      ? 'bg-[rgba(243,156,18,0.15)]'
                      : verifiedData.is_currently_parked
                        ? 'bg-[rgba(243,156,18,0.15)]'
                        : 'bg-[rgba(76,175,80,0.15)]'
                }`}>
                  {verifiedData.is_flagged && verifiedData.is_currently_parked ? (
                    <FiAlertTriangle className="w-6 h-6 text-[#E74C3C]" />
                  ) : verifiedData.was_ever_flagged && !verifiedData.is_currently_parked ? (
                    <FiAlertTriangle className="w-6 h-6 text-[#F39C12]" />
                  ) : verifiedData.is_currently_parked ? (
                    <MdOutlineWarning className="w-6 h-6 text-[#F39C12]" />
                  ) : (
                    <FiCheckCircle className="w-6 h-6 text-[#388E3C]" />
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Vehicle Verification</h3>
                  <p className={`text-sm ${
                    verifiedData.is_flagged && verifiedData.is_currently_parked
                      ? 'text-[#E74C3C]'
                      : verifiedData.was_ever_flagged && !verifiedData.is_currently_parked
                        ? 'text-[#F39C12]'
                        : verifiedData.is_currently_parked
                          ? 'text-[#F39C12]'
                          : 'text-[#388E3C]'
                  }`}>
                    {verifiedData.is_flagged && verifiedData.is_currently_parked
                      ? 'Vehicle is flagged'
                      : verifiedData.was_ever_flagged && !verifiedData.is_currently_parked
                        ? 'Vehicle was flagged in the past'
                        : verifiedData.is_currently_parked
                          ? 'Already inside parking'
                          : 'Auto-scan successful'}
                  </p>
                </div>
              </div>
              <button onClick={closeAllModals} className="p-2 hover:bg-black/5 transition-colors">
                <FiX className="w-5 h-5 text-[#555555]" />
              </button>
            </div>

            <div className="p-4 sm:p-6">
              <div className="flex flex-col items-center mb-6">
                <div className="w-24 h-24 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: PRIMARY, boxShadow: CARD_SHADOW }}>
                  <span className="text-3xl font-bold text-white" style={{ fontFamily: fontHeading }}>
                    {(driverInfo.name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </span>
                </div>
                {verifiedData.staff_details?.department_name && (
                  <div className="px-3 py-1 bg-[rgba(41,128,185,0.1)] border border-[#E0E0E0]">
                    <span className="text-xs font-medium text-[#2980B9]">
                      {verifiedData.staff_details.department_name}
                    </span>
                  </div>
                )}
              </div>

              <div className="mb-4 p-4" style={{ backgroundColor: NEUTRAL_LIGHT }}>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>
                    <FiUser className="w-4 h-4 text-[#056daa]" />
                    Driver Information
                    {verifiedData.is_reserved && (
                      <span className="px-2 py-0.5 bg-[rgba(76,175,80,0.12)] text-[#388E3C] text-xs font-medium">
                        Reserved
                      </span>
                    )}
                  </h4>
                  {!verifiedData.is_currently_parked && !verifiedData.is_reserved && (
                    <button
                      onClick={() => setIsEditingDriver(!isEditingDriver)}
                      className="text-xs flex items-center gap-1 px-2 py-1 bg-[rgba(5,109,170,0.08)] hover:bg-[rgba(5,109,170,0.15)] text-[#056daa] transition-colors"
                      style={{ fontFamily: fontHeading, fontWeight: 600 }}
                    >
                      <FiEdit className="w-3 h-3" />
                      {isEditingDriver ? 'Cancel' : 'Edit'}
                    </button>
                  )}
                </div>

                {isEditingDriver ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      name="name"
                      value={driverInfo.name}
                      onChange={handleDriverInfoChange}
                      placeholder="Driver name"
                      className="w-full px-3 py-2 text-sm"
                      style={{ fontFamily: fontHeading, fontSize: 14, backgroundColor: NEUTRAL_LIGHT, border: '1px solid transparent', borderRadius: 0, boxShadow: '0px 2px 4px rgba(0,0,0,0.1)' }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(5,109,170,0.25)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)'; }}
                    />
                    <input
                      type="tel"
                      name="telephone"
                      value={driverInfo.telephone}
                      onChange={handleDriverInfoChange}
                      placeholder="Phone number"
                      className="w-full px-3 py-2 text-sm"
                      style={{ fontFamily: fontHeading, fontSize: 14, backgroundColor: NEUTRAL_LIGHT, border: '1px solid transparent', borderRadius: 0, boxShadow: '0px 2px 4px rgba(0,0,0,0.1)' }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(5,109,170,0.25)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)'; }}
                    />
                    <div>
                      <input
                        type="text"
                        name="badge_number"
                        value={driverInfo.badge_number}
                        onChange={handleDriverInfoChange}
                        placeholder={verifiedData.is_reserved ? "Badge number (optional for reserved)" : "Badge number *"}
                        className="w-full px-3 py-2 text-sm"
                      style={{ fontFamily: fontHeading, fontSize: 14, backgroundColor: NEUTRAL_LIGHT, border: '1px solid transparent', borderRadius: 0, boxShadow: '0px 2px 4px rgba(0,0,0,0.1)' }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = '0px 4px 8px rgba(5,109,170,0.25)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)'; }}
                        required={!verifiedData.is_reserved}
                      />
                      <p className="text-xs text-[#555555] mt-1 flex items-center gap-1">
                        <FiInfo className="w-3 h-3" />
                        {verifiedData.is_reserved ? 'Optional for reserved vehicles' : 'Required for check-in'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-2 bg-white">
                      <FiUser className="w-4 h-4 text-[#9E9E9E]" />
                      <span className="text-sm text-[#333333]">{driverInfo.name || 'Not specified'}</span>
                    </div>
                    <div className="flex items-center gap-3 p-2 bg-white">
                      <FiPhone className="w-4 h-4 text-[#9E9E9E]" />
                      <span className="text-sm text-[#333333]">{driverInfo.telephone || 'Not specified'}</span>
                    </div>
                    <div className="flex items-center gap-3 p-2 bg-white">
                      <FaRegIdCard className="w-4 h-4 text-[#9E9E9E]" />
                      <span className="text-sm text-[#333333] font-medium">
                        Badge: {driverInfo.badge_number || (verifiedData.is_reserved ? '___ (Reserved)' : 'Not specified')}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 mb-4" style={{ backgroundColor: NEUTRAL_LIGHT }}>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="mb-1" style={{ fontFamily: fontHeading, fontSize: 13, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: TERTIARY }}>Vehicle Type</p>
                    <p className="text-lg font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>
                      {verifiedData.vehicle_category || 'Staff Vehicle'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="mb-1" style={{ fontFamily: fontHeading, fontSize: 13, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: TERTIARY }}>Plate Number</p>
                    <p className="text-xl font-mono font-bold text-[#333333] tracking-wide">
                      {verifiedData.plate_number}
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleConfirmEntry}
                disabled={verifiedData.is_currently_parked}
                className={`w-full py-3 px-4 font-semibold text-sm sm:text-base transition-colors flex items-center justify-center gap-2 ${
                  verifiedData.is_currently_parked
                    ? 'cursor-not-allowed'
                    : ''
                }`}
                style={{ backgroundColor: verifiedData.is_currently_parked ? GRAY_DISABLED : SUCCESS, color: WHITE, borderRadius: 0, fontFamily: fontHeading, letterSpacing: '1px', textTransform: 'uppercase' }}
                onMouseEnter={(e) => { if (!verifiedData.is_currently_parked) e.currentTarget.style.backgroundColor = SUCCESS_HOVER; }}
                onMouseLeave={(e) => { if (!verifiedData.is_currently_parked) e.currentTarget.style.backgroundColor = SUCCESS; }}
              >
                <FiCheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                {verifiedData.is_currently_parked ? 'Already Checked In' : 'Confirm Entry & Open Gate'}
              </button>

              <button
                onClick={closeAllModals}
                className="w-full mt-2 py-2 px-4 font-medium transition-colors flex items-center justify-center gap-2"
                style={{ backgroundColor: 'transparent', border: `1px solid ${PRIMARY}`, color: PRIMARY, borderRadius: 0, fontFamily: fontHeading, fontSize: 13, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(5,109,170,0.08)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <FiX className="w-3 h-3 sm:w-4 sm:h-4" />
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Confirmation Modal */}
      {showCheckoutConfirmModal && checkoutVehicle && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="w-full max-w-sm mx-2 sm:mx-auto p-4 sm:p-6 animate-scaleIn" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW }}>
            <div className="text-center mb-4 sm:mb-6">
              <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 bg-[rgba(231,76,60,0.12)] rounded-full flex items-center justify-center">
                <FiAlertTriangle className="w-6 h-6 sm:w-8 sm:h-8 text-[#E74C3C]" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold mb-2" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Confirm Checkout</h3>
              <p className="text-sm sm:text-base text-[#555555]">Are you sure you want to check out this flagged vehicle?</p>
            </div>

            <div className="p-3 sm:p-4 mb-4 sm:mb-6 border border-[#E0E0E0]" style={{ backgroundColor: NEUTRAL_LIGHT }}>
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: DANGER }}>
                  <FiTruck className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="font-mono font-bold text-[#333333] text-sm sm:text-base truncate">{checkoutVehicle.plate_no}</div>
                  <div className="text-xs sm:text-sm text-[#555555] truncate">{checkoutVehicle.driver_name || 'Unknown Driver'}</div>
                </div>
              </div>

              <div className="space-y-1 sm:space-y-2 text-xs sm:text-sm">
                <div className="flex justify-between items-center py-1 sm:py-2 border-t border-[#E0E0E0]">
                  <span className="text-[#555555] flex items-center gap-1">
                    <FiClock className="w-3 h-3 sm:w-4 sm:h-4" />
                    Duration:
                  </span>
                  <span className="font-medium text-[#E74C3C]">{checkoutVehicle.duration || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center py-1 sm:py-2 border-t border-[#E0E0E0]">
                  <span className="text-[#555555] flex items-center gap-1">
                    <FiUser className="w-3 h-3 sm:w-4 sm:h-4" />
                    Driver Type:
                  </span>
                  <span className="font-medium text-[#333333]">{checkoutVehicle.driver_type || 'Unknown'}</span>
                </div>
                <div className="flex justify-between items-center py-1 sm:py-2 border-t border-[#E0E0E0]">
                  <span className="text-[#555555] flex items-center gap-1">
                    <FiActivity className="w-3 h-3 sm:w-4 sm:h-4" />
                    Status:
                  </span>
                  <span className="font-medium text-[#388E3C] text-xs sm:text-sm">Inside (Active)</span>
                </div>
                {checkoutVehicle.entry_time && (
                  <div className="flex justify-between items-center py-1 sm:py-2 border-t border-[#E0E0E0]">
                    <span className="text-[#555555] flex items-center gap-1">
                      <FiCalendar className="w-3 h-3 sm:w-4 sm:h-4" />
                      Entry Time:
                    </span>
                    <span className="font-medium text-[#333333] text-xs sm:text-sm">
                      {new Date(checkoutVehicle.entry_time).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 sm:gap-3">
              <button
                onClick={closeAllModals}
                className="flex-1 py-2 sm:py-3 font-medium transition-colors text-sm sm:text-base"
                style={{ backgroundColor: 'transparent', border: `1px solid ${PRIMARY}`, color: PRIMARY, borderRadius: 0, fontFamily: fontHeading, fontSize: 13, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(5,109,170,0.08)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCheckout}
                disabled={loading}
                className="flex-1 py-2 sm:py-3 text-white font-medium transition-colors flex items-center justify-center gap-1 sm:gap-2 disabled:opacity-50 text-sm sm:text-base"
                style={{ backgroundColor: DANGER, borderRadius: 0, fontFamily: fontHeading, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#C0392B'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = DANGER; }}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-2 border-white border-t-transparent"></div>
                    <span className="hidden sm:inline">Processing...</span>
                    <span className="sm:hidden">...</span>
                  </>
                ) : (
                  <>
                    <FiCheck className="w-4 h-4" />
                    <span>Confirm</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Flagged Vehicles Modal */}
      {showFlaggedModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="w-full max-w-5xl mx-2 sm:mx-auto overflow-hidden animate-scaleIn" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW }}>
            <div className="bg-[rgba(231,76,60,0.1)] px-4 sm:px-6 py-4 border-b border-[#E0E0E0] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-[rgba(231,76,60,0.15)]">
                  <BsExclamationTriangle className="w-6 h-6 text-[#E74C3C]" />
                </div>
                <div>
                  <h3 className="text-xl font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Flagged Vehicles</h3>
                  <p className="text-sm text-[#555555]">
                    {flaggedTotal} flagged vehicle{flaggedTotal !== 1 ? 's' : ''} currently inside
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowFlaggedModal(false)}
                className="p-2 hover:bg-black/5 transition-colors"
              >
                <FiX className="w-5 h-5 text-[#555555]" />
              </button>
            </div>

            <div className="p-4 sm:p-6">
              {modalFlaggedLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-[#9E9E9E]">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#056daa] border-t-transparent mb-2"></div>
                  <p className="text-sm">Loading flagged vehicles...</p>
                </div>
              ) : modalFlaggedVehicles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-[#9E9E9E]">
                  <BsShieldCheck className="w-16 h-16 mb-3 opacity-50" />
                  <p className="text-sm">No flagged vehicles currently inside the parking</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[rgba(231,76,60,0.06)] sticky top-0">
                        <tr>
                          <th className="text-left py-3 px-4 text-[#E74C3C] font-semibold text-xs uppercase tracking-wide">Plate No.</th>
                          <th className="text-left py-3 px-4 text-[#E74C3C] font-semibold text-xs uppercase tracking-wide">Driver</th>
                          <th className="text-left py-3 px-4 text-[#E74C3C] font-semibold text-xs uppercase tracking-wide">Type</th>
                          <th className="text-left py-3 px-4 text-[#E74C3C] font-semibold text-xs uppercase tracking-wide">Entry Time</th>
                          <th className="text-left py-3 px-4 text-[#E74C3C] font-semibold text-xs uppercase tracking-wide">Duration</th>
                          <th className="text-left py-3 px-4 text-[#E74C3C] font-semibold text-xs uppercase tracking-wide">Status</th>
                          <th className="text-right py-3 px-4 text-[#E74C3C] font-semibold text-xs uppercase tracking-wide">Action</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E0E0E0]">
                        {modalFlaggedVehicles.map((vehicle, index) => (
                          <tr key={index} className="hover:bg-[#F7F9FB] transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-[#E74C3C]">{vehicle.plate_no}</td>
                            <td className="py-3 px-4 text-[#333333]">{vehicle.driver_name || '-'}</td>
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
                              <span className={`px-2.5 py-1 text-xs font-medium ${
                                vehicle.status === 'active'
                                  ? 'bg-[rgba(76,175,80,0.12)] text-[#388E3C]'
                                  : 'bg-[rgba(51,51,51,0.08)] text-[#555555]'
                              }`}>
                                {vehicle.status === 'active' ? 'Inside' : 'Out'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              {vehicle.status === 'active' ? (
                                <button
                                  onClick={() => {
                                    setShowFlaggedModal(false);
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
                  
                  {/* Pagination Controls */}
                  {flaggedTotal > flaggedLimit && (
                    <div className="flex justify-between items-center mt-4 pt-4 border-t border-[#E0E0E0]">
                      <button
                        onClick={() => handleModalFlaggedPageChange(Math.max(1, modalFlaggedPage - 1))}
                        disabled={modalFlaggedPage === 1 || modalFlaggedLoading}
                        className="px-3 py-1 text-sm bg-white border border-[#E0E0E0] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#F7F9FB] transition-colors"
                        style={{ borderRadius: 0, fontFamily: fontHeading, color: NEUTRAL_DARK }}
                      >
                        Previous
                      </button>
                      <span className="text-sm text-[#555555]">
                        Page {modalFlaggedPage} of {Math.ceil(flaggedTotal / flaggedLimit)}
                      </span>
                      <button
                        onClick={() => handleModalFlaggedPageChange(Math.min(Math.ceil(flaggedTotal / flaggedLimit), modalFlaggedPage + 1))}
                        disabled={modalFlaggedPage >= Math.ceil(flaggedTotal / flaggedLimit) || modalFlaggedLoading}
                        className="px-3 py-1 text-sm bg-white border border-[#E0E0E0] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#F7F9FB] transition-colors"
                        style={{ borderRadius: 0, fontFamily: fontHeading, color: NEUTRAL_DARK }}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        )}
        {showExportModal && (
          <ExportVisitorsModal onClose={() => setShowExportModal(false)} />
        )}
       </MainLayout>
    );
  };

export default SmartParkingDashboard;