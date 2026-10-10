import React, { useState } from 'react';
import { useToast } from '../../contexts/ToastContext';
import VisitorForm, { serverErrorField, validateVisitorForm } from './VisitorForm';
import type { VisitorFormErrors } from './VisitorForm';
import VisitorActions from './VisitorActions';
import VisitorVisitSummary from './VisitorVisitSummary';
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

const VisitorInfoTab: React.FC<VisitorInfoTabProps> = ({ details, onChanged, setBusy }) => {
  const { showSuccess, showError } = useToast();
  const { visitor, current_visit: currentVisit, last_visit: lastVisit, permissions } = details;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<VisitorInput>(() => visitorToInput(visitor));
  const [errors, setErrors] = useState<VisitorFormErrors>({});
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setDraft(visitorToInput(visitor));
    setErrors({});
    setEditing(true);
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
      {editing ? (
        <div className="flex flex-col gap-3">
          <VisitorForm value={draft} onChange={setDraft} errors={errors} disabled={saving} mode="edit" title="Edit visitor details" />
          <div className="flex justify-end">
            <button type="button" className="cok-btn-primary w-auto! px-6!" disabled={saving} onClick={save}>
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      ) : (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-[11px] font-semibold px-2 py-0.5 border ${visitor.Is_In_House ? 'border-green-300 bg-green-50 text-green-800' : 'border-gray-300 bg-gray-50 text-gray-600'}`}>
                {visitor.Is_In_House ? 'In house' : 'Not in house'}
              </span>
              <span className="text-[11px] font-semibold px-2 py-0.5 border border-[#056daa]/30 bg-[#056daa]/5 text-[#056daa]">
                {visitor.N_visits} {visitor.N_visits === 1 ? 'visit' : 'visits'}
              </span>
            </div>
            {permissions.can_edit ? (
              <button type="button" className="cok-btn-outlined" onClick={startEdit}>Edit details</button>
            ) : (
              <span className="text-xs text-gray-500">Details can be changed only while the visitor is in house.</span>
            )}
          </div>
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
        </section>
      )}

      {currentVisit ? <VisitorVisitSummary visit={currentVisit} title="Current visit" /> : null}
      {!currentVisit && lastVisit ? <VisitorVisitSummary visit={lastVisit} title="Last visit" /> : null}
      {!currentVisit && !lastVisit ? <p className="text-xs text-gray-500">This person has no recorded visit yet.</p> : null}

      {currentVisit && !editing ? <VisitorActions details={details} onChanged={onChanged} setBusy={setBusy} /> : null}
    </div>
  );
};

export default VisitorInfoTab;
