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
  FiTruck, FiSearch, FiAward, FiShield, FiCheckCircle, FiCheck, FiAlertTriangle, FiUser, FiUserPlus,
  FiPhone, FiPlus, FiFileText, FiX, FiFlag, FiSlash, FiCrosshair, FiClock, FiAlertOctagon, FiSettings, FiAlertCircle, FiEdit,
  FiActivity, FiCalendar, FiMapPin, FiTrendingUp, FiUsers, FiLogOut, FiInfo
} from 'react-icons/fi';
import { BsShieldCheck, BsClockHistory, BsExclamationTriangle } from 'react-icons/bs';
import { MdOutlineLocalParking, MdOutlineWarning } from 'react-icons/md';
import { FaRegIdCard } from 'react-icons/fa';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';

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

interface UnknownVehicleForm {
  plate_number: string;
  driver_name: string;
  driver_telephone: string;
  driver_email?: string;
  driver_gender?: string;
  national_id?: string;
  badge_number?: string;
  driver_type: string;
}

interface LongDurationVehicle {
  plate_no: string;
  entry_time: string;
  check_out?: string | null;
  duration: string;
  duration_hours?: number;
  driver_name?: string;
  driver_type?: string;
  is_flagged?: boolean;
  status?: string;
  _id?: string;
}

