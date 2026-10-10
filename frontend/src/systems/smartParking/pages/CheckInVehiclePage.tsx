import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useToast } from '../../../core/contexts/ToastContext';
import { useSocket } from '../../../core/contexts/SocketContext';
import { smartParkingService } from '../../../core/services/adminService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import OverlayShell from '../../../core/components/overlay/OverlayShell';
import { failureOf } from '../../../core/components/visitor/visitorApi';
import { ID_TYPE_OPTIONS, identificationPayload, validateEmail, validateIdNumber } from '../../../core/components/visitor/checkinRules';
import { FiAlertCircle } from 'react-icons/fi';
import { BsShieldCheck } from 'react-icons/bs';
import SpiralLoader from '@/systems/event-managment/components/SpiralLoader';
import PastFlagPanel from './checkinVehicle/PastFlagPanel';
import usePastFlag from './checkinVehicle/usePastFlag';
import type { VerifyData } from './checkinVehicle/vehicleCheckin';
import { prefillFromVerify } from './checkinVehicle/vehicleCheckin';

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

interface VehicleForm {
  plate_number: string;
  driver_name: string;
  driver_telephone: string;
  driver_email: string;
  driver_gender: string;
  id_type: string;
  id_number: string;
  driver_type: string;
  badge_number: string;
}

const emptyForm = (plate = ''): VehicleForm => ({
  plate_number: plate,
  driver_name: '',
  driver_telephone: '',
  driver_email: '',
  driver_gender: '',
  id_type: 'National ID',
  id_number: '',
  driver_type: 'Regular',
  badge_number: '',
});

const formFromVerify = (data: VerifyData, plate: string): VehicleForm => {
  const driver = prefillFromVerify(data);
  return {
    plate_number: (data.plate_number || plate).toUpperCase(),
    driver_name: driver.full_name,
    driver_telephone: driver.telephone,
    driver_email: driver.email,
    driver_gender: driver.gender,
    id_type: ID_TYPE_OPTIONS.includes(driver.identification.id_type) ? driver.identification.id_type : 'National ID',
    id_number: driver.identification.number,
    driver_type: data.vehicle_category || 'Regular',
    badge_number: '',
  };
};

