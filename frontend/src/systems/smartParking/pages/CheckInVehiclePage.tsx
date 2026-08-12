
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useToast } from '../../../core/contexts/ToastContext';
import { useSocket } from '../../../core/contexts/SocketContext';
import { useParkingEvents } from '../../../core/hooks/useParkingEvents';
import { smartParkingService } from '../../../core/services/adminService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import { 
  FiSearch, FiCheckCircle, FiAlertTriangle, FiUser, FiPhone, FiPlus, FiX, FiFlag, FiSlash, FiEdit, FiAlertCircle, FiAward, FiCreditCard
} from 'react-icons/fi';
import { BsShieldCheck } from 'react-icons/bs';
import SpiralLoader from '@/systems/event-managment/components/SpiralLoader';

// City of Kigali (CoK) institutional design constants
const PRIMARY = "#056daa";
const PRIMARY_HOVER = "#045d94";
const SUCCESS = "#4CAF50";
const WARNING = "#F39C12";
const DANGER = "#E74C3C";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const TERTIARY = "#555555";
const WHITE = "#FFFFFF";
const GRAY_DISABLED = "#9E9E9E";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";
const INPUT_SHADOW = "0";
const INPUT_FOCUS_SHADOW = "0";

const labelStyle: React.CSSProperties = {
  fontFamily: fontHeading,
  fontSize: '13px',
  fontWeight: 600,
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  color: TERTIARY,
};



const buttonFont: React.CSSProperties = {
  borderRadius: 0,
  textTransform: 'uppercase',
  fontFamily: fontHeading,
  fontSize: '13px',
  fontWeight: 600,
  letterSpacing: '1px',
};

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
  parking_details?: any;
}

interface UnknownVehicleForm {
  plate_number: string;
  driver_name: string;
  driver_telephone: string;
  driver_email?: string;
  driver_gender?: string;
  id_type: string;
  id_number: string;
  badge_number?: string;
  driver_type: string;
}

// Validation helper function
const validateIdNumber = (idType: string, idNumber: string): string | null => {
  if (!idNumber || idNumber.trim() === '') {
    return null; // Optional field - no validation needed
  }
  
  const trimmedId = idNumber.trim();
  
  if (idType === 'National ID') {
    // National ID must be at least 16 characters
    if (trimmedId.length !== 16 ) {
      return 'National ID must be 16 characters';
    }
    // National ID should only contain numbers (Egyptian national ID format)
    if (!/^\d+$/.test(trimmedId)) {
      return 'National ID must contain only numbers';
    }
  } else if (idType === 'Passport') {
    // Passport typically 6-9 characters with letters and numbers
    if (trimmedId.length < 6) {
      return 'Passport number must be at least 6 characters';
    }
    if (!/^[A-Z0-9]+$/i.test(trimmedId)) {
      return 'Passport number must contain only letters and numbers';
    }
  } else if (idType === 'Driving Licence') {
    // Driving licence typically 8-15 characters
    if (trimmedId.length < 8) {
      return 'Driving Licence must be at least 8 characters';
    }
    if (!/^[A-Z0-9]+$/i.test(trimmedId)) {
      return 'Driving Licence must contain only letters and numbers';
    }
  }
  
  return null; // Valid
}

// Email validation helper
const validateEmail = (email: string): string | null => {
  if (!email || email.trim() === '') {
    return null; // Optional field - no validation needed
  }
  
  const trimmedEmail = email.trim();
  // General email regex - accepts any valid email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    return 'Please enter a valid email address';
  }
  
  return null; // Valid
}

