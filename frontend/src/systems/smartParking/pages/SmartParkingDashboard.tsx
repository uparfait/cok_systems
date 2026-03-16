// SmartParkingDashboard - Smart Parking System Dashboard
// Gate Officer Dashboard for manual vehicle verification and entry

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useToast } from '../../../core/contexts/ToastContext';
import { useSocket } from '../../../core/contexts/SocketContext';
import { smartParkingService } from '../../../core/services/adminService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import { 
  FiTruck, FiSearch, FiAward, FiShield, FiCheckCircle, FiCheck, FiAlertTriangle, FiUser, FiUserPlus,
  FiPhone, FiPlus, FiFileText, FiX, FiFlag, FiSlash, FiCrosshair, FiClock, FiAlertOctagon, FiSettings, FiAlertCircle, FiEdit
} from 'react-icons/fi';
import { BsShieldCheck } from 'react-icons/bs';

interface VehicleData {
  plate_number?: string;
  vehicle_category?: string;
  is_currently_parked?: boolean;
  is_reserved?: boolean;
  is_flagged?: boolean;
  was_ever_flagged?: boolean;
  badge_number?: string;
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
    newVisitors: 0
  });

  // Long duration vehicles from API
  const [longDurationVehicles, setLongDurationVehicles] = useState<LongDurationVehicle[]>([]);
  const [flaggedVehicles, setFlaggedVehicles] = useState<LongDurationVehicle[]>([]);

  // Date filter for long duration vehicles
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0] // Default to today
  );

  // Calculate progress percentage for available slots
  const availablePercentage = stats.totalSlots > 0 
    ? ((stats.totalSlots - stats.availableSlots) / stats.totalSlots) * 100 
    : 0;

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    setStatsLoading(true);
    try {
      // Fetch stats
      const statsResponse = await smartParkingService.getStats();
      if (statsResponse.success && statsResponse.data) {
        setStats({
          availableSlots: statsResponse.data.availableSlots,
          totalSlots: statsResponse.data.totalSlots,
          staffVehicles: statsResponse.data.staffVehicles,
          reservedSlots: statsResponse.data.reservedSlots || 0,
          newVisitors: statsResponse.data.newVisitors || statsResponse.data.visitorsToday || 0
        });
      }

      // Fetch long duration vehicles
      const longDurationResponse = await smartParkingService.getLongDurationVehicles(selectedDate);
      if (longDurationResponse.success && longDurationResponse.data) {
        setLongDurationVehicles(longDurationResponse.data);
      }

      // Fetch flagged active vehicles
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
    
    // Fetch initial data
    fetchDashboardData();
  }, [isAuthenticated, authLoading, navigate, fetchDashboardData]);

  // Socket event listeners
  useEffect(() => {
    if (socket && isConnected) {
      // Listen for parking events
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
    if (hours >= 9) return 'bg-red-100 text-red-600';
    if (hours < 9 ) return 'bg-orange-100 text-orange-600';
    return 'bg-slate-100 text-slate-600';
  };

  const handleVerify = async () => {
    console.log('handleVerify called, plateNumber:', plateNumber);
    if (!plateNumber.trim()) {
      showWarning('Please enter license plate number');
      return;
    }

    setVerifying(true);
    // Reset verified data before new verification
    setVerifiedData(null);

    try {
      console.log('Calling verifyCar API with:', plateNumber.trim());
      const response = await smartParkingService.verifyCar(plateNumber.trim());
      console.log('Verify response:', response);

      if (response.success && response.data) {
        const data = response.data;
        console.log('Vehicle found - is_flagged:', data.is_flagged, 'was_ever_flagged:', data.was_ever_flagged, 'is_currently_parked:', data.is_currently_parked);
        setVerifiedData(data);
        
        // Initialize driver info from verified data
        setDriverInfo({
          name: data.driver_details?.name || data.driver_name || '',
          telephone: data.driver_details?.telephone || data.driver_telephone || '',
          badge_number: (data as any).badge_number || ''
        });
        
        // Vehicle is found in system - show Found Vehicle Modal
        setShowFoundModal(true);
      } else {
        // Vehicle not found in system - use backend response directly
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
      // Use backend error response directly if available
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
    
    // Prevent check-in if vehicle is already parked
    if (verifiedData.is_currently_parked) {
      showWarning('This vehicle is already checked in');
      return;
    }

    // Badge number is required for every check-in
    if (!driverInfo.badge_number?.trim()) {
      showWarning('Badge number is required');
      return;
    }
    
    setLoading(true);
    try {
      const response = await smartParkingService.checkIn({
        plate_number: verifiedData.plate_number,
        driver_name: driverInfo.name || verifiedData.driver_details?.name || verifiedData.driver_name || '',
        driver_telephone: driverInfo.telephone || verifiedData.driver_details?.telephone || verifiedData.driver_telephone || '',
        driver_type: verifiedData.vehicle_category || '',
        badge_number: driverInfo.badge_number?.trim() || null,
      });

      if (response.success) {
        setShowFoundModal(false);
        setShowSuccessModal(true);
        setPlateNumber('');
        setVerifiedData(null);
        showSuccess('Vehicle checked in successfully');
        // Refresh dashboard data
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
    // Validate required fields
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

    // Badge number is required
    if (!unknownForm.badge_number?.trim()) {
      showWarning('Badge number is required');
      return;
    }

    // Validate plate number format
    const plateRegex = /^[A-Z0-9\s-]{4,10}$/i;
    if (!plateRegex.test(unknownForm.plate_number.trim())) {
      showWarning('Invalid license plate format (e.g., ABC-1234 or ABC123)');
      return;
    }
    
    // Validate name format
    const nameRegex = /^[a-zA-Z\s\-\']+$/;
    if (!nameRegex.test(unknownForm.driver_name.trim())) {
      showWarning('Invalid name format (only letters, spaces, hyphens allowed)');
      return;
    }
    
    // Validate phone format - more flexible for international numbers
    const phoneRegex = /^[+]?[(]?\d{1,4}[)]?[\d\s\-\(\)]{7,20}$/;
    const cleanPhone = unknownForm.driver_telephone.replace(/[\s\-\(\)]/g, '');
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
      console.log('Sending check-in request:', requestData);
      
      const response = await smartParkingService.checkIn(requestData);

      if (response.success) {
        setShowUnknownModal(false);
        setShowSuccessModal(true);
        setPlateNumber('');
        setVerifiedData(null);
        setUnknownForm({ plate_number: '', driver_name: '', driver_telephone: '', driver_email: '', driver_gender: '', national_id: '', badge_number: '', driver_type: '' });
        showSuccess('Vehicle registered successfully');
        // Refresh dashboard data
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

  // Handle driver info change in Found modal
  const handleDriverInfoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setDriverInfo(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle deny entry / cancel verification
  const handleDenyEntry = () => {
    // If verification is in progress, cancel it
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

  // Handle flag issue
  const handleFlagIssue = async () => {
    if (!verifiedData?.plate_number) {
      showWarning('No vehicle verified to flag');
      return;
    }
    
    setLoading(true);
    try {
      // Try to call the flag API if available
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

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <MainLayout>
      <div className="p-1 sm:p-2 md:p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 gap-3">
              {/* Available Slots */}
              <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 relative overflow-hidden">
                <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Available Slots</div>
                <div className="absolute top-1 right-1 text-6xl font-bold text-orange-500 opacity-15 select-none z-0">P</div>
                <div className="relative z-10">
                  <span className="text-2xl font-bold text-red-500">{stats.availableSlots}</span>
                  <span className="text-xs text-gray-300">/{stats.totalSlots}</span>
                </div>
                <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500 rounded-full transition-all duration-500" style={{ width: `${availablePercentage}%` }} />
                </div>
              </div>

              {/* Reserved Slots */}
              <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 relative overflow-hidden">
                <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Reserved Slots</div>
                <div className="absolute top-1 right-1 text-3xl text-green-500 opacity-20 select-none z-0">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-14 h-14">
                    <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
                  </svg>
                </div>
                <div className="relative z-10">
                  <span className="text-2xl font-bold text-gray-800">{stats.reservedSlots}</span>
                </div>
              </div>

              {/* Staff Vehicles */}
              <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 relative overflow-hidden">
                <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Staff Vehicles</div>
                <div className="absolute top-2 right-2 text-base text-gray-300 select-none z-0">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
        d="M16 4C16.93 4 17.395 4 17.7765 4.10222C18.8117 4.37962 19.6204 5.18827 19.8978 6.22354C20 6.60504 20 7.07003 20 8V17.2C20 18.8802 20 19.7202 19.673 20.362C19.3854 20.9265 18.9265 21.3854 18.362 21.673C17.7202 22 16.8802 22 15.2 22H8.8C7.11984 22 6.27976 22 5.63803 21.673C5.07354 21.3854 4.6146 20.9265 4.32698 20.362C4 19.7202 4 18.8802 4 17.2V8C4 7.07003 4 6.60504 4.10222 6.22354C4.37962 5.18827 5.18827 4.37962 6.22354 4.10222C6.60504 4 7.07003 4 8 4M9 15L11 17L15.5 12.5M9.6 6H14.4C14.9601 6 15.2401 6 15.454 5.89101C15.6422 5.79513 15.7951 5.64215 15.891 5.45399C16 5.24008 16 4.96005 16 4.4V3.6C16 3.03995 16 2.75992 15.891 2.54601C15.7951 2.35785 15.6422 2.20487 15.454 2.10899C15.2401 2 14.9601 2 14.4 2H9.6C9.03995 2 8.75992 2 8.54601 2.10899C8.35785 2.20487 8.20487 2.35785 8.10899 2.54601C8 2.75992 8 3.03995 8 3.6V4.4C8 4.96005 8 5.24008 8.10899 5.45399C8.20487 5.64215 8.35785 5.79513 8.54601 5.89101C8.75992 6 9.03995 6 9.6 6Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    />
</svg>

                </div>
                <div className="relative z-10">
                  <span className="text-2xl font-bold text-gray-800">{stats.staffVehicles}</span>
                  <span className="text-[10px] text-gray-400 ml-1">active</span>
                </div>
              </div>

              {/* New Visitor */}
              <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 relative overflow-hidden">
                <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">New Visitor</div>
                <div className="absolute top-2 right-2 text-base text-gray-300 select-none z-0">
                  <FiUserPlus />
                </div>
                <div className="relative z-10">
                  <span className="text-2xl font-bold text-gray-800">{stats.newVisitors}</span>
                  <span className="text-[10px] text-sky-400 ml-1">Today</span>
                </div>
              </div>
            </div>

            {/* Long Duration Vehicles */}
            <div className="bg-white h-auto min-h-[200px] sm:h-60 rounded-lg p-3 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-700 flex items-center gap-1" style={{ color: '#0F172A', fontFamily: 'Public Sans, sans-serif', fontWeight: 700, fontSize: '18px' }}>
                  <svg className="w-3.5 h-3.5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Long Duration Vehicles {'(>8h)'}
                </h3>
                <button 
                  onClick={() => setShowLongDurationModal(true)}
                  className="text-xs text-blue-500 hover:text-blue-700 font-medium" 
                  style={{ fontFamily: 'Public Sans, sans-serif' }}
                >
                  View All
                </button>
              </div>
              
              {/* Date Filter */}
              <div className="mb-2 flex items-center gap-2">
                <label className="text-xs text-gray-500">Date:</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={() => fetchDashboardData()}
                  className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                >
                  Filter
                </button>
              </div>
              
              <table className="w-full text-[10px]">
                <thead className="text-left text-gray-500" style={{ backgroundColor: 'rgba(100, 116, 139, 0.07)', fontFamily: 'Cambria, sans-serif' }}>
                  <tr>
                    <th className="p-1.5 font-semibold">PLATE NO.</th>
                    <th className="p-1.5 font-semibold">ENTRY</th>
                    <th className="p-1.5 font-semibold">DURATION</th>
                    <th className="p-1.5 font-semibold text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {longDurationVehicles.slice(0, 4).map((vehicle, index) => (
                    <tr key={index} className="border-t border-gray-100">
                      <td className="py-1.5 font-bold text-slate-800">{vehicle.plate_no}</td>
                      <td className="text-slate-500">
                        {new Date(vehicle.entry_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </td>
                      <td className="py-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getDurationBgColor(vehicle.duration)}`}>
                          {vehicle.duration}
                        </span>
                      </td>
                      <td className="text-right">
                        {vehicle.status === 'active' ? (
                          <button 
                            onClick={async () => {
                              if (!vehicle.plate_no) return;
                              setLoading(true);
                              try {
                                const response = await smartParkingService.checkOutByPlate(vehicle.plate_no);
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
                              }
                            }}
                            className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded hover:bg-red-200"
                          >
                            Checkout
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">Checked Out</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {longDurationVehicles.length > 5 && (
                <div className="text-center mt-2">
                  <button 
                    onClick={() => setShowLongDurationModal(true)}
                    className="text-xs text-blue-500 hover:text-blue-700"
                  >
                    +{longDurationVehicles.length - 5} more
                  </button>
                </div>
              )}
            </div>

            {/* Flagged Vehicles */}
            <div className="bg-white h-auto min-h-[200px] sm:h-60 rounded-lg p-3 shadow-sm border border-red-100">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-700 flex items-center gap-1" style={{ color: '#DC2626', fontFamily: 'Public Sans, sans-serif', fontWeight: 700, fontSize: '18px' }}>
                  <FiAlertTriangle className="w-4 h-4 text-red-500" />
                  Flagged Vehicles
                </h3>
                <button 
                  onClick={() => setShowFlaggedModal(true)}
                  className="text-xs text-blue-500 hover:text-blue-700 font-medium" 
                  style={{ fontFamily: 'Public Sans, sans-serif' }}
                >
                  View All
                </button>
              </div>
              {flaggedVehicles.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
                  No flagged vehicles in system
                </div>
              ) : (
                <>
                  <table className="w-full text-[10px]">
                    <thead className="text-left text-gray-500" style={{ backgroundColor: 'rgba(239, 68, 68, 0.07)', fontFamily: 'Cambria, sans-serif' }}>
                      <tr>
                        <th className="p-1.5 font-semibold">PLATE NO.</th>
                        <th className="p-1.5 font-semibold">DRIVER</th>
                        <th className="p-1.5 font-semibold">STATUS</th>
                        <th className="p-1.5 font-semibold text-right">ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {flaggedVehicles.slice(0, 5).map((vehicle, index) => (
                        <tr key={index} className="border-t border-red-100">
                          <td className="py-1.5 font-bold text-red-600">{vehicle.plate_no}</td>
                          <td className="text-slate-500">{vehicle.driver_name}</td>
                          <td className="py-1.5">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${vehicle.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
                              {vehicle.status === 'active' ? 'Inside' : 'Out'}
                            </span>
                          </td>
                          <td className="text-right">
                            {vehicle.status === 'active' ? (
                              <button 
                                onClick={async () => {
                                  if (!vehicle.plate_no) return;
                                  setLoading(true);
                                  try {
                                    const response = await smartParkingService.checkOutByPlate(vehicle.plate_no);
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
                                  }
                                }}
                                className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded hover:bg-red-200"
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
                  {flaggedVehicles.length > 5 && (
                    <div className="text-center mt-2">
                      <button 
                        onClick={() => setShowFlaggedModal(true)}
                        className="text-xs text-blue-500 hover:text-blue-700"
                      >
                        +{flaggedVehicles.length - 5} more
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Manual Verification Panel */}
          <div className="lg:col-span-2">
            <div className="bg-white h-full min-h-[250px] sm:min-h-[280px] rounded-[20px] p-3 sm:p-4 shadow-sm border border-gray-100 flex flex-col">
              <div className="rounded-t-[17px] -mx-3 -mt-3 px-3 pt-3 pb-2 mb-3" style={{ backgroundColor: '#F1F5F9' }}>
                <h2 className="text-base font-extrabold mb-1" style={{ color: '#0F172A', fontFamily: 'Public Sans, sans-serif', fontWeight: 700, fontSize: '17px' }}>Manual Verification</h2>
                <p className="text-xs text-gray-500">Enter plate number manually</p>
              </div>
              
              <div className="mb-2 mt-3">
                <label className="block font-bold text-[10px] text-gray-500 text-bold mb-1 uppercase tracking-wide">License Plate Number</label>
                <input
                  type="text"
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                  placeholder=".........................."
                  className="w-full p-2 border border-gray-100 rounded-lg text-sm font-bold uppercase tracking-wider focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {verifiedData ? (
                <div className="bg-gray-50 rounded-lg p-2 mb-2">
                  <div className="font-semibold text-gray-800 text-sm">{verifiedData.driver_details?.name || verifiedData.driver_name || 'Unknown'}</div>
                  <div className="text-[10px] text-gray-400">{verifiedData.driver_type || 'N/A'}. {verifiedData.driver_details?.type || 'N/A'}</div>
                  <div className="text-green-500 font-medium text-[10px]">ALLOWED</div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-2 mb-2">
                  <div className="text-[10px] text-gray-400 text-center">Enter plate number to verify</div>
                </div>
              )}

              <button
                type="button"
                onClick={handleVerify}
                disabled={verifying || !plateNumber.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1 transition-colors shadow-sm"
              >
                {verifying ? (
                  <span className="flex items-center gap-2">
                    <FiSearch className="w-4 h-4 animate-spin" />
                    <span>Verifying plate...</span>
                  </span>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5">
                      <BsShieldCheck className="w-5 h-5" />
                      <span>Verify & Open</span>
                    </div>
                    <span className="text-[9px] font-normal text-blue-100">Click to simulate</span>
                  </>
                )}
              </button>

              {/* Cancel button during verification */}
              {verifying && (
                <button
                  type="button"
                  onClick={handleDenyEntry}
                  className="w-full mt-2 border border-red-300 text-red-600 hover:bg-red-50 py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <FiX className="w-4 h-4" />
                  Cancel Verification
                </button>
              )}

              <div className="flex gap-2 mt-8">
                <button 
                  type="button"
                  onClick={handleDenyEntry}
                  className="flex-1 border border-gray-300 text-black hover:bg-gray-200 hover:text-black py-2 px-3 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                >
                  <FiSlash className="w-3.5 h-3.5" />
                  Deny Entry
                </button>
                <button 
                  type="button"
                  onClick={handleFlagIssue}
                  disabled={loading || !verifiedData}
                  className="flex-1 border border-gray-300 text-black hover:bg-red-500 hover:text-white py-2 px-3 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <FiFlag className="w-3.5 h-3.5" />
                  Flag Issue
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Found Vehicle Modal */}
      {showFoundModal && verifiedData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full sm:max-w-sm md:max-w-md mx-2 sm:mx-auto overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className={`px-3 sm:px-6 py-4 flex items-center justify-between ${verifiedData.is_flagged && verifiedData.is_currently_parked ? 'bg-red-100' : (verifiedData.was_ever_flagged && !verifiedData.is_currently_parked) ? 'bg-orange-100' : verifiedData.is_currently_parked ? 'bg-orange-100' : 'bg-green-100'}`}>
              <div className="flex items-center gap-3">
                <div className={`flex items-center justify-center w-12 h-12 rounded-full ${verifiedData.is_flagged && verifiedData.is_currently_parked ? 'bg-red-200' : (verifiedData.was_ever_flagged && !verifiedData.is_currently_parked) ? 'bg-orange-200' : verifiedData.is_currently_parked ? 'bg-orange-200' : 'bg-green-200'}`}>
                  {verifiedData.is_flagged && verifiedData.is_currently_parked ? (
                    <FiAlertTriangle className="w-6 h-6 text-red-600" />
                  ) : (verifiedData.was_ever_flagged && !verifiedData.is_currently_parked) ? (
                    <FiAlertTriangle className="w-6 h-6 text-orange-600" />
                  ) : verifiedData.is_currently_parked ? (
                    <FiAlertCircle className="w-6 h-6 text-orange-600" />
                  ) : (
                    <svg width={28} height={28} color={'green'} viewBox="0 0 24 24" fill="none">
                    <path
                      d="M9 12L11 14L15.5 9.5M17.9012 4.99851C18.1071 5.49653 18.5024 5.8924 19.0001 6.09907L20.7452 6.82198C21.2433 7.02828 21.639 7.42399 21.8453 7.92206C22.0516 8.42012 22.0516 8.97974 21.8453 9.47781L21.1229 11.2218C20.9165 11.7201 20.9162 12.2803 21.1236 12.7783L21.8447 14.5218C21.9469 14.7685 21.9996 15.0329 21.9996 15.2999C21.9997 15.567 21.9471 15.8314 21.8449 16.0781C21.7427 16.3249 21.5929 16.549 21.4041 16.7378C21.2152 16.9266 20.991 17.0764 20.7443 17.1785L19.0004 17.9009C18.5023 18.1068 18.1065 18.5021 17.8998 18.9998L17.1769 20.745C16.9706 21.2431 16.575 21.6388 16.0769 21.8451C15.5789 22.0514 15.0193 22.0514 14.5212 21.8451L12.7773 21.1227C12.2792 20.9169 11.7198 20.9173 11.2221 21.1239L9.47689 21.8458C8.97912 22.0516 8.42001 22.0514 7.92237 21.8453C7.42473 21.6391 7.02925 21.2439 6.82281 20.7464L6.09972 19.0006C5.8938 18.5026 5.49854 18.1067 5.00085 17.9L3.25566 17.1771C2.75783 16.9709 2.36226 16.5754 2.15588 16.0777C1.94951 15.5799 1.94923 15.0205 2.1551 14.5225L2.87746 12.7786C3.08325 12.2805 3.08283 11.7211 2.8763 11.2233L2.15497 9.47678C2.0527 9.2301 2.00004 8.96568 2 8.69863C1.99996 8.43159 2.05253 8.16715 2.15472 7.92043C2.25691 7.67372 2.40671 7.44955 2.59557 7.26075C2.78442 7.07195 3.00862 6.92222 3.25537 6.8201L4.9993 6.09772C5.49687 5.89197 5.89248 5.4972 6.0993 5.00006L6.82218 3.25481C7.02848 2.75674 7.42418 2.36103 7.92222 2.15473C8.42027 1.94842 8.97987 1.94842 9.47792 2.15473L11.2218 2.87712C11.7199 3.08291 12.2793 3.08249 12.7771 2.87595L14.523 2.15585C15.021 1.94966 15.5804 1.9497 16.0784 2.15597C16.5763 2.36223 16.972 2.75783 17.1783 3.25576L17.9014 5.00153L17.9012 4.99851Z"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    Vehicle Verification
                  </h3>
                  <p className={`text-sm ${verifiedData.is_flagged && verifiedData.is_currently_parked ? 'text-red-700' : (verifiedData.was_ever_flagged && !verifiedData.is_currently_parked) ? 'text-orange-700' : verifiedData.is_currently_parked ? 'text-orange-700' : 'text-green-700'}`}>
                    {verifiedData.is_flagged && verifiedData.is_currently_parked ? 'Vehicle is flagged' : (verifiedData.was_ever_flagged && !verifiedData.is_currently_parked) ? 'Vehicle was flagged in the past' : verifiedData.is_currently_parked ? 'Already inside parking' : 'Auto-scan successful'}
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-400">{new Date().toLocaleTimeString()}</p>
            </div>
            
            <div className="p-3 sm:p-6">
              {/* Centered Profile Section */}
              <div className="flex flex-col items-center mb-4">
                {/* Circular Avatar with Initials */}
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gray-200 flex items-center justify-center mt-3 shadow-lg">
                  <span className="text-4xl sm:text-5xl font-bold text-blue-600">
                    {(verifiedData.driver_details?.name || verifiedData.driver_name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </span>
                </div>
                
                
                {/* Department Badge (if available) */}
                {(verifiedData.staff_details?.department_name) && (
                  <div className="mt-2 px-3 py-1 bg-green-100 rounded-full">
                    <span className="text-xs font-medium text-gray-600">
                      {verifiedData.staff_details?.department_name}
                    </span>
                  </div>
                )}
              </div>

              {/* Driver Info Section - View/Edit Mode */}
              <div className="mb-4 bg-gray-50 p-3 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-700">Driver Information</h4>
                  {!verifiedData.is_currently_parked && (
                    <button
                      type="button"
                      onClick={() => setIsEditingDriver(!isEditingDriver)}
                      className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-800"
                    >
                      <FiEdit className="w-3 h-3" />
                      {isEditingDriver ? 'Cancel' : 'Edit'}
                    </button>
                  )}
                </div>

                {isEditingDriver ? (
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-gray-500">Name</label>
                      <input
                        type="text"
                        name="name"
                        value={driverInfo.name}
                        onChange={handleDriverInfoChange}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter driver name"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Phone</label>
                      <input
                        type="tel"
                        name="telephone"
                        value={driverInfo.telephone}
                        onChange={handleDriverInfoChange}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter phone number"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Badge Number <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        name="badge_number"
                        value={driverInfo.badge_number}
                        onChange={handleDriverInfoChange}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter badge number"
                        required
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <FiUser className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-700">
                        {driverInfo.name || 'Not specified'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FiPhone className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-700">
                        {driverInfo.telephone || 'Not specified'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FiAward className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-700 font-medium">
                        Badge: {driverInfo.badge_number || 'Not specified'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Top Section: Vehicle Type and Plate Number */}
              <div className="flex justify-between items-start mb-4 bg-gray-100 p-3 rounded-xl">
                {/* Left: Vehicle Type */}
                <div className="flex-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Vehicle</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {verifiedData.vehicle_category || 'Staff Vehicle'}
                  </p>
                </div>
                
                {/* Center: Flagged Indicator - Currently Flagged & Inside (Red) */}
                {verifiedData.is_flagged && verifiedData.is_currently_parked && (
                  <div className="flex items-center px-3 py-1 bg-red-100 rounded-full">
                    <FiAlertTriangle className="w-4 h-4 text-red-600 mr-1" />
                    <span className="text-xs font-semibold text-red-600">FLAGGED</span>
                  </div>
                )}
                
                {/* Center: Was Ever Flagged Indicator - Previously Flagged (Orange) */}
                {verifiedData.was_ever_flagged && !verifiedData.is_currently_parked && (
                  <div className="flex items-center px-3 py-1 bg-orange-100 rounded-full">
                    <FiAlertTriangle className="w-4 h-4 text-orange-600 mr-1" />
                    <span className="text-xs font-semibold text-orange-600">WAS FLAGGED</span>
                  </div>
                )}
                
                {/* Center: Already Parked Indicator */}
                {verifiedData.is_currently_parked && !verifiedData.is_flagged && (
                  <div className="flex items-center px-3 py-1 bg-orange-100 rounded-full">
                    <FiAlertCircle className="w-4 h-4 text-orange-600 mr-1" />
                    <span className="text-xs font-semibold text-orange-600">ALREADY INSIDE</span>
                  </div>
                )}
                
                {/* Right: Plate Number */}
                <div className="text-right">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Plate Number</p>
                  <p className="text-lg font-bold text-gray-900 tracking-wide">
                    {verifiedData.plate_number}
                  </p>
                </div>
              </div>
        
              {/* Confirm Entry Button */}
              <button
                type="button"
                onClick={handleConfirmEntry}
                disabled={verifiedData.is_currently_parked}
                className={`w-full px-3 py-3 text-white rounded-lg font-semibold text-sm sm:text-lg transition-colors flex items-center justify-center gap-2 ${
                  verifiedData.is_currently_parked 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                <FiCheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                {verifiedData.is_currently_parked ? 'Already Checked In' : 'Confirm Entry & Open Gate'}
              </button>

              {/* Cancel/Close Button */}
              <button
                type="button"
                onClick={closeAllModals}
                className="w-full mt-2 px-3 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <FiX className="w-3 h-3 sm:w-4 sm:h-4" />
                {verifiedData.is_currently_parked ? 'Close' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Not Found Vehicle Modal - Vehicle not in system */}
      {showUnknownModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full sm:max-w-sm md:max-w-md mx-2 sm:mx-auto overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="bg-red-50 px-3 py-3">
              <div className="flex items-center gap-2">
                <svg width="24" height="24" viewBox="0 0 24 24" color={'red'} fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                  <path
                      d="M11.9998 8.99999V13M11.9998 17H12.0098M10.6151 3.89171L2.39019 18.0983C1.93398 18.8863 1.70588 19.2803 1.73959 19.6037C1.769 19.8857 1.91677 20.142 2.14613 20.3088C2.40908 20.5 2.86435 20.5 3.77487 20.5H20.2246C21.1352 20.5 21.5904 20.5 21.8534 20.3088C22.0827 20.142 22.2305 19.8857 22.2599 19.6037C22.2936 19.2803 22.0655 18.8863 21.6093 18.0983L13.3844 3.89171C12.9299 3.10654 12.7026 2.71396 12.4061 2.58211C12.1474 2.4671 11.8521 2.4671 11.5935 2.58211C11.2969 2.71396 11.0696 3.10655 10.6151 3.89171Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                  />
                </svg>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Vehicle Not Found
                  </h3>
                  <p className="text-gray-500 text-xs">This vehicle is not registered in the system</p>
                </div>
              </div>
            </div>
            
            {/* Red Info Message - Vehicle Not Found */}
            <div className="bg-red-100 px-3 py-2">
              <p className="text-red-800 text-xs text-center">
                This vehicle is not registered. Please register visitor details to grant one-time access.
              </p>
            </div>
            
            <div className="p-3">
              <div className="space-y-3">
                {/* Plate Number */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Plate Number</label>
                   <input
                    type="text"
                    name="plate_number"
                    value={unknownForm.plate_number}
                    onChange={handleInputChange}
                    placeholder="Enter plate number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* National ID / Passport */}
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">National ID / Passport</label>
                  <input
                    type="text"
                    name="national_id"
                    value={unknownForm.national_id || ''}
                    onChange={handleInputChange}
                    placeholder="Enter national ID or passport number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Full Names */}
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Full Names</label>
                  <input
                    type="text"
                    name="driver_name"
                    value={unknownForm.driver_name}
                    onChange={handleInputChange}
                    placeholder="Enter full names"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Phone Number */}
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Phone Number</label>
                  <input
                    type="tel"
                    name="driver_telephone"
                    value={unknownForm.driver_telephone}
                    onChange={handleInputChange}
                    placeholder="Enter phone number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Email (Optional)</label>
                  <input
                    type="email"
                    name="driver_email"
                    value={unknownForm.driver_email || ''}
                    onChange={handleInputChange}
                    placeholder="Enter email address (optional)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Badge Number */}
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Badge Number</label>
                  <input
                    type="text"
                    name="badge_number"
                    value={unknownForm.badge_number || ''}
                    onChange={handleInputChange}
                    placeholder="Enter badge number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-wide mb-2">Gender</label>
                  <div className="flex gap-2">
                    {['Male', 'Female', 'Other'].map((gender) => (
                      <button
                        key={gender}
                        type="button"
                        onClick={() => handleInputChange({ target: { name: 'driver_gender', value: gender } } as any)}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                          unknownForm.driver_gender === gender
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {gender}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Driver Type */}
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-wide mb-2">Driver Type</label>
                  <div className="flex gap-2">
                    {['Regular', 'Staff', 'Visitor'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => handleInputChange({ target: { name: 'driver_type', value: type } } as any)}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                          unknownForm.driver_type === type
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="px-3 pb-3">
              <button
                type="button"
                onClick={handleRegisterUnknown}
                disabled={loading}
                className="w-full px-3 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <FiSearch className="w-4 h-4 animate-spin" />
                    <span>Registering...</span>
                  </>
                ) : (
                  <>
                    <FiCheckCircle className="w-4 h-4" />
                    <span>REGISTER A CAR</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={closeAllModals}
                className="w-full mt-2 px-3 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <FiX className="w-3 h-3" />
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiCheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Vehicle Entry</h3>
            <p className="text-gray-500 mb-6">Vehicle has been checked in successfully</p>
            <button
              type="button"
              onClick={closeAllModals}
              className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Already Parked Modal */}
      {showAlreadyParkedModal && verifiedData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full sm:max-w-sm md:max-w-md mx-2 sm:mx-auto overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="bg-orange-100 px-3 sm:px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-orange-200">
                  <FiAlertOctagon className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    Vehicle Already Inside
                  </h3>
                  <p className="text-orange-700 text-sm">This vehicle is already in the facility</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAlreadyParkedModal(false);
                  setPlateNumber('');
                  setVerifiedData(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <FiX className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-3 sm:p-6">
              {/* Vehicle Details */}
              <div className="bg-gray-100 p-4 rounded-xl mb-4">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Plate Number</p>
                    <p className="text-xl font-bold text-gray-900">{verifiedData.plate_number}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Type</p>
                    <p className="text-lg font-semibold text-gray-900">{verifiedData.vehicle_category || '-'}</p>
                  </div>
                </div>
                
                {verifiedData.driver_details?.name && (
                  <div className="border-t border-gray-200 pt-3 mt-3">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Driver</p>
                    <p className="text-lg font-medium text-gray-900">{verifiedData.driver_details.name}</p>
                    {verifiedData.driver_details.telephone && (
                      <p className="text-sm text-gray-600">{verifiedData.driver_details.telephone}</p>
                    )}
                  </div>
                )}
                
                {verifiedData.parking_details?.slot_number && (
                  <div className="border-t border-gray-200 pt-3 mt-3">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Parking Slot</p>
                    <p className="text-lg font-semibold text-blue-600">{verifiedData.parking_details.slot_number}</p>
                  </div>
                )}
              </div>

              {/* Flagged Warning - Currently Flagged (Red) */}
              {verifiedData.is_flagged && verifiedData.is_currently_parked && (
                <div className="flex items-center px-4 py-3 bg-red-100 rounded-xl mb-4">
                  <FiAlertTriangle className="w-5 h-5 text-red-600 mr-2" />
                  <span className="text-sm font-medium text-red-600">This vehicle has been flagged and is currently inside</span>
                </div>
              )}

              {/* Was Ever Flagged Warning - Previously Flagged (Orange) */}
              {verifiedData.was_ever_flagged && !verifiedData.is_currently_parked && (
                <div className="flex items-center px-4 py-3 bg-orange-100 rounded-xl mb-4">
                  <FiAlertTriangle className="w-5 h-5 text-orange-600 mr-2" />
                  <span className="text-sm font-medium text-orange-600">Warning: This vehicle was flagged in the past</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAlreadyParkedModal(false);
                    setPlateNumber('');
                    setVerifiedData(null);
                  }}
                  className="flex-1 py-3 px-4 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-medium transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!verifiedData?.plate_number) return;
                    setLoading(true);
                    try {
                      const response = await smartParkingService.checkOut(verifiedData.plate_number);
                      if (response.success) {
                        setShowAlreadyParkedModal(false);
                        setShowSuccessModal(true);
                        setPlateNumber('');
                        setVerifiedData(null);
                        showSuccess('Vehicle checked out successfully');
                        fetchDashboardData();
                      } else {
                        showError(response.message || 'Failed to checkout vehicle');
                      }
                    } catch (err: any) {
                      showError(err?.message || 'Failed to checkout vehicle');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                  className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                >
                  {loading ? 'Processing...' : 'Checkout Vehicle'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Long Duration Vehicles Modal */}
      {showLongDurationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full sm:max-w-2xl mx-2 sm:mx-auto overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="bg-orange-100 px-3 sm:px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-orange-200">
                  <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Long Duration Vehicles {'(>8h)'}
                  </h3>
                  <p className="text-sm text-orange-700">{longDurationVehicles.length} vehicles total</p>
                </div>
              </div>
              <button
                onClick={() => setShowLongDurationModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FiX className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-4">
              {/* Date Filter in Modal */}
              <div className="mb-3 flex items-center gap-2">
                <label className="text-xs text-gray-500">Filter by Date:</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={() => fetchDashboardData()}
                  className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                >
                  Filter
                </button>
              </div>

              <table className="w-full text-xs">
                <thead className="text-left text-gray-500" style={{ backgroundColor: 'rgba(100, 116, 139, 0.07)' }}>
                  <tr>
                    <th className="p-2 font-semibold">PLATE NO.</th>
                    <th className="p-2 font-semibold">ENTRY TIME</th>
                    <th className="p-2 font-semibold">DURATION</th>
                    <th className="p-2 font-semibold">STATUS</th>
                    <th className="p-2 font-semibold text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {longDurationVehicles.map((vehicle, index) => (
                    <tr key={index} className="border-t border-gray-100">
                      <td className="py-2 font-bold text-slate-800">{vehicle.plate_no}</td>
                      <td className="text-slate-500">
                        {new Date(vehicle.entry_time).toLocaleString('en-US', { 
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true 
                        })}
                      </td>
                      <td className="py-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDurationBgColor(vehicle.duration)}`}>
                          {vehicle.duration}
                        </span>
                      </td>
                      <td className="py-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${vehicle.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
                          {vehicle.status === 'active' ? 'Inside' : 'Out'}
                        </span>
                      </td>
                      <td className="text-right">
                        {vehicle.status === 'active' ? (
                          <button 
                            onClick={async () => {
                              if (!vehicle.plate_no) return;
                              setLoading(true);
                              try {
                                const response = await smartParkingService.checkOutByPlate(vehicle.plate_no);
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
                              }
                            }}
                            className="text-xs bg-red-100 text-red-600 px-3 py-1.5 rounded hover:bg-red-200"
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
      )}

      {/* Flagged Vehicles Modal */}
      {showFlaggedModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full sm:max-w-2xl mx-2 sm:mx-auto overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="bg-red-100 px-3 sm:px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-200">
                  <FiAlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Flagged Vehicles
                  </h3>
                  <p className="text-sm text-red-700">{flaggedVehicles.length} vehicles total</p>
                </div>
              </div>
              <button
                onClick={() => setShowFlaggedModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FiX className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-4">
              {flaggedVehicles.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  No flagged vehicles in system
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="text-left text-gray-500" style={{ backgroundColor: 'rgba(239, 68, 68, 0.07)' }}>
                    <tr>
                      <th className="p-2 font-semibold">PLATE NO.</th>
                      <th className="p-2 font-semibold">DRIVER</th>
                      <th className="p-2 font-semibold">TYPE</th>
                      <th className="p-2 font-semibold">STATUS</th>
                      <th className="p-2 font-semibold text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flaggedVehicles.map((vehicle, index) => (
                      <tr key={index} className="border-t border-red-100">
                        <td className="py-2 font-bold text-red-600">{vehicle.plate_no}</td>
                        <td className="text-slate-500">{vehicle.driver_name}</td>
                        <td className="py-2">
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            {vehicle.driver_type}
                          </span>
                        </td>
                        <td className="py-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${vehicle.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
                            {vehicle.status === 'active' ? 'Inside' : 'Out'}
                          </span>
                        </td>
                        <td className="text-right">
                          {vehicle.status === 'active' ? (
                            <button 
                              onClick={async () => {
                                if (!vehicle.plate_no) return;
                                setLoading(true);
                                try {
                                  const response = await smartParkingService.checkOutByPlate(vehicle.plate_no);
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
                                }
                              }}
                              className="text-xs bg-red-100 text-red-600 px-3 py-1.5 rounded hover:bg-red-200"
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
              )}
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default SmartParkingDashboard;