const CheckInVehiclePage: React.FC = () => {
  const { isLoading: authLoading } = useAuth();
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const { socket } = useSocket();
  const { pastFlag, loading: pastFlagLoading, load: loadPastFlag, reset: resetPastFlag } = usePastFlag();

  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);
  const [verifying, setVerifying] = useState(false);
  const [plateNumber, setPlateNumber] = useState('');
  const [idError, setIdError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [foundInSystem, setFoundInSystem] = useState(false);
  const [verifiedData, setVerifiedData] = useState<VerifyData | null>(null);
  const [form, setForm] = useState<VehicleForm>(emptyForm());

  useEffect(() => {
    if (!socket) return;
    const handleVehicleDetected = (data: any) => {
      if (data?.plate_number) setPlateNumber(String(data.plate_number).toUpperCase());
    };
    socket.on('vehicle-detected', handleVehicleDetected);
    return () => {
      socket.off('vehicle-detected', handleVehicleDetected);
    };
  }, [socket]);

  const openForm = (data: VerifyData | null, plate: string, found: boolean) => {
    setVerifiedData(data);
    setFoundInSystem(found);
    setForm(data ? formFromVerify(data, plate) : emptyForm(plate.toUpperCase()));
    setIdError(null);
    setEmailError(null);
    setShowForm(true);
  };

  const handleVerify = useCallback(async () => {
    const searchPlate = plateNumber.trim();
    if (!searchPlate) {
      showWarning('Please enter a plate number');
      return;
    }
    setVerifying(true);
    setVerifiedData(null);
    resetPastFlag();
    try {
      const response = await smartParkingService.verifyCar(searchPlate);
      const data = (response?.data || null) as VerifyData | null;
      if (data?.was_ever_flagged) void loadPastFlag(data.plate_number || searchPlate);
      if (!response?.success) showInfo('Vehicle not found in system');
      openForm(data, searchPlate, !!response?.success);
    } catch (error) {
      showError(failureOf(error).message || 'Failed to verify vehicle');
      openForm(null, searchPlate, false);
    } finally {
      setVerifying(false);
    }
  }, [plateNumber, showWarning, showError, showInfo, loadPastFlag, resetPastFlag]);

  const handleInputChange = (name: keyof VehicleForm, value: string) => {
    setForm(prev => ({ ...prev, [name]: value }));
    if (name === 'id_type' || name === 'id_number') {
      const newIdType = name === 'id_type' ? value : form.id_type;
      const newIdNumber = name === 'id_number' ? value : form.id_number;
      setIdError(validateIdNumber(newIdType, newIdNumber));
    }
    if (name === 'driver_email') setEmailError(validateEmail(value));
  };

  const closeForm = () => {
    setShowForm(false);
    setFoundInSystem(false);
    setVerifiedData(null);
    resetPastFlag();
  };

  const handleCheckIn = async () => {
    if (loading || submitting.current) return;
    if (!form.plate_number || !form.driver_name.trim() || !form.driver_telephone.trim()) {
      showWarning('Please fill in required fields');
      return;
    }
    const idValidationError = validateIdNumber(form.id_type, form.id_number);
    if (idValidationError) {
      showError(idValidationError);
      return;
    }
    const emailValidationError = validateEmail(form.driver_email);
    if (emailValidationError) {
      showError(emailValidationError);
      return;
    }

    submitting.current = true;
    setLoading(true);
    try {
      const response = await smartParkingService.checkIn({
        plate_number: form.plate_number,
        driver_name: form.driver_name.trim(),
        driver_telephone: form.driver_telephone.trim(),
        driver_email: form.driver_email.trim(),
        driver_gender: form.driver_gender,
        driver_type: form.driver_type,
        driver_identification: identificationPayload(form.id_type, form.id_number),
        badge_number: form.badge_number.trim() || null,
      });
      if (response?.success) {
        closeForm();
        setPlateNumber('');
        showSuccess(response.message || 'Vehicle checked in.');
      } else {
        showError(response?.message || 'Failed to check in vehicle');
      }
    } catch (error) {
      showError(failureOf(error).message || 'Failed to check in vehicle');
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: PRIMARY }}></div>
          <p style={{ color: TERTIARY }}>Loading...</p>
        </div>
      </div>
    );
  }

  const lockAll = foundInSystem && !!verifiedData?.is_currently_parked;
  const accent = foundInSystem ? PRIMARY : WARNING;
  const bannerBg = foundInSystem ? 'rgba(5,109,170,0.12)' : 'rgba(243,156,18,0.12)';
  const flagged = !!verifiedData?.was_ever_flagged || !!pastFlag;
  const inputClass = 'cok-auth-input pr-3 py-2 sm:py-3 text-sm disabled:opacity-60';

  return (
    <MainLayout>
      <div className="p-4 sm:p-6" style={{ backgroundColor: NEUTRAL_LIGHT }}>
        <div className="flex justify-center">
          <div className="w-full max-w-md">
            <div className="p-4 sm:p-6" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW }}>
              <div className="-mx-4 sm:-mx-6 -mt-4 sm:-mt-6 px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 mb-4" style={{ backgroundColor: NEUTRAL_LIGHT, borderBottom: `1px solid ${BORDER}` }}>
                <h2 className="text-base sm:text-lg font-bold mb-1" style={{ color: PRIMARY, fontFamily: fontHeading }}>Plate Number Verification</h2>
                <p className="text-xs" style={{ color: TERTIARY }}>Enter plate number</p>
              </div>

              <div className="mb-4">
                <label className="block mb-2 text-sm sm:text-base cok-req" style={labelStyle}>License Plate Number</label>
                <input
                  type="text"
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleVerify(); }}
                  placeholder=".........................."
                  className="cok-auth-input pr-3 py-2 sm:py-3 text-sm sm:text-base"
                />
              </div>

              {verifiedData ? (
                <div className="p-3 mb-4" style={{ backgroundColor: NEUTRAL_LIGHT }}>
                  <div className="font-semibold text-sm" style={{ color: NEUTRAL_DARK }}>{form.driver_name || 'Unknown'}</div>
                  <div className="text-xs" style={{ color: GRAY_DISABLED }}>{verifiedData.vehicle_category || '___'}</div>
                  <div className="font-medium text-xs mt-1" style={{ color: SUCCESS }}>ALLOWED</div>
                </div>
              ) : (
                <div className="p-3 mb-4" style={{ backgroundColor: NEUTRAL_LIGHT }}>
                  <div className="text-xs text-center" style={{ color: GRAY_DISABLED }}>Enter plate above number to verify</div>
                </div>
              )}

              <button
                type="button"
                onClick={() => void handleVerify()}
                disabled={verifying || !plateNumber.trim()}
                className="w-full py-2 sm:py-3 max-h-[50px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1 transition-colors text-sm sm:text-base"
                style={{ ...buttonFont, border: 'none', backgroundColor: PRIMARY, color: WHITE }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
              >
                {verifying ? (
                  <span className="flex items-center gap-2">
                    <SpiralLoader color="#FFFFFF" padded={false} size={18} />
                    <span>Verifying plate...</span>
                  </span>
                ) : (
                  <div className="flex items-center gap-2">
                    <BsShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>Verify PLATE NUMBER</span>
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showForm ? (
        <OverlayShell
          title={(
            <span className="flex items-center gap-2">
              <FiAlertCircle className="w-5 h-5 shrink-0" style={{ color: accent }} />
              {foundInSystem ? 'Vehicle Found' : 'Vehicle Not Found'}
            </span>
          )}
          subtitle={foundInSystem ? 'This vehicle is registered in the system' : 'This vehicle is not in the system yet'}
          onClose={closeForm}
          busy={loading}
          width="lg"
          headerExtra={(
            <div className="px-4 sm:px-6 py-2" style={{ backgroundColor: bannerBg }}>
              <p className="text-xs text-center" style={{ color: accent }}>
                {lockAll
                  ? 'This vehicle is already checked in. Details are shown for reference only.'
                  : foundInSystem
                    ? 'Vehicle found. Review the details below and confirm the check-in.'
                    : 'New vehicle. Enter the driver details below and check in: the driver is saved automatically.'}
              </p>
            </div>
          )}
          footer={(
            <button
              type="button"
              onClick={handleCheckIn}
              disabled={lockAll || loading || !form.driver_name.trim() || !form.driver_telephone.trim()}
              className="w-full px-4 py-2 sm:py-2.5 cok-btn-primary disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-sm flex items-center justify-center gap-2"
            >
              {lockAll ? 'Already Checked In' : loading ? (<><SpiralLoader color="#FFFFFF" padded={false} size={18} /><span>Checking in...</span></>) : 'Check In'}
            </button>
          )}
        >
          {flagged ? (
            <div className="mb-4">
              <PastFlagPanel pastFlag={pastFlag} loading={pastFlagLoading} />
            </div>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block mb-1 text-sm" style={labelStyle}>Plate Number</label>
              <input type="text" value={form.plate_number} disabled className={`${inputClass} uppercase`} />
            </div>

            <div>
              <label className="block mb-1 text-sm" style={labelStyle}>ID Type</label>
              <select value={form.id_type} onChange={(e) => handleInputChange('id_type', e.target.value)} disabled={lockAll} className={inputClass}>
                {ID_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-1 text-sm" style={labelStyle}>
                {form.id_type === 'National ID' ? 'National ID (16 digits)' : 'ID Number'}
              </label>
              <input
                type="text"
                value={form.id_number}
                onChange={(e) => handleInputChange('id_number', e.target.value)}
                disabled={lockAll}
                placeholder={form.id_type === 'National ID' ? 'Enter 16-digit national ID' : 'Enter ID number'}
                className={inputClass}
                style={{ borderColor: idError ? DANGER : '' }}
              />
              {idError && <p className="mt-1 text-xs" style={{ color: DANGER }}>{idError}</p>}
              {form.id_type === 'National ID' && form.id_number && !idError && (
                <p className="mt-1 text-xs" style={{ color: SUCCESS }}>National ID format valid</p>
              )}
            </div>

            <div>
              <label className="block mb-1 text-sm cok-req" style={labelStyle}>Full Names</label>
              <input type="text" value={form.driver_name} onChange={(e) => handleInputChange('driver_name', e.target.value)} disabled={lockAll} placeholder="Enter full names" className={inputClass} />
            </div>

            <div>
              <label className="block mb-1 text-sm cok-req" style={labelStyle}>Phone Number</label>
              <input type="tel" value={form.driver_telephone} onChange={(e) => handleInputChange('driver_telephone', e.target.value)} disabled={lockAll} placeholder="Enter phone number" className={inputClass} />
            </div>

            <div>
              <label className="block mb-1 text-sm" style={labelStyle}>Email Address</label>
              <input
                type="email"
                value={form.driver_email}
                onChange={(e) => handleInputChange('driver_email', e.target.value)}
                disabled={lockAll}
                placeholder="Enter email (optional)"
                className={inputClass}
                style={{ borderColor: emailError ? DANGER : '' }}
              />
              {emailError && <p className="mt-1 text-xs" style={{ color: DANGER }}>{emailError}</p>}
            </div>

            <div>
              <label className="block mb-1 text-sm" style={labelStyle}>Badge Number</label>
              <input type="text" value={form.badge_number} onChange={(e) => handleInputChange('badge_number', e.target.value)} disabled={lockAll} placeholder="Enter badge number (optional)" className={inputClass} />
            </div>

            <div>
              <label className="block mb-1 text-sm" style={labelStyle}>Gender</label>
              <div className="flex gap-2">
                {['Male', 'Female'].map((gender) => (
                  <button
                    key={gender}
                    type="button"
                    disabled={lockAll}
                    onClick={() => handleInputChange('driver_gender', gender)}
                    className="flex-1 py-1.5 sm:py-2 transition-colors text-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{ ...buttonFont, border: 'none', backgroundColor: form.driver_gender === gender ? PRIMARY : NEUTRAL_LIGHT, color: form.driver_gender === gender ? WHITE : NEUTRAL_DARK }}
                  >
                    {gender}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </OverlayShell>
      ) : null}
    </MainLayout>
  );
};

export default CheckInVehiclePage;
