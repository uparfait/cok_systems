import React, { useEffect, useRef, useState } from 'react';
import { useVisitorLookup } from './useVisitorLookup';
import type { UniqueField, Visitor, VisitorInput } from './visitorTypes';
import { GENDERS, ID_TYPES, emptyVisitorInput, visitorToInput } from './visitorTypes';
import { validateEmail, validateIdNumber } from './checkinRules';

export type VisitorFormErrors = Partial<Record<'id_type' | 'id_number' | 'full_name' | 'telephone' | 'email' | 'gender' | 'identification', string>>;

interface VisitorFormProps {
  value: VisitorInput;
  onChange: (next: VisitorInput) => void;
  errors?: VisitorFormErrors;
  disabled?: boolean;
  mode?: 'register' | 'edit';
  title?: string;
}

const FIELD_LABEL: Record<UniqueField, string> = {
  identification: 'identification number',
  telephone: 'telephone',
  email: 'email',
};

const INPUT = 'w-full border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#056daa] disabled:bg-gray-100';
const LABEL = 'block text-[11px] font-semibold uppercase tracking-wide text-gray-600 mb-1';

export const validateVisitorForm = (input: VisitorInput): VisitorFormErrors => {
  const errors: VisitorFormErrors = {};
  if (!input.full_name.trim()) errors.full_name = 'Full name is required';
  const digits = input.telephone.replace(/\D/g, '');
  if (!input.telephone.trim()) errors.telephone = 'Telephone is required';
  else if (digits.length < 7 || digits.length > 15) errors.telephone = 'Telephone number is not valid';
  const idError = validateIdNumber(input.identification.id_type || 'National ID', input.identification.number);
  if (idError) errors.id_number = idError;
  const emailError = validateEmail(input.email);
  if (emailError) errors.email = emailError;
  return errors;
};

export const serverErrorField = (field?: string): keyof VisitorFormErrors | null => {
  if (field === 'identification') return 'id_number';
  if (field === 'id_type' || field === 'id_number' || field === 'full_name' || field === 'telephone' || field === 'email' || field === 'gender') return field;
  return null;
};

const VisitorForm: React.FC<VisitorFormProps> = ({ value, onChange, errors = {}, disabled = false, mode = 'register', title }) => {
  const { result, loading } = useVisitorLookup(value, !disabled);
  const filledFor = useRef<string | null>(null);
  const [loaded, setLoaded] = useState<Visitor | null>(null);

  const set = (patch: Partial<VisitorInput>) => onChange({ ...value, ...patch });
  const setId = (patch: Partial<VisitorInput['identification']>) => onChange({ ...value, identification: { ...value.identification, ...patch } });

  const found: Visitor | null = !value.visitor_id && !result.conflict && result.visitor && result.matches.some((m) => m.field === 'identification')
    ? result.visitor
    : null;

  useEffect(() => {
    if (mode !== 'register' || !found || filledFor.current === found._id) return;
    filledFor.current = found._id;
    setLoaded(found);
    onChange(visitorToInput(found));
  }, [found, mode]);

  const others = result.matches.filter((m) => !value.visitor_id || String(m.visitor._id) !== String(value.visitor_id));
  const warnings = value.visitor_id || result.conflict || !found ? others : [];

  const useVisitor = (visitor: Visitor) => {
    filledFor.current = visitor._id;
    setLoaded(visitor);
    onChange(visitorToInput(visitor));
  };

  const startOver = () => {
    filledFor.current = null;
    setLoaded(null);
    onChange(emptyVisitorInput());
  };

  const fieldError = (key: keyof VisitorFormErrors) => (errors[key] ? <p className="text-xs text-red-600 mt-1">{errors[key]}</p> : null);

  return (
    <div className="flex flex-col gap-3">
      {title ? <h3 className="text-sm font-semibold text-gray-800">{title}</h3> : null}

      {mode === 'register' && value.visitor_id ? (
        <div className="border border-[#056daa]/30 bg-[#056daa]/5 px-3 py-2 text-xs text-gray-700 flex flex-wrap items-center justify-between gap-2">
          <span>Registered visitor. Changes you make here update this visitor.</span>
          <button type="button" className="cok-btn-outlined px-2! py-1!" disabled={disabled} onClick={startOver}>Register a different person</button>
        </div>
      ) : null}

      {warnings.map((m) => (
        <div key={`${m.field}-${m.visitor._id}`} className="border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 flex flex-wrap items-center justify-between gap-2">
          <span>Someone with this {FIELD_LABEL[m.field]} is already registered ({m.visitor.full_name}).</span>
          {mode === 'register' ? (
            <button type="button" className="cok-btn-outlined px-2! py-1!" disabled={disabled} onClick={() => useVisitor(m.visitor)}>Use this visitor</button>
          ) : null}
        </div>
      ))}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={LABEL}>ID type</label>
          <select className={INPUT} disabled={disabled} value={value.identification.id_type} onChange={(e) => setId({ id_type: e.target.value })}>
            <option value="">Choose ID type</option>
            {ID_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {fieldError('id_type')}
        </div>
        <div>
          <label className={LABEL}>ID number</label>
          <input className={INPUT} disabled={disabled} value={value.identification.number} onChange={(e) => setId({ number: e.target.value })} placeholder="ID number" />
          {fieldError('id_number')}
        </div>
        <div className="sm:col-span-2">
          <label className={`${LABEL} cok-req`}>Full name</label>
          <input className={INPUT} disabled={disabled} value={value.full_name} onChange={(e) => set({ full_name: e.target.value })} placeholder="Full name" />
          {fieldError('full_name')}
        </div>
        <div>
          <label className={`${LABEL} cok-req`}>Telephone</label>
          <input className={INPUT} disabled={disabled} value={value.telephone} onChange={(e) => set({ telephone: e.target.value })} placeholder="07XXXXXXXX" inputMode="tel" />
          {fieldError('telephone')}
        </div>
        <div>
          <label className={LABEL}>Email</label>
          <input className={INPUT} disabled={disabled} value={value.email} onChange={(e) => set({ email: e.target.value })} placeholder="name@example.com" inputMode="email" />
          {fieldError('email')}
        </div>
        <div>
          <label className={LABEL}>Gender</label>
          <select className={INPUT} disabled={disabled} value={value.gender} onChange={(e) => set({ gender: e.target.value })}>
            <option value="">Not specified</option>
            {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          {fieldError('gender')}
        </div>
        <div className="flex items-end text-xs text-gray-500 min-h-9.5">
          {loading ? 'Looking for a registered visitor...' : null}
          {!loading && mode === 'register' && value.visitor_id && loaded && loaded._id === value.visitor_id ? `Visits so far: ${loaded.N_visits}` : null}
        </div>
      </div>
    </div>
  );
};

export default VisitorForm;
