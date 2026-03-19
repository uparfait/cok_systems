// CheckInVehiclePage - Smart Parking System check-in page for gate officers to verify and register vehicles

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useToast } from '../../../core/contexts/ToastContext';
import { useSocket } from '../../../core/contexts/SocketContext';
import { smartParkingService } from '../../../core/services/adminService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import { 
  FiSearch, FiCheckCircle, FiAlertTriangle, FiUser, FiPhone, FiPlus, FiX, FiFlag, FiSlash, FiEdit, FiAlertCircle, FiAward
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

const CheckInVehiclePage: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const { socket, isConnected } = useSocket();
  
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [plateNumber, setPlateNumber] = useState('');
  
  // Modal states
  const [showFoundModal, setShowFoundModal] = useState(false);
  const [showUnknownModal, setShowUnknownModal] = useState(false);
  const [showAlreadyParkedModal, setShowAlreadyParkedModal] = useState(false);
  const [showFlaggedModal, setShowFlaggedModal] = useState(false);
  const [isEditingDriver, setIsEditingDriver] = useState(false);
  
  const [driverInfo, setDriverInfo] = useState({
    name: '',
    telephone: '',
    badge_number: ''
  });

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

  // Handle socket events
  useEffect(() => {
    if (!socket) return;

    const handleVehicleDetected = (data: any) => {
      if (data.plate_number) {
        setPlateNumber(data.plate_number);
        handleVerify(data.plate_number);
      }
    };

    socket.on('vehicle-detected', handleVehicleDetected);

    return () => {
      socket.off('vehicle-detected', handleVehicleDetected);
    };
  }, [socket]);

  const handleVerify = async (plate?: string) => {
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
          badge_number: (data as any).badge_number || ''
        });
        
        // Vehicle is found in system - ALWAYS show Found Vehicle Modal
        // (Handles all cases: parked, flagged, normal - the modal shows different UI based on status)
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

  const handleConfirmEntry = async () => {
    if (!verifiedData?.plate_number) return;
    if (verifiedData.is_currently_parked) {
      showWarning('This vehicle is already checked in');
      return;
    }
    if (!driverInfo.badge_number?.trim()) {
      showWarning('Badge number is required');
      return;
    }
    
    setLoading(true);
    try {
      const checkInData = {
        plate_number: verifiedData.plate_number,
        driver_name: driverInfo.name || verifiedData.driver_details?.name || verifiedData.driver_name || '',
        driver_telephone: driverInfo.telephone || verifiedData.driver_details?.telephone || verifiedData.driver_telephone || '',
        driver_type: verifiedData.vehicle_category || '',
        badge_number: driverInfo.badge_number?.trim() || null,
      };

      console.log('🔍 [CheckInVehicle - Known] ID Number being sent:', checkInData);

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

  const handleRegisterUnknown = async () => {
    if (!unknownForm.plate_number || !unknownForm.driver_name || !unknownForm.driver_telephone) {
      showWarning('Please fill in required fields');
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
        driver_identification: unknownForm.national_id ? {
          id_type: 'National ID',
          number: unknownForm.national_id
        } : {}
      };

      console.log('🔍 [CheckInVehicle - Unknown] ID Number being sent:', checkInData);

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
          national_id: '',
          badge_number: '',
          driver_type: '',
        });
        setVerifiedData(null);
        showSuccess('Vehicle registered and checked in successfully');
      } else {
        showError(response.message || 'Failed to register vehicle');
      }
    } catch (err: any) {
      showError(err?.message || 'Failed to register vehicle');
    } finally {
      setLoading(false);
    }
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <MainLayout>
      <div className="p-6">
        <div className="flex justify-center">
          <div className="w-full max-w-md">
            {/* Manual Verification Panel - Centered */}
            <div className="bg-white rounded-[20px] p-6 shadow-sm border border-gray-100">
              <div className="rounded-t-[17px] -mx-6 -mt-6 px-6 pt-6 pb-4 mb-4" style={{ backgroundColor: '#F1F5F9' }}>
                <h2 className="text-lg font-bold mb-1" style={{ color: '#0F172A' }}>Manual Verification</h2>
                <p className="text-xs text-gray-500">Enter plate number manually</p>
              </div>
              
              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">License Plate Number</label>
                <input
                  type="text"
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                  placeholder=".........................."
                  className="w-full p-3 border border-gray-200 rounded-lg text-sm font-bold uppercase tracking-wider focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {verifiedData ? (
                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                  <div className="font-semibold text-gray-800 text-sm">{verifiedData.driver_details?.name || verifiedData.driver_name || 'Unknown'}</div>
                  <div className="text-xs text-gray-400">{verifiedData.driver_type || 'N/A'}</div>
                  <div className="text-green-600 font-medium text-xs mt-1">ALLOWED</div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                  <div className="text-xs text-gray-400 text-center">Enter plate number to verify</div>
                </div>
              )}

              <button
                type="button"
                onClick={() => handleVerify()}
                disabled={verifying || !plateNumber.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1 transition-colors"
              >
                {verifying ? (
                  <span className="flex items-center gap-2">
                    <FiSearch className="w-4 h-4 animate-spin" />
                    <span>Verifying plate...</span>
                  </span>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <BsShieldCheck className="w-5 h-5" />
                      <span>Verify & Open</span>
                    </div>
                    <span className="text-xs font-normal text-blue-200">Click to simulate</span>
                  </>
                )}
              </button>

              {verifying && (
                <button
                  type="button"
                  onClick={handleDenyEntry}
                  className="w-full mt-3 border border-red-300 text-red-600 hover:bg-red-50 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <FiX className="w-4 h-4" />
                  Cancel Verification
                </button>
              )}

              <div className="flex gap-2 mt-6">
                <button 
                  type="button"
                  onClick={handleDenyEntry}
                  className="flex-1 border border-gray-300 text-gray-700 hover:bg-gray-100 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <FiSlash className="w-4 h-4" />
                  Deny Entry
                </button>
                <button 
                  type="button"
                  onClick={handleFlagIssue}
                  disabled={loading || !verifiedData}
                  className="flex-1 border border-gray-300 text-gray-700 hover:bg-red-500 hover:text-white py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <FiFlag className="w-4 h-4" />
                  Flag Issue
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Connection Status */}
        <div className="mt-6 flex items-center justify-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-gray-500">
            {isConnected ? 'Real-time connection active' : 'Disconnected - Enter plate manually'}
          </span>
        </div>

        {/* Found Vehicle Modal */}
        {showFoundModal && verifiedData && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden max-h-[90vh] overflow-y-auto">
              <div className={`px-6 py-4 flex items-center justify-between ${verifiedData.is_flagged && verifiedData.is_currently_parked ? 'bg-red-100' : (verifiedData.was_ever_flagged && !verifiedData.is_currently_parked) ? 'bg-orange-100' : verifiedData.is_currently_parked ? 'bg-orange-100' : 'bg-green-100'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${verifiedData.is_flagged && verifiedData.is_currently_parked ? 'bg-red-200' : (verifiedData.was_ever_flagged && !verifiedData.is_currently_parked) ? 'bg-orange-200' : verifiedData.is_currently_parked ? 'bg-orange-200' : 'bg-green-200'}`}>
                    {verifiedData.is_flagged && verifiedData.is_currently_parked ? (
                      <FiAlertTriangle className="w-6 h-6 text-red-600" />
                    ) : (verifiedData.was_ever_flagged && !verifiedData.is_currently_parked) ? (
                      <FiAlertTriangle className="w-6 h-6 text-orange-600" />
                    ) : verifiedData.is_currently_parked ? (
                      <FiAlertCircle className="w-6 h-6 text-orange-600" />
                    ) : (
                      <BsShieldCheck className="w-6 h-6 text-green-600" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Vehicle Verification</h3>
                    <p className={`text-sm ${verifiedData.is_flagged && verifiedData.is_currently_parked ? 'text-red-700' : (verifiedData.was_ever_flagged && !verifiedData.is_currently_parked) ? 'text-orange-700' : verifiedData.is_currently_parked ? 'text-orange-700' : 'text-green-700'}`}>
                      {verifiedData.is_flagged && verifiedData.is_currently_parked ? 'Vehicle is flagged' : (verifiedData.was_ever_flagged && !verifiedData.is_currently_parked) ? 'Vehicle was flagged in the past' : verifiedData.is_currently_parked ? 'Already inside parking' : 'Auto-scan successful'}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                {/* Avatar */}
                <div className="flex flex-col items-center mb-4">
                  <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center mb-2">
                    <span className="text-3xl font-bold text-blue-600">
                      {(verifiedData.driver_details?.name || verifiedData.driver_name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </span>
                  </div>
                  {(verifiedData.staff_details?.department_name) && (
                    <div className="px-3 py-1 bg-green-100 rounded-full">
                      <span className="text-xs font-medium text-gray-600">{verifiedData.staff_details?.department_name}</span>
                    </div>
                  )}
                </div>

                {/* Driver Info */}
                <div className="mb-4 bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-gray-700">Driver Information</h4>
                    {!verifiedData.is_currently_parked && (
                      <button type="button" onClick={() => setIsEditingDriver(!isEditingDriver)} className="text-xs flex items-center gap-1 text-blue-600">
                        <FiEdit className="w-3 h-3" />
                        {isEditingDriver ? 'Cancel' : 'Edit'}
                      </button>
                    )}
                  </div>

                  {isEditingDriver ? (
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs text-gray-500">Name</label>
                        <input type="text" name="name" value={driverInfo.name} onChange={handleDriverInfoChange} className="w-full px-2 py-1 text-sm border rounded" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Phone</label>
                        <input type="tel" name="telephone" value={driverInfo.telephone} onChange={handleDriverInfoChange} className="w-full px-2 py-1 text-sm border rounded" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Badge Number *</label>
                        <input type="text" name="badge_number" value={driverInfo.badge_number} onChange={handleDriverInfoChange} className="w-full px-2 py-1 text-sm border rounded" required />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <FiUser className="w-4 h-4 text-gray-400" />
                        {driverInfo.name || 'Not specified'}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <FiPhone className="w-4 h-4 text-gray-400" />
                        {driverInfo.telephone || 'Not specified'}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-700 font-medium">
                        <FiAward className="w-4 h-4 text-gray-400" />
                        Badge: {driverInfo.badge_number || 'Not specified'}
                      </div>
                    </div>
                  )}
                </div>

                {/* Vehicle Info */}
                <div className="flex justify-between items-center bg-gray-100 p-3 rounded-lg mb-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Vehicle</p>
                    <p className="font-semibold text-gray-900">{verifiedData.vehicle_category || 'Staff Vehicle'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 uppercase">Plate</p>
                    <p className="font-bold text-gray-900">{verifiedData.plate_number}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleConfirmEntry}
                  disabled={verifiedData.is_currently_parked}
                  className={`w-full py-3 text-white rounded-lg font-semibold flex items-center justify-center gap-2 ${verifiedData.is_currently_parked ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  <FiCheckCircle className="w-5 h-5" />
                  {verifiedData.is_currently_parked ? 'Already Checked In' : 'Confirm Entry & Open Gate'}
                </button>

                <button type="button" onClick={closeAllModals} className="w-full mt-2 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium flex items-center justify-center gap-2">
                  <FiX className="w-4 h-4" />
                  {verifiedData.is_currently_parked ? 'Close' : 'Cancel'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Unknown Vehicle Modal */}
        {showUnknownModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden max-h-[90vh] overflow-y-auto">
              <div className="bg-red-50 px-6 py-4">
                <div className="flex items-center gap-2">
                  <FiAlertCircle className="w-6 h-6 text-red-600" />
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Vehicle Not Found</h3>
                    <p className="text-gray-500 text-xs">This vehicle is not registered in the system</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-red-100 px-6 py-2">
                <p className="text-red-800 text-xs text-center">This vehicle is not registered. Please register visitor details to grant one-time access.</p>
              </div>
              
              <div className="p-6 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Plate Number</label>
                  <input type="text" name="plate_number" value={unknownForm.plate_number} onChange={handleInputChange} placeholder="Enter plate number" className="w-full px-3 py-2 border rounded-lg" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">National ID / Passport</label>
                  <input type="text" name="national_id" value={unknownForm.national_id || ''} onChange={handleInputChange} placeholder="Enter national ID" className="w-full px-3 py-2 border rounded-lg" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Full Names</label>
                  <input type="text" name="driver_name" value={unknownForm.driver_name} onChange={handleInputChange} placeholder="Enter full names" className="w-full px-3 py-2 border rounded-lg" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Phone Number</label>
                  <input type="tel" name="driver_telephone" value={unknownForm.driver_telephone} onChange={handleInputChange} placeholder="Enter phone number" className="w-full px-3 py-2 border rounded-lg" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email Address</label>
                  <input type="email" name="driver_email" value={unknownForm.driver_email || ''} onChange={handleInputChange} placeholder="Enter email (optional)" className="w-full px-3 py-2 border rounded-lg" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Badge Number</label>
                  <input type="text" name="badge_number" value={unknownForm.badge_number || ''} onChange={handleInputChange} placeholder="Enter badge number" className="w-full px-3 py-2 border rounded-lg" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Gender</label>
                  <div className="flex gap-2">
                    {['Male', 'Female'].map((gender) => (
                      <button key={gender} type="button" onClick={() => handleInputChange({ target: { name: 'driver_gender', value: gender } } as any)} className={`flex-1 py-2 rounded-lg text-sm font-medium ${unknownForm.driver_gender === gender ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>
                        {gender}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Visitor Type</label>
                  <div className="flex gap-2 flex-wrap">
                    {['Visitor', 'Regular', 'Staff'].map((type) => (
                      <button key={type} type="button" onClick={() => handleInputChange({ target: { name: 'driver_type', value: type } } as any)} className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium ${unknownForm.driver_type === type ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={closeAllModals} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium text-sm">Cancel</button>
                  <button type="button" onClick={handleRegisterUnknown} disabled={loading || !unknownForm.driver_name || !unknownForm.driver_telephone} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                    {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <FiPlus className="w-4 h-4" />}
                    Register & Check In
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

   

        {/* Already Parked Modal */}
        {showAlreadyParkedModal && verifiedData && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
                  <FiAlertCircle className="w-8 h-8 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Vehicle Already Inside</h3>
                  <p className="text-gray-500">{verifiedData.plate_number}</p>
                </div>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                <p className="text-orange-800 font-medium">⚠️ This vehicle is already checked in the parking facility.</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Driver:</span>
                    <p className="font-medium">{verifiedData.driver_details?.name || verifiedData.driver_name || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Type:</span>
                    <p className="font-medium">{verifiedData.driver_type || 'N/A'}</p>
                  </div>
                </div>
              </div>

              <button onClick={closeAllModals} className="w-full px-4 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium">Close</button>
            </div>
          </div>
        )}

        {/* Flagged Vehicle Modal */}
        {showFlaggedModal && verifiedData && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                  <FiFlag className="w-8 h-8 text-red-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Vehicle Flagged</h3>
                  <p className="text-gray-500">{verifiedData.plate_number}</p>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-red-800 font-medium">⚠️ This vehicle has been flagged in the system!</p>
                <p className="text-red-600 text-sm mt-1">Please verify vehicle and driver details before allowing entry</p>
              </div>

              <div className="flex gap-3">
                <button onClick={closeAllModals} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">Deny Entry</button>
                <button onClick={() => { setShowFlaggedModal(false); setShowUnknownModal(true); }} className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium">Allow Entry</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default CheckInVehiclePage;
