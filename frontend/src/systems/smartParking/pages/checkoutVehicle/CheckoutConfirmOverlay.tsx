import React, { useRef, useState } from 'react';
import { FiCheckCircle, FiLogOut } from 'react-icons/fi';
import OverlayShell from '../../../../core/components/overlay/OverlayShell';
import { smartParkingService } from '../../../../core/services/adminService';
import { failureOf } from '../../../../core/components/visitor/visitorApi';
import { useToast } from '../../../../core/contexts/ToastContext';
import DriverTypeBadge from './DriverTypeBadge';
import type { CheckoutViolation, ParkingRow } from './parkingRows';
import { formatParkingDate, idNumberOf, idTypeOf, minutesText } from './parkingRows';

interface CheckoutConfirmOverlayProps {
  record: ParkingRow | null;
  onClose: () => void;
  onCheckedOut: (record: ParkingRow) => void;
  zIndex?: number;
}

interface CheckoutResult {
  message: string;
  violation: CheckoutViolation;
}

const Detail: React.FC<{ label: string; wide?: boolean; children: React.ReactNode }> = ({ label, wide, children }) => (
  <div className={wide ? 'col-span-2' : ''}>
    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
    <div className="text-sm font-medium text-gray-900 break-words">{children}</div>
  </div>
);

const CheckoutConfirmBody: React.FC<CheckoutConfirmOverlayProps & { record: ParkingRow }> = ({ record, onClose, onCheckedOut, zIndex }) => {
  const { showSuccess, showWarning, showError } = useToast();
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const [result, setResult] = useState<CheckoutResult | null>(null);

  const confirm = async () => {
    if (busy || running.current) return;
    running.current = true;
    setBusy(true);
    try {
      const response = await smartParkingService.checkOutByPlate(record.plate_number);
      if (response?.success) {
        const message: string = response.message || 'Vehicle checked out.';
        const violation: CheckoutViolation | null = response.data?.violation_details || null;
        onCheckedOut(record);
        if (violation) {
          showWarning(message);
          setResult({ message, violation });
        } else {
          showSuccess(message);
          onClose();
        }
      } else {
        showError(response?.message || 'Failed to checkout vehicle');
      }
    } catch (error) {
      const failure = failureOf(error);
      if (failure.code === 'ALREADY_CHECKED_OUT') {
        showWarning(failure.message);
        onCheckedOut(record);
        onClose();
      } else {
        showError(failure.message || 'Failed to checkout vehicle');
      }
    } finally {
      running.current = false;
      setBusy(false);
    }
  };

  const title = result ? (
    'Vehicle checked out'
  ) : (
    <span className="inline-flex items-center gap-2">
      <FiLogOut className="w-4 h-4" style={{ color: '#E74C3C' }} />
      Confirm checkout
    </span>
  );

  return (
    <OverlayShell
      title={title}
      subtitle={record.plate_number}
      onClose={onClose}
      busy={busy}
      width="sm"
      zIndex={zIndex}
      footer={
        result ? null : (
          <button
            type="button"
            onClick={confirm}
            disabled={busy}
            className="cok-btn-primary w-auto! px-5! py-2! inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed!"
          >
            {busy ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <FiCheckCircle className="w-4 h-4" />
            )}
            {busy ? 'Checking out...' : 'Confirm checkout'}
          </button>
        )
      }
    >
      {result ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-800">{result.message}</p>
          <div className="border border-amber-300 bg-amber-50 p-3">
            <p className="text-sm font-semibold text-amber-900 mb-2">Overstay warning</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Detail label="Allowed time">{minutesText(result.violation.allowed_minutes)}</Detail>
              <Detail label="Time parked">{minutesText(result.violation.total_minutes)}</Detail>
              <Detail label="Overstayed by">
                <span className="text-red-700">{minutesText(result.violation.overstayed_minutes)}</span>
              </Detail>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-700">Check out this vehicle and close the visit of its driver?</p>
          <div className="grid grid-cols-2 gap-3 p-3" style={{ backgroundColor: '#F7F9FB' }}>
            <Detail label="Plate number">{record.plate_number || '-'}</Detail>
            <Detail label="Type">
              <DriverTypeBadge type={record.driver_type} />
            </Detail>
            <Detail label="Full name" wide>{record.driver_name || '-'}</Detail>
            <Detail label="Telephone">{record.driver_telephone || '-'}</Detail>
            <Detail label="Visits">{record.N_visits ?? 0}</Detail>
            <Detail label="ID type">{idTypeOf(record)}</Detail>
            <Detail label="ID number">{idNumberOf(record)}</Detail>
            <Detail label="Check-in">{formatParkingDate(record.check_in, true)}</Detail>
            <Detail label="Time parked">{record.current_duration || '-'}</Detail>
          </div>
        </div>
      )}
    </OverlayShell>
  );
};

const CheckoutConfirmOverlay: React.FC<CheckoutConfirmOverlayProps> = (props) =>
  props.record ? <CheckoutConfirmBody key={props.record._id || props.record.plate_number} {...props} record={props.record} /> : null;

export default CheckoutConfirmOverlay;