const CheckInVehiclePage: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const { socket, isConnected } = useSocket();
  
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [plateNumber, setPlateNumber] = useState('');
  const [idError, setIdError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  
  // Modal states
  const [showFoundModal, setShowFoundModal] = useState(false);
  const [showUnknownModal, setShowUnknownModal] = useState(false);
  const [showAlreadyParkedModal, setShowAlreadyParkedModal] = useState(false);
  const [showFlaggedModal, setShowFlaggedModal] = useState(false);
  const [isEditingDriver, setIsEditingDriver] = useState(false);
  
  const [driverInfo, setDriverInfo] = useState({
    name: '',
    telephone: '',
    badge_number: '',
    driver_type: 'Regular',
  });

  const [verifiedData, setVerifiedData] = useState<VehicleData | null>(null);
  const [unknownForm, setUnknownForm] = useState<UnknownVehicleForm>({
    plate_number: '',
    driver_name: '',
    driver_telephone: '',
    driver_email: '',
    driver_gender: '',
    id_type: 'National ID',
    id_number: '',
    badge_number: '',
    driver_type: 'Regular',
  });

// Socket events handled by useParkingEvents hook (universal)
// Keep vehicle-detected for auto-plate input
  useEffect(() => {
    if (!socket) return;

    const handleVehicleDetected = (data: any) => {
      if (data.plate_number) {
        setPlateNumber(data.plate_number);
      }
    };

    socket.on('vehicle-detected', handleVehicleDetected);

    return () => {
      socket.off('vehicle-detected', handleVehicleDetected);
    };
  }, [socket]);



  // Define handleVerify before using it in useParkingEvents
  const handleVerify = useCallback(async (plate?: string) => {
    const searchPlate = plate || plateNumber.trim();
    if (!searchPlate) {
      showWarning('Please enter a plate number');
      return;
    }

    setVerifying(true);
    // Reset verified data before new verification
    setVerifiedData(null);

    try {
      const response = await smartParkingService.verifyCar(searchPlate);
      
      if (response.success && response.data) {
        const data = response.data;
        setVerifiedData(data);
        
        // Initialize driver info from verified data
        setDriverInfo({
          name: data.driver_details?.name || data.driver_name || '',
          telephone: data.driver_details?.telephone || data.driver_telephone || '',
          badge_number: (data as any).badge_number || '',
          driver_type: data.driver_type || data.vehicle_category || 'Regular',
          
          
        });
        
        // Vehicle is found in system - ALWAYS show Found Vehicle Modal
        setShowFoundModal(true);
      } else {
        // Vehicle not found in system - show Unknown Modal
        setVerifiedData(response.data || {
          plate_number: searchPlate.toUpperCase(),
          vehicle_category: 'Unknown'
        });
        setUnknownForm(prev => ({ ...prev, plate_number: searchPlate.toUpperCase() }));
        setShowUnknownModal(true);
        showInfo('Vehicle not found in system');
      }
    } catch (error: any) {
      console.error('Verification error:', error);
      showError(error.message || 'Failed to verify vehicle');
      // Show unknown modal on error as well
      const errorData = error?.response?.data;
      setVerifiedData(errorData?.data || { 
        plate_number: searchPlate.toUpperCase(),
        vehicle_category: 'Unknown' 
      });
      setUnknownForm(prev => ({ ...prev, plate_number: searchPlate.toUpperCase() }));
      setShowUnknownModal(true);
    } finally {
      setVerifying(false);
    }
  }, [plateNumber, showWarning, showError, showInfo, smartParkingService]);



  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setUnknownForm(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Validate ID number when id_type or id_number changes
    if (name === 'id_type' || name === 'id_number') {
      const newIdType = name === 'id_type' ? value : unknownForm.id_type;
      const newIdNumber = name === 'id_number' ? value : unknownForm.id_number;
      const error = validateIdNumber(newIdType, newIdNumber);
      setIdError(error);
    }
    
    // Validate email when email changes
    if (name === 'driver_email') {
      const error = validateEmail(value);
      setEmailError(error);
    }
  };

  const handleDriverInfoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setDriverInfo(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleConfirmEntry = async () => {
    if (!verifiedData?.plate_number) return;
    if (verifiedData.is_currently_parked) {
      showWarning('This vehicle is already checked in');
      return;
    }
    // Allow reserved vehicles to bypass badge requirement
    if (!verifiedData.is_reserved && !driverInfo.badge_number?.trim()) {
      showWarning('Badge number is required');
      return;
    }
    
    setLoading(true);
    try {
      // Get driver type - use driver_type first (shown in UI), then fall back to vehicle_category
      let driverType = verifiedData.driver_type || verifiedData.vehicle_category || verifiedData.driver_details?.type || '';
      // Convert to lowercase for backend API
      driverType = driverType.toLowerCase();
      
      // Get identification from verified data
      const identification = verifiedData.driver_details?.identification || null;
   
      const checkInData = {
        plate_number: verifiedData.plate_number,
        driver_name: driverInfo.name || verifiedData.driver_details?.name || verifiedData.driver_name || '',
        driver_telephone: driverInfo.telephone || verifiedData.driver_details?.telephone || verifiedData.driver_telephone || '',
        driver_type: driverType.trim() === "" ? "Regular" : driverType.trim(),
        driver_identification: identification,
        badge_number: driverInfo.badge_number?.trim() || null,
      };

      console.log('[CheckInVehicle - Known] ID Number being sent:', checkInData);

      const response = await smartParkingService.checkIn(checkInData);

      if (response.success) {
        setShowFoundModal(false);
        setPlateNumber('');
        setVerifiedData(null);
        showSuccess('Vehicle checked in successfully');
      } else {
        showError(response.message || 'Failed to check in vehicle');
      }
    } catch (err: any) {
      showError(err?.message || 'Failed to check in vehicle');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterUnknown = useCallback(async () => {
    if (!unknownForm.plate_number || !unknownForm.driver_name || !unknownForm.driver_telephone) {
      showWarning('Please fill in required fields');
      return;
    }
    
    // Validate ID number
    const idValidationError = validateIdNumber(unknownForm.id_type, unknownForm.id_number);
    if (idValidationError) {
      showError(idValidationError);
      return;
    }
    
    // Validate email if provided
    const emailValidationError = validateEmail(unknownForm.driver_email || '');
    if (emailValidationError) {
      showError(emailValidationError);
      return;
    }

    setLoading(true);
    try {
      const checkInData = {
        plate_number: unknownForm.plate_number,
        driver_name: unknownForm.driver_name,
        driver_telephone: unknownForm.driver_telephone,
        driver_email: unknownForm.driver_email,
        driver_gender: unknownForm.driver_gender,
        driver_type: unknownForm.driver_type,
        badge_number: unknownForm.badge_number,
        driver_identification: unknownForm.id_number ? {
          id_type: unknownForm.id_type,
          number: unknownForm.id_number
        } : {}
      };

      console.log(' [CheckInVehicle - Unknown] ID Number being sent:', checkInData);

      const response = await smartParkingService.checkIn(checkInData);
      
      if (response.success) {
        setShowUnknownModal(false);
        setPlateNumber('');
        setUnknownForm({
          plate_number: '',
          driver_name: '',
          driver_telephone: '',
          driver_email: '',
          driver_gender: '',
          id_type: 'National ID',
          id_number: '',
          badge_number: '',
          driver_type: 'Regular',
        });
        setVerifiedData(null);
        setIdError(null);
        showSuccess('Vehicle registered and checked in successfully');
      } else {
        showError(response.message || 'Failed to register vehicle');
      }
    } catch (err: any) {
      showError(err?.message || 'Failed to register vehicle');
    } finally {
      setLoading(false);
    }
  }, [unknownForm, showWarning, showError, showSuccess, smartParkingService]);

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

  const closeAllModals = () => {
    setShowFoundModal(false);
    setShowUnknownModal(false);
    setShowAlreadyParkedModal(false);
    setShowFlaggedModal(false);
    setVerifiedData(null);
    setIsEditingDriver(false);
    setPlateNumber('');
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: PRIMARY }}></div>
          <p style={{ color: '#555555' }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <MainLayout>
      <div className="p-4 sm:p-6" style={{ backgroundColor: NEUTRAL_LIGHT }}>
  <div className="flex justify-center">
    <div className="w-full max-w-md">
      {/* Manual Verification Panel - Centered */}
      <div className="p-4 sm:p-6" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW }}>
        <div className="-mx-4 sm:-mx-6 -mt-4 sm:-mt-6 px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 mb-4" style={{ backgroundColor: NEUTRAL_LIGHT, borderBottom: `1px solid ${BORDER}` }}>
          <h2 className="text-base sm:text-lg font-bold mb-1" style={{ color: PRIMARY, fontFamily: fontHeading }}>Plate Number Verification</h2>
          <p className="text-xs" style={{ color: '#555555' }}>Enter plate number</p>
        </div>
        
        <div className="mb-4">
          <label className="block mb-2 text-sm sm:text-base" style={labelStyle}>License Plate Number</label>
          <input
            type="text"
            value={plateNumber}
            onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
            placeholder=".........................."
            className="cok-auth-input pr-3 py-2 sm:py-3 text-sm sm:text-base"
          />
        </div>

        {verifiedData ? (
          <div className="p-3 mb-4" style={{ backgroundColor: NEUTRAL_LIGHT }}>
            <div className="font-semibold text-sm" style={{ color: NEUTRAL_DARK }}>{verifiedData.driver_details?.name || verifiedData.driver_name || 'Unknown'}</div>
            <div className="text-xs" style={{ color: GRAY_DISABLED }}>{verifiedData.driver_type || '___'}</div>
            <div className="font-medium text-xs mt-1" style={{ color: SUCCESS }}>ALLOWED</div>
          </div>
        ) : (
          <div className="p-3 mb-4" style={{ backgroundColor: NEUTRAL_LIGHT }}>
            <div className="text-xs text-center" style={{ color: GRAY_DISABLED }}>Enter plate above number to verify</div>
          </div>
        )}

        <button
          type="button"
          onClick={() => handleVerify()}
          disabled={verifying || !plateNumber.trim()}
          className="w-full py-2 sm:py-3 max-h-[50px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1 transition-colors text-sm sm:text-base"
          style={{ ...buttonFont, border: 'none', backgroundColor: PRIMARY, color: WHITE }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
        >
          {verifying ? (
            <span className="flex items-center gap-2">
              <SpiralLoader color="#FFFFFFF" />
              <span>Verifying plate...</span>
            </span>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <BsShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Verify PLATE NUMBER</span>
              </div>
            </>
          )}
        </button>
      </div>
    </div>
  </div>
</div>

{/* Found Vehicle Modal */}
{showFoundModal && verifiedData && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="w-full max-w-md mx-2 sm:mx-4 overflow-hidden max-h-[90vh] overflow-y-auto" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW }}>
      <div className="px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between" style={{ backgroundColor: verifiedData.is_reserved ? 'rgba(5,109,170,0.10)' : (verifiedData.is_flagged && verifiedData.is_currently_parked) ? 'rgba(231,76,60,0.10)' : (verifiedData.was_ever_flagged && !verifiedData.is_currently_parked) ? 'rgba(243,156,18,0.10)' : verifiedData.is_currently_parked ? 'rgba(243,156,18,0.10)' : 'rgba(76,175,80,0.10)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: verifiedData.is_reserved ? 'rgba(5,109,170,0.12)' : (verifiedData.is_flagged && verifiedData.is_currently_parked) ? 'rgba(231,76,60,0.12)' : (verifiedData.was_ever_flagged && !verifiedData.is_currently_parked) ? 'rgba(243,156,18,0.12)' : verifiedData.is_currently_parked ? 'rgba(243,156,18,0.12)' : 'rgba(76,175,80,0.12)' }}>
            {verifiedData.is_reserved ? (
              <FiAward className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: PRIMARY }} />
            ) : verifiedData.is_flagged && verifiedData.is_currently_parked ? (
              <FiAlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: DANGER }} />
            ) : (verifiedData.was_ever_flagged && !verifiedData.is_currently_parked) ? (
              <FiAlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: WARNING }} />
            ) : verifiedData.is_currently_parked ? (
              <FiAlertCircle className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: WARNING }} />
            ) : (
              <BsShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: SUCCESS }} />
            )}
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Vehicle Verification</h3>
            <p className="text-xs sm:text-sm" style={{ color: verifiedData.is_reserved ? PRIMARY : (verifiedData.is_flagged && verifiedData.is_currently_parked) ? DANGER : (verifiedData.was_ever_flagged && !verifiedData.is_currently_parked) ? WARNING : verifiedData.is_currently_parked ? WARNING : SUCCESS }}>
              {verifiedData.is_reserved ? 'Reserved Vehicle' : verifiedData.is_flagged && verifiedData.is_currently_parked ? 'Vehicle is flagged' : (verifiedData.was_ever_flagged && !verifiedData.is_currently_parked) ? 'Vehicle was flagged in the past' : verifiedData.is_currently_parked ? 'Already inside parking' : 'Auto-scan successful'}
            </p>
          </div>
        </div>
      </div>
      
      <div className="p-4 sm:p-6">
        {/* Avatar */}
        <div className="flex flex-col items-center mb-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mb-2" style={{ backgroundColor: 'rgba(5,109,170,0.10)' }}>
            <span className="text-2xl sm:text-3xl font-bold" style={{ color: PRIMARY, fontFamily: fontHeading }}>
              {(verifiedData.driver_details?.name || verifiedData.driver_name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </span>
          </div>
          {(verifiedData.staff_details?.department_name) && (
            <div className="px-3 py-1" style={{ backgroundColor: 'rgba(76,175,80,0.10)' }}>
              <span className="text-xs font-medium" style={{ color: SUCCESS }}>{verifiedData.staff_details?.department_name}</span>
            </div>
          )}
        </div>

        {/* Driver Info */}
        <div className="mb-4 p-3" style={{ backgroundColor: NEUTRAL_LIGHT }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-semibold" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Driver Information</h4>
              {verifiedData.is_reserved && (
                <span className="px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: 'rgba(76,175,80,0.10)', color: SUCCESS }}>
                  Reserved
                </span>
              )}
            </div>
            {/* Only show edit button if vehicle is not currently parked AND not reserved */}
            {!verifiedData.is_currently_parked && !verifiedData.is_reserved && (
              <button type="button" onClick={() => setIsEditingDriver(!isEditingDriver)} className="cok-btn-outlined text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5">
                {isEditingDriver ? 'Cancel' : 'Edit'}
              </button>
            )}
          </div>

          {isEditingDriver ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm" style={labelStyle}>Name</label>
                <input type="text" name="name" value={driverInfo.name} onChange={handleDriverInfoChange} className="cok-auth-input pr-3 py-2 sm:py-3 text-sm" />
              </div>
              <div>
                <label className="text-sm" style={labelStyle}>Phone</label>
                <input type="tel" name="telephone" value={driverInfo.telephone} onChange={handleDriverInfoChange} className="cok-auth-input pr-3 py-2 sm:py-3 text-sm" />
              </div>
              <div className="col-span-1 sm:col-span-2">
                <label className="text-sm" style={labelStyle}>
                  Badge Number {verifiedData.is_reserved ? '(Optional for reserved)' : '*'}
                </label>
                <input 
                  type="text" 
                  name="badge_number" 
                  value={driverInfo.badge_number} 
                  onChange={handleDriverInfoChange} 
                  className="cok-auth-input pr-3 py-2 sm:py-3 text-sm" 
                  required={!verifiedData.is_reserved}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm" style={{ color: NEUTRAL_DARK }}>
                <FiUser className="w-4 h-4" style={{ color: GRAY_DISABLED }} />
                {driverInfo.name || 'Not specified'}
              </div>
              <div className="flex items-center gap-2 text-sm" style={{ color: NEUTRAL_DARK }}>
                <FiPhone className="w-4 h-4" style={{ color: GRAY_DISABLED }} />
                {driverInfo.telephone || 'Not specified'}
              </div>
              <div className="flex items-center gap-2 text-sm font-medium" style={{ color: NEUTRAL_DARK }}>
                <FiAward className="w-4 h-4" style={{ color: GRAY_DISABLED }} />
                Badge: {driverInfo.badge_number || (verifiedData.is_reserved ? '___ (Reserved)' : 'Not specified')}
              </div>
            </div>
          )}
        </div>

        {/* Vehicle Info */}
        <div className="flex justify-between items-center p-3 mb-4" style={{ backgroundColor: NEUTRAL_LIGHT }}>
          <div>
            <p className="text-sm" style={labelStyle}>Vehicle</p>
            <p className="font-semibold text-sm sm:text-base" style={{ color: NEUTRAL_DARK }}>{verifiedData.vehicle_category || 'Staff Vehicle'}</p>
          </div>
          <div className="text-right">
            <p className="text-sm" style={labelStyle}>Plate</p>
            <p className="font-bold text-sm sm:text-base" style={{ color: NEUTRAL_DARK }}>{verifiedData.plate_number}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleConfirmEntry}
          disabled={verifiedData.is_currently_parked}
          className={`w-full py-2 sm:py-3 flex items-center justify-center gap-2 transition-colors text-sm sm:text-base ${verifiedData.is_currently_parked ? 'cursor-not-allowed' : ''}`}
          style={{ ...buttonFont, border: 'none', backgroundColor: verifiedData.is_currently_parked ? GRAY_DISABLED : PRIMARY, color: WHITE }}
          onMouseEnter={(e) => { if (!verifiedData.is_currently_parked) e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
          onMouseLeave={(e) => { if (!verifiedData.is_currently_parked) e.currentTarget.style.backgroundColor = PRIMARY; }}
        >
          <FiCheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
          {verifiedData.is_currently_parked ? 'Already Checked In' : verifiedData.is_reserved ? 'Confirm Entry (Reserved Vehicle)' : 'Confirm Entry & Open Gate'}
        </button>

        <button type="button" onClick={closeAllModals} className="w-full mt-3 sm:mt-5 cok-btn-outlined text-sm sm:text-base py-2 sm:py-2.5">
          {verifiedData.is_currently_parked ? 'Close' : 'Cancel'}
        </button>
      </div>
    </div>
  </div>
)}

{/* Unknown Vehicle Modal */}
{showUnknownModal && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="w-full max-w-2xl mx-2 sm:mx-4 overflow-hidden max-h-[90vh] overflow-y-auto" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW }}>
      <div className="px-4 sm:px-6 py-3 sm:py-4" style={{ backgroundColor: 'rgba(231,76,60,0.08)' }}>
        <div className="flex items-center gap-2">
          <FiAlertCircle className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: DANGER }} />
          <div>
            <h3 className="text-sm sm:text-base font-bold" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Vehicle Not Found</h3>
            <p className="text-xs" style={{ color: '#555555' }}>This vehicle is not registered in the system</p>
          </div>
        </div>
      </div>
      
      <div className="px-4 sm:px-6 py-2" style={{ backgroundColor: 'rgba(231,76,60,0.12)' }}>
        <p className="text-xs text-center" style={{ color: DANGER }}>This vehicle is not registered. Please register visitor details to grant one-time access.</p>
      </div>
      
      <div className="p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block mb-1 text-sm" style={labelStyle}>Plate Number</label>
            <input type="text" name="plate_number" value={unknownForm.plate_number} disabled placeholder="Enter plate number" className="cok-auth-input pr-3 py-2 sm:py-3 text-sm uppercase" />
          </div>

          <div>
            <label className="block mb-1 text-sm" style={labelStyle}>ID Type</label>
            <select
              name="id_type"
              value={unknownForm.id_type}
              onChange={handleInputChange}
              className="cok-auth-input pr-3 py-2 sm:py-3 text-sm"
            >
              <option value="National ID">National ID</option>
              <option value="Passport">Passport</option>
              <option value="Driving Licence">Driving Licence</option>
            </select>
          </div>

          <div>
            <label className="block mb-1 text-sm" style={labelStyle}>
              {unknownForm.id_type === 'National ID' ? 'National ID (16 digits)' : 'ID Number'}
            </label>
            <input 
              type="text" 
              name="id_number" 
              value={unknownForm.id_number || ''} 
              onChange={handleInputChange} 
              placeholder={unknownForm.id_type === 'National ID' ? 'Enter 16_digit national ID' : 'Enter ID number'} 
              className="cok-auth-input pr-3 py-2 sm:py-3 text-sm" 
              style={{ borderColor: idError ? DANGER : '' }} 
              onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = INPUT_FOCUS_SHADOW; }} 
              onBlur={(e) => { e.currentTarget.style.borderColor = idError ? DANGER : ''; e.currentTarget.style.boxShadow = INPUT_SHADOW; }} 
            />
            {idError && (
              <p className="mt-1 text-xs" style={{ color: DANGER }}>{idError}</p>
            )}
            {unknownForm.id_type === 'National ID' && unknownForm.id_number && !idError && (
              <p className="mt-1 text-xs" style={{ color: SUCCESS }}>✓ National ID format valid</p>
            )}
          </div>

          <div>
            <label className="block mb-1 text-sm" style={labelStyle}>Full Names</label>
            <input type="text" name="driver_name" value={unknownForm.driver_name} onChange={handleInputChange} placeholder="Enter full names" className="cok-auth-input pr-3 py-2 sm:py-3 text-sm" />
          </div>

          <div>
            <label className="block mb-1 text-sm" style={labelStyle}>Phone Number</label>
            <input type="tel" name="driver_telephone" value={unknownForm.driver_telephone} onChange={handleInputChange} placeholder="Enter phone number" className="cok-auth-input pr-3 py-2 sm:py-3 text-sm" />
          </div>

          <div>
            <label className="block mb-1 text-sm" style={labelStyle}>Email Address</label>
            <input 
              type="email" 
              name="driver_email" 
              value={unknownForm.driver_email || ''} 
              onChange={handleInputChange} 
              placeholder="Enter email (optional)" 
              className="cok-auth-input pr-3 py-2 sm:py-3 text-sm" 
              style={{ borderColor: emailError ? DANGER : '' }} 
              onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.boxShadow = INPUT_FOCUS_SHADOW; }} 
              onBlur={(e) => { e.currentTarget.style.borderColor = emailError ? DANGER : ''; e.currentTarget.style.boxShadow = INPUT_SHADOW; }} 
            />
            {emailError && (
              <p className="mt-1 text-xs" style={{ color: DANGER }}>{emailError}</p>
            )}
          </div>

          <div>
            <label className="block mb-1 text-sm" style={labelStyle}>Badge Number</label>
            <input type="text" name="badge_number" value={unknownForm.badge_number || ''} onChange={handleInputChange} placeholder="Enter badge number" className="cok-auth-input pr-3 py-2 sm:py-3 text-sm" />
          </div>

          <div>
            <label className="block mb-1 text-sm" style={labelStyle}>Gender</label>
            <div className="flex gap-2">
              {['Male', 'Female'].map((gender) => (
                <button key={gender} type="button" onClick={() => handleInputChange({ target: { name: 'driver_gender', value: gender } } as any)} className="flex-1 py-1.5 sm:py-2 transition-colors text-sm" style={{ ...buttonFont, border: 'none', backgroundColor: unknownForm.driver_gender === gender ? PRIMARY : NEUTRAL_LIGHT, color: unknownForm.driver_gender === gender ? WHITE : NEUTRAL_DARK }}>
                  {gender}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col  gap-2 pt-4 mt-2">
          
          <button type="button" onClick={handleRegisterUnknown} disabled={loading || !unknownForm.driver_name || !unknownForm.driver_telephone} className="w-full sm:flex-1 px-4 py-2 sm:py-2.5 cok-btn-primary disabled:opacity-50 text-sm">
            {loading ? "Waiting...." : "Register & Check In"}
          </button>
          <button type="button" onClick={closeAllModals} className="w-full sm:flex-1 cok-btn-outlined text-sm py-2 sm:py-2.5">Cancel</button>
        </div>
      </div>
    </div>
  </div>
)}

{/* Already Parked Modal */}
{showAlreadyParkedModal && verifiedData && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="max-w-md w-full p-4 sm:p-6" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW }}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(243,156,18,0.12)' }}>
          <FiAlertCircle className="w-6 h-6 sm:w-8 sm:h-8" style={{ color: WARNING }} />
        </div>
        <div>
          <h3 className="text-lg sm:text-xl font-bold" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Vehicle Already Inside</h3>
          <p className="text-sm" style={{ color: '#555555' }}>{verifiedData.plate_number}</p>
        </div>
      </div>

      <div className="p-3 sm:p-4 mb-4" style={{ backgroundColor: 'rgba(243,156,18,0.10)' }}>
        <p className="font-medium text-sm" style={{ color: WARNING }}>⚠️ This vehicle is already checked in the parking facility.</p>
      </div>

      <div className="p-3 sm:p-4 mb-4" style={{ backgroundColor: NEUTRAL_LIGHT }}>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span style={{ color: '#555555' }}>Driver:</span>
            <p className="font-medium" style={{ color: NEUTRAL_DARK }}>{verifiedData.driver_details?.name || verifiedData.driver_name || '___'}</p>
          </div>
          <div>
            <span style={{ color: '#555555' }}>Type:</span>
            <p className="font-medium" style={{ color: NEUTRAL_DARK }}>{verifiedData.driver_type || '___'}</p>
          </div>
        </div>
      </div>

      <button onClick={closeAllModals} className="w-full px-4 py-2 sm:py-2.5 transition-colors text-sm sm:text-base" style={{ ...buttonFont, border: 'none', backgroundColor: PRIMARY, color: WHITE }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}>Close</button>
    </div>
  </div>
)}

