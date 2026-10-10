import React, { useState } from 'react';
import { useToast } from '../../contexts/ToastContext';
import VisitorForm, { serverErrorField, validateVisitorForm } from './VisitorForm';
import type { VisitorFormErrors } from './VisitorForm';
import VisitorActions from './VisitorActions';
import { failureOf, formatDateTime, visitorApi } from './visitorApi';
import type { VisitorDetails, VisitorInput } from './visitorTypes';
import { visitorToInput } from './visitorTypes';

interface VisitorInfoTabProps {
  details: VisitorDetails;
  onChanged: (next?: VisitorDetails) => void;
  setBusy: (busy: boolean) => void;
}

const Field: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex flex-col">
    <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</span>
    <span className="text-sm text-gray-900 break-words">{value || '-'}</span>
  </div>
);

const EditToggle: React.FC<{ on: boolean; disabled: boolean; onChange: (on: boolean) => void }> = ({ on, disabled, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    disabled={disabled}
    title={disabled ? 'Details can be changed only while the visitor is in house' : undefined}
    onClick={() => onChange(!on)}
    className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-700 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
  >
    <span className={`relative inline-block h-5 w-9 rounded-full transition-colors ${on ? 'bg-[#056daa]' : 'bg-gray-300'}`}>
      <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : ''}`} />
    </span>
    Edit details
  </button>
);

const VisitorInfoTab: React.FC<VisitorInfoTabProps> = ({ details, onChanged, setBusy }) => {
  const { showSuccess, showError } = useToast();
  const { visitor, current_visit: currentVisit, permissions } = details;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<VisitorInput>(() => visitorToInput(visitor));
  const [errors, setErrors] = useState<VisitorFormErrors>({});
  const [saving, setSaving] = useState(false);

  const toggleEdit = (on: boolean) => {
    if (saving) return;
    if (on) {
      setDraft(visitorToInput(visitor));
      setErrors({});
    }
    setEditing(on);
  };

  const save = async () => {
    const found = validateVisitorForm(draft);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    setBusy(true);
    try {
      const response = await visitorApi.update(visitor._id, draft);
      showSuccess(response?.message || 'Visitor details updated');
      setEditing(false);
      onChanged();
    } catch (error) {
      const failure = failureOf(error);
      const key = serverErrorField(failure.field);
      if (key) setErrors({ [key]: failure.message });
      showError(failure.message);
    } finally {
      setSaving(false);
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <EditToggle on={editing} disabled={!permissions.can_edit || saving} onChange={toggleEdit} />
      </div>

      {editing ? (
        <div className="flex flex-col gap-3">
          <VisitorForm value={draft} onChange={setDraft} errors={errors} disabled={saving} mode="edit" />
          <div className="flex justify-end">
            <button type="button" className="cok-btn-primary w-auto! px-6! rounded-md!" disabled={saving} onClick={save}>
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field label="Full name" value={visitor.full_name} />
          <Field label="ID type" value={visitor.identification?.id_type} />
          <Field label="ID number" value={visitor.identification?.number} />
          <Field label="Telephone" value={visitor.telephone} />
          <Field label="Email" value={visitor.email} />
          <Field label="Gender" value={visitor.gender} />
          <Field label="Number of visits" value={String(visitor.N_visits)} />
          <Field label="First registered" value={formatDateTime(visitor.createdAt)} />
          <Field label="Last update" value={formatDateTime(visitor.updatedAt)} />
        </div>
      )}

      {currentVisit && !editing ? <VisitorActions details={details} onChanged={onChanged} setBusy={setBusy} /> : null}
    </div>
  );
};

export default VisitorInfoTab;
