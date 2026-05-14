// SmartParkingDashboard - Smart Parking System Dashboard
// Gate Officer Dashboard with Modern Glassmorphism Design

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useToast } from '../../../core/contexts/ToastContext';
import { useSocket } from '../../../core/contexts/SocketContext';
import { smartParkingService, statisticsService } from '../../../core/services/adminService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import {
  FiTruck, FiShield, FiCheckCircle, FiAlertTriangle, FiUser, FiUserPlus,
  FiPhone, FiX, FiEdit, FiActivity, FiCalendar, FiMapPin, FiTrendingUp, FiUsers, FiInfo, FiClock, FiCheck
} from 'react-icons/fi';
import { BsShieldCheck, BsExclamationTriangle } from 'react-icons/bs';
import { MdOutlineLocalParking, MdOutlineWarning } from 'react-icons/md';
import { FaRegIdCard } from 'react-icons/fa';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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

  // Data states
  const [verifiedData, setVerifiedData] = useState<VehicleData | null>(null);

   // Stats data from API
   const [stats, setStats] = useState({
     availableSlots: 0,
     totalSlots: 350,
     staffVehicles: 0,
     visitorVehicles: 0,
     reservedSlots: 0,
     newVisitors: 0,
     totalInside: 0,
     totalOutside: 0,
     flaggedButInside: 0,
     staffReserved: 0,
     visitorReserved: 0,
     staffReservedSlots: 100,
     visitorReservedSlots: 50,
     regularAvailable: 0,
     regularReserved: 0,
     regularTotal: 200
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

setStats(prev => ({
            ...prev,
            totalInside: total || 0,
            totalSlots: slotsData?.totalSlots || 0,
            availableSlots: (slotsData?.visitorsAvailableSlots || 0) + (slotsData?.staffAvailableSlots || 0) + (slotsData?.RegularAvailableSlots || 0),
            visitorVehicles: by_driver_type?.Visitor || 0,
            staffVehicles: (by_driver_type?.Staff || 0) + (by_driver_type?.Regular || 0),
            staffReserved: slotsData?.staffReservationCount || 0,
            staffReservedSlots: slotsData?.staffReservedSlots || 0,
            visitorReserved: slotsData?.visitorReservationCount || 0,
            visitorReservedSlots: slotsData?.visitorsReservedSlots || 0,
            regularAvailable: slotsData?.RegularAvailableSlots || 0,
            regularReserved: slotsData?.RegularReservedSlots || 0,
            regularTotal: (slotsData?.RegularAvailableSlots || 0) + (slotsData?.RegularReservedSlots || 0)
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
    if (hours >= 9) return 'bg-red-500/20 text-red-600 border border-red-200';
    if (hours >= 5) return 'bg-orange-500/20 text-orange-600 border border-orange-200';
    return 'bg-gray-500/20 text-gray-600 border border-gray-200';
  };

  // Helper function to get card colors based on occupancy percentage
  const getOccupancyColors = (occupied: number, total: number) => {
    const percentage = (occupied / total) * 100;
    if (percentage >= 100) return {
      bg: 'bg-gradient-to-br from-red-500/20 to-red-600/20',
      text: 'text-red-700',
      border: 'border-red-200',
      icon: 'text-red-700'
    };
    if (percentage >= 90) return {
      bg: 'bg-gradient-to-br from-orange-500/20 to-orange-600/20',
      text: 'text-orange-700',
      border: 'border-orange-200',
      icon: 'text-orange-700'
    };
    if (percentage >= 80) return {
      bg: 'bg-gradient-to-br from-yellow-500/20 to-yellow-600/20',
      text: 'text-yellow-700',
      border: 'border-yellow-200',
      icon: 'text-yellow-700'
    };
    return {
      bg: 'bg-gradient-to-br from-blue-500/20 to-blue-600/20',
      text: 'text-blue-700',
      border: 'border-blue-200',
      icon: 'text-blue-700'
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
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <MainLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30 p-2 sm:p-3 md:p-4 lg:p-6">

        {/* Main Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-4">
          <div className="group backdrop-blur-xl bg-white/80 rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-white/20">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-blue-700 text-sm font-medium mb-1">Available Slots</p>
                {statsLoading ? (
                  <div className="h-9 w-16 bg-blue-200/50 rounded animate-pulse mt-1"></div>
                ) : (
                  <h3 className="text-3xl font-bold text-blue-700">{stats.availableSlots}</h3>
                )}
                <p className="text-gray-600 text-xs mt-2 flex items-center gap-1">
                  <FiMapPin className="w-3 h-3" />
                  Out of {stats.totalSlots} total
                </p>
              </div>
              <div className="p-3 bg-white/20 backdrop-blur rounded-xl group-hover:scale-110 transition-transform">
                <MdOutlineLocalParking className="w-6 h-6 text-blue-700" />
              </div>
            </div>
</div>

          <div className="group backdrop-blur-xl bg-white/80 rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-white/20">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-emerald-700 text-sm font-medium mb-1">Regular Available</p>
                {statsLoading ? (
                  <div className="h-9 w-16 bg-emerald-200/50 rounded animate-pulse mt-1"></div>
                ) : (
                  <h3 className="text-3xl font-bold text-emerald-700">{stats.regularAvailable}</h3>
                )}
                <p className="text-gray-600 text-xs mt-2 flex items-center gap-1">
                  <FiMapPin className="w-3 h-3" /> {stats.regularAvailable}/{stats.regularTotal} allocated
                </p>
              </div>
              <div className="p-3 bg-white/20 backdrop-blur rounded-xl group-hover:scale-110 transition-transform">
                <FiTruck className="w-6 h-6 text-emerald-700" />
              </div>
            </div>
          </div>


          {/* Staff Reserved */}
          <div className="group backdrop-blur-xl bg-white/80 rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-white/20">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-purple-700 text-sm font-medium mb-1">Staff Reserved</p>
{statsLoading ? (
                   <div className="h-9 w-16 bg-purple-200/50 rounded animate-pulse mt-1"></div>
                 ) : (
                   <h3 className="text-3xl font-bold text-purple-700">{stats.staffReserved}</h3>
                 )}
                 <p className="text-gray-700 text-xs mt-2 flex items-center gap-1">
                    <FiUsers className="w-3 h-3" />
                    {stats.staffReserved}/{stats.staffReservedSlots} allocated
                  </p>
               </div>
              <div className="p-3 bg-white/20 backdrop-blur rounded-xl group-hover:scale-110 transition-transform">
                <FiShield className="w-6 h-6 text-purple-700" />
              </div>
            </div>
          </div>

          {/* Visitor Reserved */}
          <div className="group backdrop-blur-xl bg-white/80 rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-white/20">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-amber-700 text-sm font-medium mb-1">Visitor Reserved</p>
{statsLoading ? (
                   <div className="h-9 w-16 bg-amber-200/50 rounded animate-pulse mt-1"></div>
                 ) : (
                   <h3 className="text-3xl font-bold text-amber-700">{stats.visitorReserved}</h3>
                 )}
                  <p className="text-gray-700 text-xs mt-2 flex items-center gap-1">
                    <FiTrendingUp className="w-3 h-3" />
                    {stats.visitorReserved}/{stats.visitorReservedSlots} allocated
                  </p>
               </div>
              <div className="p-3 bg-white/20 backdrop-blur rounded-xl group-hover:scale-110 transition-transform">
                <FiUserPlus className="w-6 h-6 text-amber-700" />
              </div>
            </div>
          </div>
        </div>

        {/* Hourly Analytics Graph */}
        <div className="backdrop-blur-xl bg-white/80 rounded-2xl shadow-xl border border-white/30 p-4 sm:p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-xl">
                <FiTrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-800">Hourly Parking Analytics</h2>
            </div>
            <button
              onClick={fetchHourlyAnalytics}
              className="text-sm px-3 py-1.5 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 hover:from-blue-500/20 hover:to-indigo-500/20 rounded-full text-blue-600 font-medium transition-all flex items-center gap-1"
            >
              <FiActivity className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>

          {(analyticsLoading && firstLoad) ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
            </div>
          ) : hourlyParkingData.length > 0 ? (
            <div className="overflow-x-auto">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={hourlyParkingData} margin={{ top: 20, right: 30, left: 20, bottom: 25 }}>
                    <defs>
                      <linearGradient id="colorCheckIn" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00aaff" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#00aaff" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="colorCheckOut" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis
                      dataKey="hour"
                      tickFormatter={(value: number) => `${value.toString().padStart(2, '0')}:00`}
                      stroke="#9ca3af"
                      tick={{ fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#9ca3af"
                      tick={{ fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      label={{
                        value: 'Number of Vehicles',
                        angle: -90,
                        position: 'insideLeft',
                        style: { fill: '#6b7280', fontSize: 12, fontWeight: 500, textAnchor: 'middle' },
                        offset: 0
                      }}
                    />
                    <Tooltip contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }} />
                    <Legend />
                    <Area type="monotone" dataKey="check_in" name="Check-ins" stroke="#00aaff" strokeWidth={2} fillOpacity={1} fill="url(#colorCheckIn)" dot={{ r: 4, fill: '#fff', stroke: '#00aaff', strokeWidth: 2 }} />
                    <Area type="monotone" dataKey="check_out" name="Check-outs" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorCheckOut)" dot={{ r: 4, fill: '#fff', stroke: '#ef4444', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
                <div className="text-center">
                  <p className="text-sm text-gray-500">Total Check-ins Today</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {hourlyParkingData.reduce((sum, d) => sum + d.check_in, 0)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Total Check-outs Today</p>
                  <p className="text-2xl font-bold text-red-600">
                    {hourlyParkingData.reduce((sum, d) => sum + d.check_out, 0)}
                  </p>
            </div>
          </div>

          
        </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <FiTrendingUp className="w-12 h-12 mb-2 opacity-50" />
              <p className="text-sm">No hourly data available</p>
              <button
                onClick={fetchHourlyAnalytics}
                className="mt-2 text-sm text-blue-600 hover:underline"
              >
                Click to refresh
              </button>
            </div>
          )}
        </div>

        {/* Flagged Vehicles Section */}
        <div className="backdrop-blur-xl bg-white/80 rounded-2xl shadow-xl border border-white/30 p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-xl">
                <BsExclamationTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-800">Flagged Vehicles</h2>
            </div>
            <div className="flex items-center gap-2">
              {flaggedTotal > 0 && (
                <span className="text-sm text-gray-600">
                  Page {flaggedPage} of {Math.ceil(flaggedTotal / flaggedLimit)}
                </span>
              )}
              <button
                onClick={() => {
                  setModalFlaggedPage(flaggedPage);
                  setModalFlaggedVehicles(flaggedVehicles);
                  setShowFlaggedModal(true);
                }}
                className="text-sm px-3 py-1.5 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 hover:from-blue-500/20 hover:to-indigo-500/20 rounded-full text-blue-600 font-medium transition-all"
              >
                View All ({flaggedTotal})
              </button>
            </div>
          </div>

          {flaggedLoading ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mb-2"></div>
              <p className="text-sm">Loading flagged vehicles...</p>
            </div>
          ) : flaggedVehicles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <BsShieldCheck className="w-12 h-12 mb-2 opacity-50" />
              <p className="text-sm">No flagged vehicles at the moment</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gradient-to-r from-red-600/10 to-red-500/10">
                  <tr>
                    <th className="text-left py-3 px-4 text-red-700 font-semibold text-xs uppercase tracking-wide">Plate No.</th>
                    <th className="text-left py-3 px-4 text-red-700 font-semibold text-xs uppercase tracking-wide">Driver</th>
                    <th className="text-left py-3 px-4 text-red-700 font-semibold text-xs uppercase tracking-wide">Type</th>
                    <th className="text-left py-3 px-4 text-red-700 font-semibold text-xs uppercase tracking-wide">Entry Time</th>
                    <th className="text-left py-3 px-2 text-red-700 font-semibold text-xs uppercase tracking-wide">Duration</th>
                    <th className="text-left py-3 px-4 text-red-700 font-semibold text-xs uppercase tracking-wide">Status</th>
                    <th className="text-right py-3 px-4 text-red-700 font-semibold text-xs uppercase tracking-wide">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-100">
                  {flaggedVehicles.slice(0, 1).map((vehicle, index) => (
                    <tr key={index} className="hover:bg-red-50 cursor-pointer transition-colors" onClick={() => handleCheckoutClick(vehicle)}>
                      <td className="py-3 px-4 font-mono font-bold text-red-600 text-sm">{vehicle.plate_no}</td>
                      <td className="py-3 px-4 text-gray-700 text-sm">{vehicle.driver_name || '-'}</td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                          {vehicle.driver_type || '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600 text-xs">
                        {vehicle.entry_time ? new Date(vehicle.entry_time).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true
                        }) : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getDurationBgColor(vehicle.duration)}`}>
                          {vehicle.duration || '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${vehicle.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
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
                            className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all shadow-sm"
                          >
                            Checkout
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-lg mx-2 sm:mx-auto overflow-hidden border border-white/50 animate-scaleIn">
            <div className={`px-4 sm:px-6 py-4 flex items-center justify-between border-b ${
              verifiedData.is_flagged && verifiedData.is_currently_parked
                ? 'bg-gradient-to-r from-red-500/20 to-red-600/20 border-red-200'
                : verifiedData.was_ever_flagged && !verifiedData.is_currently_parked
                  ? 'bg-gradient-to-r from-orange-500/20 to-amber-500/20 border-orange-200'
                  : verifiedData.is_currently_parked
                    ? 'bg-gradient-to-r from-orange-500/20 to-amber-500/20 border-orange-200'
                    : 'bg-gradient-to-r from-emerald-500/20 to-green-500/20 border-green-200'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl backdrop-blur-sm ${
                  verifiedData.is_flagged && verifiedData.is_currently_parked
                    ? 'bg-red-500/20'
                    : verifiedData.was_ever_flagged && !verifiedData.is_currently_parked
                      ? 'bg-orange-500/20'
                      : verifiedData.is_currently_parked
                        ? 'bg-orange-500/20'
                        : 'bg-emerald-500/20'
                }`}>
                  {verifiedData.is_flagged && verifiedData.is_currently_parked ? (
                    <FiAlertTriangle className="w-6 h-6 text-red-600" />
                  ) : verifiedData.was_ever_flagged && !verifiedData.is_currently_parked ? (
                    <FiAlertTriangle className="w-6 h-6 text-orange-600" />
                  ) : verifiedData.is_currently_parked ? (
                    <MdOutlineWarning className="w-6 h-6 text-orange-600" />
                  ) : (
                    <FiCheckCircle className="w-6 h-6 text-emerald-600" />
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Vehicle Verification</h3>
                  <p className={`text-sm ${
                    verifiedData.is_flagged && verifiedData.is_currently_parked
                      ? 'text-red-600'
                      : verifiedData.was_ever_flagged && !verifiedData.is_currently_parked
                        ? 'text-orange-600'
                        : verifiedData.is_currently_parked
                          ? 'text-orange-600'
                          : 'text-emerald-600'
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
              <button onClick={closeAllModals} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                <FiX className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="p-4 sm:p-6">
              <div className="flex flex-col items-center mb-6">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-xl mb-3">
                  <span className="text-3xl font-bold text-white">
                    {(driverInfo.name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </span>
                </div>
                {verifiedData.staff_details?.department_name && (
                  <div className="px-3 py-1 bg-gradient-to-r from-purple-500/10 to-pink-500/10 backdrop-blur-sm rounded-full border border-purple-200">
                    <span className="text-xs font-medium text-purple-600">
                      {verifiedData.staff_details.department_name}
                    </span>
                  </div>
                )}
              </div>

              <div className="mb-4 bg-gradient-to-br from-gray-500/5 to-gray-500/10 backdrop-blur-sm rounded-xl p-4 border border-white/50">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <FiUser className="w-4 h-4 text-blue-500" />
                    Driver Information
                    {verifiedData.is_reserved && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                        Reserved
                      </span>
                    )}
                  </h4>
                  {!verifiedData.is_currently_parked && !verifiedData.is_reserved && (
                    <button
                      onClick={() => setIsEditingDriver(!isEditingDriver)}
                      className="text-xs flex items-center gap-1 px-2 py-1 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg text-blue-600 transition-colors"
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
                      className="w-full px-3 py-2 bg-white/50 backdrop-blur border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    <input
                      type="tel"
                      name="telephone"
                      value={driverInfo.telephone}
                      onChange={handleDriverInfoChange}
                      placeholder="Phone number"
                      className="w-full px-3 py-2 bg-white/50 backdrop-blur border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    <div>
                      <input
                        type="text"
                        name="badge_number"
                        value={driverInfo.badge_number}
                        onChange={handleDriverInfoChange}
                        placeholder={verifiedData.is_reserved ? "Badge number (optional for reserved)" : "Badge number *"}
                        className="w-full px-3 py-2 bg-white/50 backdrop-blur border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        required={!verifiedData.is_reserved}
                      />
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <FiInfo className="w-3 h-3" />
                        {verifiedData.is_reserved ? 'Optional for reserved vehicles' : 'Required for check-in'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-2 bg-white/50 backdrop-blur rounded-lg">
                      <FiUser className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-700">{driverInfo.name || 'Not specified'}</span>
                    </div>
                    <div className="flex items-center gap-3 p-2 bg-white/50 backdrop-blur rounded-lg">
                      <FiPhone className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-700">{driverInfo.telephone || 'Not specified'}</span>
                    </div>
                    <div className="flex items-center gap-3 p-2 bg-white/50 backdrop-blur rounded-lg">
                      <FaRegIdCard className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-700 font-medium">
                        Badge: {driverInfo.badge_number || (verifiedData.is_reserved ? '___ (Reserved)' : 'Not specified')}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-gradient-to-r from-gray-500/5 to-gray-500/10 backdrop-blur-sm rounded-xl p-4 mb-4 border border-white/50">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Vehicle Type</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {verifiedData.vehicle_category || 'Staff Vehicle'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Plate Number</p>
                    <p className="text-xl font-mono font-bold text-gray-900 tracking-wide">
                      {verifiedData.plate_number}
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleConfirmEntry}
                disabled={verifiedData.is_currently_parked}
                className={`w-full py-3 px-4 rounded-xl font-semibold text-sm sm:text-base transition-all flex items-center justify-center gap-2 ${
                  verifiedData.is_currently_parked
                    ? 'bg-gray-300 cursor-not-allowed text-gray-600'
                    : 'bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white shadow-lg hover:shadow-xl'
                }`}
              >
                <FiCheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                {verifiedData.is_currently_parked ? 'Already Checked In' : 'Confirm Entry & Open Gate'}
              </button>

              <button
                onClick={closeAllModals}
                className="w-full mt-2 py-2 px-4 bg-white/50 backdrop-blur hover:bg-white/80 border border-gray-200 text-gray-700 rounded-xl font-medium transition-all flex items-center justify-center gap-2"
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-sm mx-2 sm:mx-auto p-4 sm:p-6 border border-white/50 animate-scaleIn">
            <div className="text-center mb-4 sm:mb-6">
              <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 bg-gradient-to-r from-red-500/20 to-orange-500/20 rounded-full flex items-center justify-center">
                <FiAlertTriangle className="w-6 h-6 sm:w-8 sm:h-8 text-red-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">Confirm Checkout</h3>
              <p className="text-sm sm:text-base text-gray-600">Are you sure you want to check out this flagged vehicle?</p>
            </div>

            <div className="bg-gradient-to-r from-red-500/5 to-orange-500/5 backdrop-blur-sm rounded-xl p-3 sm:p-4 mb-4 sm:mb-6 border border-red-200">
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <FiTruck className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="font-mono font-bold text-gray-900 text-sm sm:text-base truncate">{checkoutVehicle.plate_no}</div>
                  <div className="text-xs sm:text-sm text-gray-600 truncate">{checkoutVehicle.driver_name || 'Unknown Driver'}</div>
                </div>
              </div>

              <div className="space-y-1 sm:space-y-2 text-xs sm:text-sm">
                <div className="flex justify-between items-center py-1 sm:py-2 border-t border-red-100">
                  <span className="text-gray-500 flex items-center gap-1">
                    <FiClock className="w-3 h-3 sm:w-4 sm:h-4" />
                    Duration:
                  </span>
                  <span className="font-medium text-red-600">{checkoutVehicle.duration || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center py-1 sm:py-2 border-t border-red-100">
                  <span className="text-gray-500 flex items-center gap-1">
                    <FiUser className="w-3 h-3 sm:w-4 sm:h-4" />
                    Driver Type:
                  </span>
                  <span className="font-medium text-gray-700">{checkoutVehicle.driver_type || 'Unknown'}</span>
                </div>
                <div className="flex justify-between items-center py-1 sm:py-2 border-t border-red-100">
                  <span className="text-gray-500 flex items-center gap-1">
                    <FiActivity className="w-3 h-3 sm:w-4 sm:h-4" />
                    Status:
                  </span>
                  <span className="font-medium text-green-600 text-xs sm:text-sm">Inside (Active)</span>
                </div>
                {checkoutVehicle.entry_time && (
                  <div className="flex justify-between items-center py-1 sm:py-2 border-t border-red-100">
                    <span className="text-gray-500 flex items-center gap-1">
                      <FiCalendar className="w-3 h-3 sm:w-4 sm:h-4" />
                      Entry Time:
                    </span>
                    <span className="font-medium text-gray-700 text-xs sm:text-sm">
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
                className="flex-1 py-2 sm:py-3 bg-white/50 backdrop-blur hover:bg-white/80 border border-gray-200 text-gray-700 rounded-xl font-medium transition-all text-sm sm:text-base"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCheckout}
                disabled={loading}
                className="flex-1 py-2 sm:py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-1 sm:gap-2 disabled:opacity-50 text-sm sm:text-base"
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-5xl mx-2 sm:mx-auto overflow-hidden border border-white/50 animate-scaleIn">
            <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 px-4 sm:px-6 py-4 border-b border-red-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-500/20 rounded-xl">
                  <BsExclamationTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Flagged Vehicles</h3>
                  <p className="text-sm text-gray-600">
                    {flaggedTotal} flagged vehicle{flaggedTotal !== 1 ? 's' : ''} currently inside
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowFlaggedModal(false)}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
              >
                <FiX className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="p-4 sm:p-6">
              {modalFlaggedLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mb-2"></div>
                  <p className="text-sm">Loading flagged vehicles...</p>
                </div>
              ) : modalFlaggedVehicles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <BsShieldCheck className="w-16 h-16 mb-3 opacity-50" />
                  <p className="text-sm">No flagged vehicles currently inside the parking</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gradient-to-r from-red-600/10 to-red-500/10 sticky top-0">
                        <tr>
                          <th className="text-left py-3 px-4 text-red-700 font-semibold text-xs uppercase tracking-wide">Plate No.</th>
                          <th className="text-left py-3 px-4 text-red-700 font-semibold text-xs uppercase tracking-wide">Driver</th>
                          <th className="text-left py-3 px-4 text-red-700 font-semibold text-xs uppercase tracking-wide">Type</th>
                          <th className="text-left py-3 px-4 text-red-700 font-semibold text-xs uppercase tracking-wide">Entry Time</th>
                          <th className="text-left py-3 px-4 text-red-700 font-semibold text-xs uppercase tracking-wide">Duration</th>
                          <th className="text-left py-3 px-4 text-red-700 font-semibold text-xs uppercase tracking-wide">Status</th>
                          <th className="text-right py-3 px-4 text-red-700 font-semibold text-xs uppercase tracking-wide">Action</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-red-100">
                        {modalFlaggedVehicles.map((vehicle, index) => (
                          <tr key={index} className="hover:bg-red-50 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-red-600">{vehicle.plate_no}</td>
                            <td className="py-3 px-4 text-gray-700">{vehicle.driver_name || '-'}</td>
                            <td className="py-3 px-4">
                              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                {vehicle.driver_type || '-'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-gray-600 text-xs">
                              {vehicle.entry_time ? new Date(vehicle.entry_time).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true
                              }) : '-'}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getDurationBgColor(vehicle.duration)}`}>
                                {vehicle.duration || '-'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                                vehicle.status === 'active'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-500'
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
                                  className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all shadow-sm"
                                >
                                  Checkout
                                </button>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
</table>
                  </div>
                  
                  {/* Pagination Controls */}
                  {flaggedTotal > flaggedLimit && (
                    <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100">
                      <button
                        onClick={() => handleModalFlaggedPageChange(Math.max(1, modalFlaggedPage - 1))}
                        disabled={modalFlaggedPage === 1 || modalFlaggedLoading}
                        className="px-3 py-1 text-sm bg-white/50 backdrop-blur rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/80"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-gray-600">
                        Page {modalFlaggedPage} of {Math.ceil(flaggedTotal / flaggedLimit)}
                      </span>
                      <button
                        onClick={() => handleModalFlaggedPageChange(Math.min(Math.ceil(flaggedTotal / flaggedLimit), modalFlaggedPage + 1))}
                        disabled={modalFlaggedPage >= Math.ceil(flaggedTotal / flaggedLimit) || modalFlaggedLoading}
                        className="px-3 py-1 text-sm bg-white/50 backdrop-blur rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/80"
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
      </MainLayout>
    );
  };

export default SmartParkingDashboard;