{/* Flagged Vehicle Modal */}
{showFlaggedModal && verifiedData && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="max-w-md w-full p-4 sm:p-6" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW }}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(231,76,60,0.12)' }}>
          <FiFlag className="w-6 h-6 sm:w-8 sm:h-8" style={{ color: DANGER }} />
        </div>
        <div>
          <h3 className="text-lg sm:text-xl font-bold" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>Vehicle Flagged</h3>
          <p className="text-sm" style={{ color: '#555555' }}>{verifiedData.plate_number}</p>
        </div>
      </div>

      <div className="p-3 sm:p-4 mb-4" style={{ backgroundColor: 'rgba(231,76,60,0.08)' }}>
        <p className="font-medium text-sm" style={{ color: DANGER }}>⚠️ This vehicle has been flagged in the system!</p>
        <p className="text-xs sm:text-sm mt-1" style={{ color: DANGER }}>Please verify vehicle and driver details before allowing entry</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <button onClick={closeAllModals} className="w-full sm:flex-1 px-4 py-2 sm:py-2.5 transition-colors text-sm" style={{ ...buttonFont, backgroundColor: '', border: `1px solid ${PRIMARY}`, color: PRIMARY }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(5,109,170,0.08)'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}>Deny Entry</button>
        <button onClick={() => { setShowFlaggedModal(false); setShowUnknownModal(true); }} className="w-full sm:flex-1 px-4 py-2 sm:py-2.5 transition-colors text-sm" style={{ ...buttonFont, border: 'none', backgroundColor: DANGER, color: WHITE }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#C0392B'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = DANGER; }}>Allow Entry</button>
      </div>
    </div>
  </div>
)}
    </MainLayout>
  );
};

export default CheckInVehiclePage;