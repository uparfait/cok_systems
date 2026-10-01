import React, { useState } from 'react';
import OverlayShell from '../../../../core/components/overlay/OverlayShell';
import VisitorForm, { serverErrorField, validateVisitorForm } from '../../../../core/components/visitor/VisitorForm';
import type { VisitorFormErrors } from '../../../../core/components/visitor/VisitorForm';
import { failureOf, visitorApi } from '../../../../core/components/visitor/visitorApi';
import type { VisitorInput } from '../../../../core/components/visitor/visitorTypes';
import { emptyVisitorInput } from '../../../../core/components/visitor/visitorTypes';
import { useToast } from '../../../../core/contexts/ToastContext';

interface RegisterVisitorOverlayProps {
  onClose: () => void;
  onRegistered: (visitorId: string | null) => void;
}

const RegisterVisitorOverlay: React.FC<RegisterVisitorOverlayProps> = ({ onClose, onRegistered }) => {
  const { showSuccess, showError } = useToast();
  const [value, setValue] = useState<VisitorInput>(emptyVisitorInput);
  const [errors, setErrors] = useState<VisitorFormErrors & { plate_number?: string }>({});
  const [hasVehicle, setHasVehicle] = useState(false);
  const [plate, setPlate] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const found: VisitorFormErrors & { plate_number?: string } = validateVisitorForm(value);
    if (hasVehicle && plate.replace(/[^a-zA-Z0-9]/g, '').length < 3) found.plate_number = 'Enter the plate number';
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      const response = await visitorApi.checkIn({ ...value, has_vehicle: hasVehicle, plate_number: hasVehicle ? plate : undefined });
      showSuccess(response?.message || 'Visitor checked in');
      const data = (response?.data || {}) as { visitor_id?: string };
      onRegistered(data.visitor_id ? String(data.visitor_id) : null);
    } catch (error) {
      const failure = failureOf(error);
      if (failure.field === 'plate_number') setErrors({ plate_number: failure.message });
      else {
        const key = serverErrorField(failure.field);
        if (key) setErrors({ [key]: failure.message });
      }
      showError(failure.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <OverlayShell
      title="Register visitor"
      subtitle="Type the ID number or telephone first: a registered visitor is filled in automatically."
      onClose={onClose}
      busy={saving}
      width="lg"
      footer={
        <button type="button" className="cok-btn-primary w-auto! px-8!" disabled={saving} onClick={submit}>
          {saving ? 'Checking in...' : 'Check in'}
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        <VisitorForm value={value} onChange={setValue} errors={errors} disabled={saving} mode="register" />
        <div className="border-t border-gray-100 pt-3 flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
            <input type="checkbox" checked={hasVehicle} disabled={saving} onChange={(e) => setHasVehicle(e.target.checked)} />
            The visitor came with a vehicle
          </label>
          {hasVehicle ? (
            <div className="sm:w-1/2">
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-600 mb-1 cok-req">Plate number</label>
              <input
                className="w-full border border-gray-300 bg-white px-3 py-2 text-sm uppercase"
                value={plate}
                disabled={saving}
                onChange={(e) => setPlate(e.target.value.toUpperCase())}
                placeholder="RAD123B"
              />
              {errors.plate_number ? <p className="text-xs text-red-600 mt-1">{errors.plate_number}</p> : null}
            </div>
          ) : null}
        </div>
      </div>
    </OverlayShell>
  );
};

export default RegisterVisitorOverlay;
