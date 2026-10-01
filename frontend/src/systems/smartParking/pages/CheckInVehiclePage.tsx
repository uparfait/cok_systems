import React, { useCallback, useRef, useState } from 'react';
import { BsShieldCheck } from 'react-icons/bs';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useToast } from '../../../core/contexts/ToastContext';
import { parkingService } from '../../../core/services/adminService';
import { failureOf } from '../../../core/components/visitor/visitorApi';
import MainLayout from '../../../core/components/Layout/MainLayout';
import SpiralLoader from '@/systems/event-managment/components/SpiralLoader';
import CheckInVehicleOverlay from './checkinVehicle/CheckInVehicleOverlay';
import VerifyResultCard from './checkinVehicle/VerifyResultCard';
import usePastFlag from './checkinVehicle/usePastFlag';
import type { VerifyData, VerifyResult } from './checkinVehicle/vehicleCheckin';

const PRIMARY = '#056daa';
const NEUTRAL_LIGHT = '#F7F9FB';
const BORDER = '#E0E0E0';
const TERTIARY = '#555555';
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = '0 8px 40px 0 rgba(0,0,0,0.08)';

const labelStyle: React.CSSProperties = {
  fontFamily: fontHeading,
  fontSize: '13px',
  fontWeight: 600,
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  color: TERTIARY,
};

const CheckInVehiclePage: React.FC = () => {
  const { isLoading: authLoading } = useAuth();
  const { showWarning, showError, showInfo } = useToast();
  const { pastFlag, loading: pastFlagLoading, load: loadPastFlag, reset: resetPastFlag } = usePastFlag();
  const [plateNumber, setPlateNumber] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const verifyingRef = useRef(false);

  const clearResult = useCallback(() => {
    setResult(null);
    setVerifyError(null);
    setCheckInOpen(false);
    resetPastFlag();
  }, [resetPastFlag]);

  const verify = useCallback(async (plate?: string) => {
    const searchPlate = (plate ?? plateNumber).trim();
    if (!searchPlate) {
      showWarning('Please enter a plate number');
      return;
    }
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    setVerifying(true);
    clearResult();
    try {
      const response = await parkingService.verifyCar(searchPlate);
      const data = response?.data as VerifyData | undefined;
      if (!data) {
        const text = response?.message || 'Failed to verify vehicle';
        setVerifyError(text);
        showError(text);
        return;
      }
      setResult({ found: !!response.success, data });
      if (data.was_ever_flagged) void loadPastFlag(data.plate_number || searchPlate);
      if (!response.success) showInfo('Vehicle not found in system');
    } catch (error) {
      const failure = failureOf(error);
      setVerifyError(failure.message);
      showError(failure.message);
    } finally {
      verifyingRef.current = false;
      setVerifying(false);
    }
  }, [plateNumber, clearResult, loadPastFlag, showWarning, showError, showInfo]);

  const onPlateChange = (value: string) => {
    setPlateNumber(value.toUpperCase());
    if (result || verifyError) clearResult();
  };

  const onCheckedIn = () => {
    setPlateNumber('');
    clearResult();
  };

  const onAlreadyParked = () => {
    const plate = result?.data.plate_number;
    setCheckInOpen(false);
    if (plate) void verify(plate);
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <SpiralLoader color={PRIMARY} padded={false} size={40} />
          <p className="mt-4" style={{ color: TERTIARY }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <MainLayout>
      <div className="p-4 sm:p-6" style={{ backgroundColor: NEUTRAL_LIGHT }}>
        <div className="mx-auto w-full max-w-xl flex flex-col gap-4">
          <div className="p-4 sm:p-6 bg-white" style={{ boxShadow: CARD_SHADOW }}>
            <div className="-mx-4 sm:-mx-6 -mt-4 sm:-mt-6 px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 mb-4" style={{ backgroundColor: NEUTRAL_LIGHT, borderBottom: `1px solid ${BORDER}` }}>
              <h2 className="text-base sm:text-lg font-bold mb-1 cok-primary-color" style={{ fontFamily: fontHeading }}>Plate Number Verification</h2>
              <p className="text-xs" style={{ color: TERTIARY }}>Enter the plate number, verify it, then check the vehicle in</p>
            </div>

            <div className="mb-4">
              <label htmlFor="checkin-plate" className="block mb-2 text-sm sm:text-base cok-req" style={labelStyle}>License Plate Number</label>
              <input
                id="checkin-plate"
                type="text"
                value={plateNumber}
                readOnly={verifying}
                onChange={(e) => onPlateChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void verify(); }}
                placeholder="RAD123B"
                className="cok-auth-input pr-3 py-2 sm:py-3 text-sm sm:text-base uppercase"
              />
            </div>

            {!result && !verifyError ? (
              <div className="p-3 mb-4" style={{ backgroundColor: NEUTRAL_LIGHT }}>
                <div className="text-xs text-center text-gray-500">Enter the plate number above to verify it</div>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => void verify()}
              disabled={verifying || !plateNumber.trim()}
              className="cok-btn-primary max-h-12.5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {verifying ? (
                <>
                  <SpiralLoader color="#FFFFFF" padded={false} size={18} />
                  <span>Verifying plate...</span>
                </>
              ) : (
                <>
                  <BsShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>Verify plate number</span>
                </>
              )}
            </button>
          </div>

          {verifyError ? (
            <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{verifyError}</div>
          ) : null}

          {result ? (
            <VerifyResultCard
              result={result}
              pastFlag={pastFlag}
              pastFlagLoading={pastFlagLoading}
              onCheckIn={() => setCheckInOpen(true)}
            />
          ) : null}
        </div>
      </div>

      {checkInOpen && result ? (
        <CheckInVehicleOverlay
          data={result.data}
          pastFlag={pastFlag}
          onClose={() => setCheckInOpen(false)}
          onCheckedIn={onCheckedIn}
          onAlreadyParked={onAlreadyParked}
        />
      ) : null}
    </MainLayout>
  );
};

export default CheckInVehiclePage;