const SmartParkingDashboard: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const { socket, isConnected, on, off } = useSocket();
  
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [plateNumber, setPlateNumber] = useState('');
  const [statsLoading, setStatsLoading] = useState(true);
  
  // Modal states
  const [showFoundModal, setShowFoundModal] = useState(false);
  const [showUnknownModal, setShowUnknownModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showAlreadyParkedModal, setShowAlreadyParkedModal] = useState(false);
  const [showLongDurationModal, setShowLongDurationModal] = useState(false);
  const [showFlaggedModal, setShowFlaggedModal] = useState(false);
  const [showCheckoutConfirmModal, setShowCheckoutConfirmModal] = useState(false);
  const [checkoutVehicle, setCheckoutVehicle] = useState<LongDurationVehicle | null>(null);
  const [isEditingDriver, setIsEditingDriver] = useState(false);
  const [driverInfo, setDriverInfo] = useState({
    name: '',
    telephone: '',
    badge_number: ''
  });

  // Data states
  const [verifiedData, setVerifiedData] = useState<VehicleData | null>(null);
  const [unknownForm, setUnknownForm] = useState<UnknownVehicleForm>({
    plate_number: '',
    driver_name: '',
    driver_telephone: '',
    driver_email: '',
    driver_gender: '',
    national_id: '',
    badge_number: '',
    driver_type: '',
  });

  // Stats data from API
  const [stats, setStats] = useState({
    availableSlots: 0,
    totalSlots: 200,
    staffVehicles: 0,
    reservedSlots: 0,
    newVisitors: 0,
    totalInside: 0,
    totalOutside: 0,
    flaggedButInside: 0,
    visitorVehicles: 0,
    visitorReserved: 0,
    staffReserved: 0
  });

  // Long duration vehicles from API
  const [longDurationVehicles, setLongDurationVehicles] = useState<LongDurationVehicle[]>([]);
  const [flaggedVehicles, setFlaggedVehicles] = useState<LongDurationVehicle[]>([]);

  // Date filter for long duration vehicles
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Hourly analytics data
  const [hourlyParkingData, setHourlyParkingData] = useState<{
    hour: number;
    check_in: number;
    check_out: number;
  }[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    setStatsLoading(true);
    try {
      const allRecordsResponse = await smartParkingService.getAll();
      
      if (allRecordsResponse.success && allRecordsResponse.data) {
        const allRecords = allRecordsResponse.data;
        const activeRecords = allRecords.filter((r: any) => r.status === 'active');
        
        const totalInside = activeRecords.length;
        const totalOutside = allRecords.filter((r: any) => r.status === 'completed').length;
        const flaggedButInside = activeRecords.filter((r: any) => r.is_flagged === true).length;
        const reservedVehicles = activeRecords.filter((r: any) => r.is_reserved || r.reserved).length;
        const totalReservedSlots = 50;
        const visitorVehicles = activeRecords.filter((r: any) => r.driver_type === 'Visitor').length;
        const visitorReserved = activeRecords.filter((r: any) => r.driver_type === 'Visitor' && (r.is_reserved || r.reserved)).length;
        const staffReserved = activeRecords.filter((r: any) => (r.driver_type === 'Staff' || r.driver_type === 'Regular') && (r.is_reserved || r.reserved)).length;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const newVisitors = allRecords.filter((r: any) => {
          const checkInDate = new Date(r.check_in || r.entry_date);
          return checkInDate >= today && r.driver_type === 'Visitor';
        }).length;
        
        setStats(prev => ({
          ...prev,
          availableSlots: Math.max(0, prev.totalSlots - totalInside),
          totalSlots: prev.totalSlots,
          staffVehicles: prev.staffVehicles,
          reservedSlots: reservedVehicles,
          newVisitors: newVisitors,
          totalInside,
          totalOutside,
          flaggedButInside,
          visitorVehicles,
          visitorReserved,
          staffReserved
        }));
      }

      const longDurationResponse = await smartParkingService.getLongDurationVehicles(selectedDate);
      if (longDurationResponse.success && longDurationResponse.data) {
        setLongDurationVehicles(longDurationResponse.data);
      }

      const flaggedResponse = await smartParkingService.getFlaggedActiveVehicles();
      if (flaggedResponse.success && flaggedResponse.data) {
        setFlaggedVehicles(flaggedResponse.data);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setStatsLoading(false);
    }
  }, [selectedDate]);

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
      on('smartparking_test', handleParkingUpdate);

      return () => {
        off('parking_checkin', handleParkingUpdate);
        off('parking_checkout', handleParkingUpdate);
        off('parking_update', handleParkingUpdate);
        off('smartparking_test', handleParkingUpdate);
      };
    }
  }, [socket, isConnected, on, off, handleParkingUpdate]);

  // Helper function to get background color based on duration
  const getDurationBgColor = (duration: string) => {
    const hours = parseFloat(duration.replace(/[^0-9.]/g, ''));
    if (hours >= 9) return 'bg-red-500/20 text-red-600 border border-red-200';
    if (hours < 9 ) return 'bg-orange-500/20 text-orange-600 border border-orange-200';
    return 'bg-gray-500/20 text-gray-600 border border-gray-200';
  };

  // Helper function to get color based on value and thresholds
  const getStatusColor = (value: number, threshold: number, type: 'low' | 'high' | 'full') => {
    if (type === 'low') {
      if (value <= threshold * 0.2) return 'text-red-600';
      if (value <= threshold * 0.5) return 'text-orange-500';
      return 'text-emerald-600';
    } else if (type === 'high') {
      if (value >= threshold * 0.8) return 'text-emerald-600';
      if (value >= threshold * 0.5) return 'text-blue-600';
      return 'text-gray-500';
    } else {
      if (value >= threshold) return 'text-red-600';
      if (value >= threshold * 0.8) return 'text-orange-500';
      return 'text-emerald-600';
    }
  };

  const getIconBgColor = (value: number, threshold: number, type: 'low' | 'high' | 'full') => {
    if (type === 'low') {
      if (value <= threshold * 0.2) return 'from-red-500/20 to-red-600/20';
      if (value <= threshold * 0.5) return 'from-orange-500/20 to-amber-500/20';
      return 'from-emerald-500/20 to-teal-500/20';
    } else if (type === 'high') {
      if (value >= threshold * 0.8) return 'from-emerald-500/20 to-teal-500/20';
      if (value >= threshold * 0.5) return 'from-blue-500/20 to-indigo-500/20';
      return 'from-gray-400/20 to-gray-500/20';
    } else {
      if (value >= threshold) return 'from-red-500/20 to-red-600/20';
      if (value >= threshold * 0.8) return 'from-orange-500/20 to-amber-500/20';
      return 'from-emerald-500/20 to-teal-500/20';
    }
  };

  const getIconColor = (value: number, threshold: number, type: 'low' | 'high' | 'full') => {
    if (type === 'low') {
      if (value <= threshold * 0.2) return 'text-red-600';
      if (value <= threshold * 0.5) return 'text-orange-600';
      return 'text-emerald-600';
    } else if (type === 'high') {
      if (value >= threshold * 0.8) return 'text-emerald-600';
      if (value >= threshold * 0.5) return 'text-blue-600';
      return 'text-gray-500';
    } else {
      if (value >= threshold) return 'text-red-600';
      if (value >= threshold * 0.8) return 'text-orange-600';
      return 'text-emerald-600';
    }
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
        setVerifiedData(response.data || {
          plate_number: plateNumber.trim().toUpperCase(),
          vehicle_category: 'Unknown'
        });
        setUnknownForm(prev => ({ ...prev, plate_number: plateNumber.trim().toUpperCase() }));
        setShowUnknownModal(true);
        showInfo('Vehicle not found in system');
      }
    } catch (err: any) {
      console.error('Verify error:', err);
      showError(err?.message || 'Failed to verify vehicle');
      const errorData = err?.response?.data;
      setVerifiedData(errorData?.data || { 
        plate_number: plateNumber.trim().toUpperCase(),
        vehicle_category: 'Unknown' 
      });
      setUnknownForm(prev => ({ ...prev, plate_number: plateNumber.trim().toUpperCase() }));
      setShowUnknownModal(true);
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
      // Get identification from verified data
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
        setShowSuccessModal(true);
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

  const handleRegisterUnknown = async () => {
    if (!unknownForm.plate_number.trim()) {
      showWarning('License plate number is required');
      return;
    }
    
    if (!unknownForm.driver_name.trim()) {
      showWarning('Owner name is required');
      return;
    }
    
    if (!unknownForm.driver_telephone.trim()) {
      showWarning('Phone number is required');
      return;
    }

    if (!unknownForm.badge_number?.trim()) {
      showWarning('Badge number is required');
      return;
    }

    const plateRegex = /^[A-Z0-9\s-]{4,10}$/i;
    if (!plateRegex.test(unknownForm.plate_number.trim())) {
      showWarning('Invalid license plate format (e.g., ABC-1234 or ABC123)');
      return;
    }
    
    const nameRegex = /^[a-zA-Z\s\-\']+$/;
    if (!nameRegex.test(unknownForm.driver_name.trim())) {
      showWarning('Invalid name format (only letters, spaces, hyphens allowed)');
      return;
    }
    
    const phoneRegex = /^[+]?[(]?\d{1,4}[)]?[\d\s\-\(\)]{7,20}$/;
    if (!phoneRegex.test(unknownForm.driver_telephone)) {
      showWarning('Invalid phone number format');
      return;
    }

    const finalPlateNumber = unknownForm.plate_number.trim().toUpperCase();

    setLoading(true);
    try {
      const requestData = {
        plate_number: finalPlateNumber,
        driver_name: unknownForm.driver_name.trim(),
        driver_telephone: unknownForm.driver_telephone.replace(/[^+\d]/g, ""),
        driver_gender: unknownForm.driver_gender || null,
        driver_email: unknownForm.driver_email?.trim() || null,
        driver_identification: unknownForm.national_id ? { number: unknownForm.national_id.trim() } : null,
        badge_number: unknownForm.badge_number?.trim() || null,
        driver_type: unknownForm.driver_type || '-',
      };
      
      const response = await smartParkingService.checkIn(requestData);

      if (response.success) {
        setShowUnknownModal(false);
        setShowSuccessModal(true);
        setPlateNumber('');
        setVerifiedData(null);
        setUnknownForm({ plate_number: '', driver_name: '', driver_telephone: '', driver_email: '', driver_gender: '', national_id: '', badge_number: '', driver_type: '' });
        showSuccess('Vehicle registered successfully');
        fetchDashboardData();
      } else {
        showError(response.message || 'Failed to register vehicle');
      }
    } catch (err: any) {
      showError(err?.message || 'Failed to register vehicle');
    } finally {
      setLoading(false);
    }
  };

  const closeAllModals = () => {
    setShowFoundModal(false);
    setShowUnknownModal(false);
    setShowSuccessModal(false);
    setShowAlreadyParkedModal(false);
    setShowLongDurationModal(false);
    setShowFlaggedModal(false);
    setShowCheckoutConfirmModal(false);
    setCheckoutVehicle(null);
    setIsEditingDriver(false);
    setDriverInfo({ name: '', telephone: '', badge_number: '' });
    setPlateNumber('');
    setVerifiedData(null);
    setUnknownForm({ plate_number: '', driver_name: '', driver_telephone: '', driver_email: '', driver_gender: '', national_id: '', badge_number: '', driver_type: '' });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setUnknownForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleDriverInfoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setDriverInfo(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleDenyEntry = () => {
    if (verifying) {
      setVerifying(false);
      setPlateNumber('');
      showInfo('Verification cancelled');
      return;
    }
    
    if (!verifiedData) {
      showWarning('No vehicle verified to deny');
      return;
    }
    showInfo('Entry denied for ' + verifiedData.plate_number);
    closeAllModals();
  };

  const handleFlagIssue = async () => {
    if (!verifiedData?.plate_number) {
      showWarning('No vehicle verified to flag');
      return;
    }
    
    setLoading(true);
    try {
      const response = await smartParkingService.flagVehicle?.(verifiedData.plate_number, 'Flagged by gate officer');
      if (response?.success) {
        showSuccess('Vehicle flagged successfully: ' + verifiedData.plate_number);
      } else {
        showWarning('Vehicle flagged: ' + verifiedData.plate_number);
      }
      closeAllModals();
    } catch (err: any) {
      showError(err?.message || 'Failed to flag vehicle');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckoutClick = (vehicle: LongDurationVehicle) => {
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
        
        {/* Main Stats Grid - Glassmorphism Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {/* Total Inside */}
          <div className="group backdrop-blur-xl bg-white/80 rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-white/20">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-emerald-700 text-sm font-medium mb-1">Total Inside</p>
                <h3 className="text-3xl font-bold text-emerald-700">{stats.totalInside}</h3>
                <p className="text-gray-600 text-xs mt-2 flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Currently parked
                </p>
              </div>
              <div className="p-3 bg-gradient-to-br from-gray-100 to-gray-200/50 backdrop-blur rounded-xl group-hover:scale-110 transition-transform">
                <FiTruck className="w-6 h-6 text-emerald-700" />
               </div>
                 </div>
                    <div className="mt-3 w-full bg-white/20 h-1.5 rounded-full overflow-hidden"> 
                     <div className="bg-white h-full rounded-full" style={{ width: '70%' }}>
                      </div>
                        </div>
                           </div>

          {/* Available Slots */}
          <div className="group backdrop-blur-xl bg-white/80 rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-white/20">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-blue-700 text-sm font-medium mb-1">Available Slots</p>
                <h3 className="text-3xl font-bold text-blue-700">{stats.availableSlots}</h3>
                <p className="text-gray-600 text-xs mt-2 flex items-center gap-1">
                  <FiMapPin className="w-3 h-3" />
                  Out of {stats.totalSlots} total
                </p>
              </div>
              <div className="p-3 bg-white/20 backdrop-blur rounded-xl group-hover:scale-110 transition-transform">
                <MdOutlineLocalParking className="w-6 h-6 text-blue-700" />
              </div>
            </div>
            <div className="mt-3 w-full bg-white/20 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-white h-full rounded-full" 
                style={{ width: `${((stats.totalSlots - stats.availableSlots) / stats.totalSlots) * 100}%` }}
              ></div>
            </div>
          </div>

          {/* Staff Reserved */}
          <div className="group backdrop-blur-xl bg-white/80 rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-white/20">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-purple-700 text-sm font-medium mb-1">Staff Reserved</p>
                <h3 className="text-3xl font-bold text-purple-700">{stats.staffReserved}</h3>
                <p className="text-gray-700 text-xs mt-2 flex items-center gap-1">
                  <FiUsers className="w-3 h-3" />
                  /100 allocated
                </p>
              </div>
              <div className="p-3 bg-white/20 backdrop-blur rounded-xl group-hover:scale-110 transition-transform">
                <FiShield className="w-6 h-6 text-purple-700" />
              </div>
            </div>
            <div className="mt-3 w-full bg-white/20 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-white h-full rounded-full" 
                style={{ width: `${(stats.staffReserved / 100) * 100}%` }}
              ></div>
            </div>
          </div>

          {/* Visitor Reserved */}
          <div className="group backdrop-blur-xl bg-white/80 rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-white/20">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-amber-700 text-sm font-medium mb-1">Visitor Reserved</p>
                <h3 className="text-3xl font-bold text-amber-700">{stats.visitorReserved}</h3>
                <p className="text-gray-700 text-xs mt-2 flex items-center gap-1">
                  <FiTrendingUp className="w-3 h-3" />
                  /50 allocated
                </p>
              </div>
              <div className="p-3 bg-white/20 backdrop-blur rounded-xl group-hover:scale-110 transition-transform">
                <FiUserPlus className="w-6 h-6 text-amber-700" />
              </div>
            </div>
            <div className="mt-3 w-full bg-white/20 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-white h-full rounded-full" 
                style={{ width: `${(stats.visitorReserved / 50) * 100}%` }}
              ></div>
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

          {analyticsLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
            </div>
          ) : hourlyParkingData.length > 0 ? (
            <div className="overflow-x-auto">
              {/* Recharts Area Chart - Wave Style */}
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={hourlyParkingData}
                    margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="colorCheckIn" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00aaff" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#00aaff" stopOpacity={0.02}/>
                      </linearGradient>
                      <linearGradient id="colorCheckOut" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis 
                      dataKey="hour" 
                      tickFormatter={(value) => `${value.toString().padStart(2, '0')}:00`}
                      stroke="#9ca3af"
                      fontSize={12}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis stroke="#9ca3af" fontSize={12} axisLine={false} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                      formatter={(value, name) => [
                        value, 
                        name === 'check_in' ? 'Check-ins' : 'Check-outs'
                      ]}
                      labelFormatter={(label) => `${label}:00`}
                    />
                    <Legend />
                    <Area 
                      type="basis" 
                      dataKey="check_in" 
                      name="Check-ins" 
                      stroke="#00aaff" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorCheckIn)" 
                      animationDuration={1500}
                      dot={{ r: 4, fill: '#fff', stroke: '#00aaff', strokeWidth: 2 }}
                      activeDot={{ r: 6, fill: '#00aaff', stroke: '#fff', strokeWidth: 2 }}
                    />
                    <Area 
                      type="basis" 
                      dataKey="check_out" 
                      name="Check-outs" 
                      stroke="#ef4444" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorCheckOut)" 
                      animationDuration={1500}
                      dot={{ r: 4, fill: '#fff', stroke: '#ef4444', strokeWidth: 2 }}
                      activeDot={{ r: 6, fill: '#ef4444', stroke: '#fff', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              
              {/* Summary Stats */}
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
            <button 
              onClick={() => setShowFlaggedModal(true)}
              className="text-sm px-3 py-1.5 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 hover:from-blue-500/20 hover:to-indigo-500/20 rounded-full text-blue-600 font-medium transition-all"
            >
              View All ({flaggedVehicles.length})
            </button>
          </div>

          {flaggedVehicles.length === 0 ? (
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
                    <th className="text-left py-3 px-4 text-red-700 font-semibold text-xs uppercase tracking-wide">Status</th>
                    <th className="text-right py-3 px-4 text-red-700 font-semibold text-xs uppercase tracking-wide">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-100">
                  {flaggedVehicles.slice(0, 1).map((vehicle, index) => (
                    <tr key={index} className="hover:bg-red-50 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-red-600 text-sm">{vehicle.plate_no}</td>
                      <td className="py-3 px-4 text-gray-700 text-sm">{vehicle.driver_name || '-'}</td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                          {vehicle.driver_type || '-'}
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
                            onClick={() => handleCheckoutClick(vehicle)}
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

      {/* Found Vehicle Modal - Glassmorphism Design */}
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
                    <FiAlertCircle className="w-6 h-6 text-orange-600" />
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
              {/* Profile Section */}
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

              {/* Driver Info */}
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

              {/* Vehicle Details */}
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

              {/* Action Buttons */}
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

      {/* Not Found Vehicle Modal - Glassmorphism */}
      {showUnknownModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-lg mx-2 sm:mx-auto overflow-hidden border border-white/50 animate-scaleIn">
            <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 px-4 sm:px-6 py-4 border-b border-red-200">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-500/20 rounded-xl">
                  <MdOutlineWarning className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Vehicle Not Found</h3>
                  <p className="text-sm text-gray-600">Register new vehicle for one-time access</p>
                </div>
              </div>
            </div>
            
            <div className="p-4 sm:p-6">
              <div className="space-y-4">
                {/* Plate Number */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Plate Number *</label>
                  <input
                    type="text"
                    name="plate_number"
                    value={unknownForm.plate_number}
                    onChange={handleInputChange}
                    placeholder="Enter plate number"
                    className="w-full px-3 py-2 bg-white/50 backdrop-blur border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* National ID */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">National ID / Passport</label>
                  <input
                    type="text"
                    name="national_id"
                    value={unknownForm.national_id || ''}
                    onChange={handleInputChange}
                    placeholder="Enter ID number"
                    className="w-full px-3 py-2 bg-white/50 backdrop-blur border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Full Names */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Full Names *</label>
                  <input
                    type="text"
                    name="driver_name"
                    value={unknownForm.driver_name}
                    onChange={handleInputChange}
                    placeholder="Enter full names"
                    className="w-full px-3 py-2 bg-white/50 backdrop-blur border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Phone Number */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    name="driver_telephone"
                    value={unknownForm.driver_telephone}
                    onChange={handleInputChange}
                    placeholder="Enter phone number"
                    className="w-full px-3 py-2 bg-white/50 backdrop-blur border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Email (Optional)</label>
                  <input
                    type="email"
                    name="driver_email"
                    value={unknownForm.driver_email || ''}
                    onChange={handleInputChange}
                    placeholder="Enter email address"
                    className="w-full px-3 py-2 bg-white/50 backdrop-blur border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Badge Number */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Badge Number *</label>
                  <input
                    type="text"
                    name="badge_number"
                    value={unknownForm.badge_number || ''}
                    onChange={handleInputChange}
                    placeholder="Enter badge number"
                    className="w-full px-3 py-2 bg-white/50 backdrop-blur border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Gender Selection */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Gender</label>
                  <div className="flex gap-2">
                    {['Male', 'Female', 'Other'].map((gender) => (
                      <button
                        key={gender}
                        type="button"
                        onClick={() => handleInputChange({ target: { name: 'driver_gender', value: gender } } as any)}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                          unknownForm.driver_gender === gender
                            ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md'
                            : 'bg-white/50 backdrop-blur border border-gray-200 text-gray-700 hover:bg-white/80'
                        }`}
                      >
                        {gender}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Driver Type */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Driver Type *</label>
                  <div className="flex gap-2">
                    {['Regular', 'Staff', 'Visitor'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => handleInputChange({ target: { name: 'driver_type', value: type } } as any)}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                          unknownForm.driver_type === type
                            ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md'
                            : 'bg-white/50 backdrop-blur border border-gray-200 text-gray-700 hover:bg-white/80'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="px-4 sm:px-6 pb-4 sm:pb-6 flex gap-2">
              <button
                onClick={handleRegisterUnknown}
                disabled={loading}
                className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>Registering...</span>
                  </>
                ) : (
                  <>
                    <FiUserPlus className="w-4 h-4" />
                    <span>Register Vehicle</span>
                  </>
                )}
              </button>
              <button
                onClick={closeAllModals}
                className="px-4 py-3 bg-white/50 backdrop-blur hover:bg-white/80 border border-gray-200 text-gray-700 rounded-xl font-medium transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center border border-white/50 animate-scaleIn">
            <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-r from-emerald-500/20 to-green-500/20 rounded-full flex items-center justify-center">
              <FiCheckCircle className="w-10 h-10 text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Success!</h3>
            <p className="text-gray-600 mb-6">Vehicle has been checked in successfully</p>
            <button
              onClick={closeAllModals}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Checkout Confirmation Modal */}
      {showCheckoutConfirmModal && checkoutVehicle && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-white/50 animate-scaleIn">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-red-500/20 to-orange-500/20 rounded-full flex items-center justify-center">
                <FiAlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Confirm Checkout</h3>
              <p className="text-gray-600">Are you sure you want to check out this vehicle?</p>
            </div>
            
            <div className="bg-gradient-to-r from-red-500/5 to-orange-500/5 backdrop-blur-sm rounded-xl p-4 mb-6 border border-red-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center">
                  <FiTruck className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="font-mono font-bold text-gray-900">{checkoutVehicle.plate_no}</div>
                  <div className="text-sm text-gray-600">{checkoutVehicle.driver_name}</div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={closeAllModals}
                className="flex-1 py-3 bg-white/50 backdrop-blur hover:bg-white/80 border border-gray-200 text-gray-700 rounded-xl font-medium transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCheckout}
                disabled={loading}
                className="flex-1 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>Processing...</span>
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

      {/* Long Duration Vehicles Modal */}
      {showLongDurationModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-4xl mx-2 sm:mx-auto overflow-hidden border border-white/50 animate-scaleIn">
            <div className="bg-gradient-to-r from-orange-500/20 to-amber-500/20 px-4 sm:px-6 py-4 border-b border-orange-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-orange-500/20 rounded-xl">
                  <BsClockHistory className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Long Duration Vehicles</h3>
                  <p className="text-sm text-gray-600">{longDurationVehicles.length} vehicles total</p>
                </div>
              </div>
              <button
                onClick={() => setShowLongDurationModal(false)}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
              >
                <FiX className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            
            <div className="p-4 sm:p-6">
              <div className="mb-4 flex items-center gap-2">
                <label className="text-sm text-gray-600">Filter by Date:</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="text-sm px-3 py-1.5 bg-white/50 backdrop-blur border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gradient-to-r from-gray-500/5 to-gray-500/10">
                    <tr>
                      <th className="text-left py-3 px-2 text-gray-600 font-medium">Plate No.</th>
                      <th className="text-left py-3 px-2 text-gray-600 font-medium">Driver</th>
                      <th className="text-left py-3 px-2 text-gray-600 font-medium">Entry Time</th>
                      <th className="text-left py-3 px-2 text-gray-600 font-medium">Duration</th>
                      <th className="text-left py-3 px-2 text-gray-600 font-medium">Status</th>
                      <th className="text-right py-3 px-2 text-gray-600 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {longDurationVehicles.map((vehicle, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                        <td className="py-3 px-2 font-mono font-medium text-gray-800">{vehicle.plate_no}</td>
                        <td className="py-3 px-2 text-gray-600">{vehicle.driver_name || '-'}</td>
                        <td className="py-3 px-2 text-gray-600">
                          {new Date(vehicle.entry_time).toLocaleString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            hour: '2-digit', 
                            minute: '2-digit',
                            hour12: true 
                          })}
                        </td>
                        <td className="py-3 px-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDurationBgColor(vehicle.duration)}`}>
                            {vehicle.duration}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            vehicle.status === 'active' 
                              ? 'bg-green-100 text-green-600' 
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {vehicle.status === 'active' ? 'Inside' : 'Out'}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right">
                          {vehicle.status === 'active' ? (
                            <button
                              onClick={() => {
                                setShowLongDurationModal(false);
                                handleCheckoutClick(vehicle);
                              }}
                              className="px-3 py-1.5 text-xs bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:shadow-md transition-all"
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
            </div>
          </div>
        </div>
      )}

      {/* Flagged Vehicles Modal */}
      {showFlaggedModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-4xl mx-2 sm:mx-auto overflow-hidden border border-white/50 animate-scaleIn">
            <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 px-4 sm:px-6 py-4 border-b border-red-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-500/20 rounded-xl">
                  <BsExclamationTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Flagged Vehicles</h3>
                  <p className="text-sm text-gray-600">{flaggedVehicles.length} vehicles total</p>
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
              {flaggedVehicles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <BsShieldCheck className="w-16 h-16 mb-3 opacity-50" />
                  <p className="text-sm">No flagged vehicles in system</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gradient-to-r from-gray-500/5 to-gray-500/10">
                      <tr>
                        <th className="text-left py-3 px-2 text-gray-600 font-medium">Plate No.</th>
                        <th className="text-left py-3 px-2 text-gray-600 font-medium">Driver</th>
                        <th className="text-left py-3 px-2 text-gray-600 font-medium">Type</th>
                        <th className="text-left py-3 px-2 text-gray-600 font-medium">Status</th>
                        <th className="text-right py-3 px-2 text-gray-600 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {flaggedVehicles.map((vehicle, index) => (
                        <tr key={index} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 px-2 font-mono font-bold text-red-600">{vehicle.plate_no}</td>
                          <td className="py-3 px-2 text-gray-600">{vehicle.driver_name || '-'}</td>
                          <td className="py-3 px-2">
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                              {vehicle.driver_type || '-'}
                            </span>
                          </td>
                          <td className="py-3 px-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              vehicle.status === 'active' 
                                ? 'bg-green-100 text-green-600' 
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {vehicle.status === 'active' ? 'Inside' : 'Out'}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-right">
                            {vehicle.status === 'active' ? (
                              <button
                                onClick={() => {
                                  setShowFlaggedModal(false);
                                  handleCheckoutClick(vehicle);
                                }}
                                className="px-3 py-1.5 text-xs bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:shadow-md transition-all"
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
        </div>
      )}

      {/* Global Styles for Animations */}
      <style>{`
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        .animate-scaleIn {
          animation: scaleIn 0.2s ease-out;
        }
      `}</style>
    </MainLayout>
  );
};

export default SmartParkingDashboard;
