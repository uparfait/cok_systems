import React, { useState } from 'react';
import OverlayShell from '../../../../core/components/overlay/OverlayShell';
import VisitorForm, { serverErrorField, validateVisitorForm } from '../../../../core/components/visitor/VisitorForm';
import type { VisitorFormErrors } from '../../../../core/components/visitor/VisitorForm';
import { failureOf } from '../../../../core/components/visitor/visitorApi';
import type { VisitorInput } from '../../../../core/components/visitor/visitorTypes';
import { parkingService } from '../../../../core/services/adminService';
import { useToast } from '../../../../core/contexts/ToastContext';
import SpiralLoader from '@/systems/event-managment/components/SpiralLoader';
import type { PastFlagInfo, VerifyData } from './vehicleCheckin';
import { categoryText, prefillFromVerify, prefillSourceOf } from './vehicleCheckin';

interface CheckInVehicleOverlayProps {
  data: VerifyData;
  pastFlag: PastFlagInfo | null;
  onClose: () => void;
  onCheckedIn: () => void;
  onAlreadyParked: () => void;
}

const SOURCE_NOTE: Record<string, string> = {
  reservation: 'Driver details come from the visitor reservation. Check them with the driver and complete what is missing.',
  staff: 'Driver details come from the staff registry. Check them with the driver and complete what is missing.',
  none: 'Type the driver ID number or telephone first: a registered visitor is filled in automatically.',
};

const CheckInVehicleOverlay: React.FC<CheckInVehicleOverlayProps> = ({ data, pastFlag, onClose, onCheckedIn, onAlreadyParked }) => {
  const { showSuccess, showError } = useToast();
  const [value, setValue] = useState<VisitorInput>(() => prefillFromVerify(data));
  const [errors, setErrors] = useState<VisitorFormErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const source = prefillSourceOf(data);
  const last = data.last_driver;
  const flagged = data.was_ever_flagged || !!pastFlag;

  const submit = async () => {
    if (saving) return;
    const found = validateVisitorForm(value);
    setErrors(found);
    setMessage(null);
    if (Object.keys(found).length) return;
    setSaving(true);
    let outcome: 'done' | 'parked' | null = null;
    try {
      const response = await parkingService.checkIn({
        plate_number: data.plate_number,
        visitor_id: value.visitor_id || null,
        driver: {
          full_name: value.full_name,
          telephone: value.telephone,
          email: value.email,
          gender: value.gender,
          identification: value.identification,
        },
      });
      if (response?.success === false) {
        const text = response?.message || 'Failed to check in the vehicle';
        setMessage(text);
        showError(text);
        return;
      }
      showSuccess(response?.message || 'Vehicle checked in');
      outcome = 'done';
    } catch (error) {
      const failure = failureOf(error);
      showError(failure.message);
      if (failure.code === 'ALREADY_PARKED') {
        outcome = 'parked';
      } else {
        const key = serverErrorField(failure.field);
        if (key) setErrors({ [key]: failure.message });
        else setMessage(failure.message);
      }
    } finally {
      setSaving(false);
    }
    if (outcome === 'done') onCheckedIn();
    if (outcome === 'parked') onAlreadyParked();
  };

  return (
    <OverlayShell
      title={`Check in ${data.plate_number}`}
      subtitle={categoryText(data)}
      onClose={onClose}
      busy={saving}
      width="lg"
      footer={
        <button type="button" className="cok-btn-primary w-auto! px-8! flex items-center justify-center gap-2" disabled={saving} onClick={submit}>
          {saving ? (
            <>
              <SpiralLoader color="#FFFFFF" padded={false} size={16} />
              <span>Checking in...</span>
            </>
          ) : 'Check in'}
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        {flagged ? (
          <div className="border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            This vehicle was flagged before{pastFlag && pastFlag.count > 1 ? ` (${pastFlag.count} times)` : ''} for overstaying. Verify the driver before allowing entry.
          </div>
        ) : null}

        {last ? (
          <div className="border border-[#056daa]/30 bg-[#056daa]/5 px-3 py-2 text-xs text-gray-700">
            Last time this car came with <span className="font-semibold">{last.full_name || 'Unknown'}</span>.
            {value.visitor_id && String(value.visitor_id) === String(last._id) ? ' If someone else drives it today, use "Register a different person".' : ''}
          </div>
        ) : (
          <div className="border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">{SOURCE_NOTE[source] || SOURCE_NOTE.none}</div>
        )}

        {message ? <div className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{message}</div> : null}

        <VisitorForm value={value} onChange={setValue} errors={errors} disabled={saving} mode="register" title="Driver" />
      </div>
    </OverlayShell>
  );
};

export default CheckInVehicleOverlay;
