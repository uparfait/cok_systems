import React, { useRef, useState } from 'react';
import { FiMail, FiPhone, FiUser, FiCreditCard, FiSearch, FiAward } from 'react-icons/fi';
import OverlayShell from '../../../../core/components/overlay/OverlayShell';
import { failureOf } from '../../../../core/components/visitor/visitorApi';
import { ID_TYPE_OPTIONS, findVisitorByIdNumber, identificationPayload, validateEmail, validateIdNumber } from '../../../../core/components/visitor/checkinRules';
import { serviceDeliveryService } from '../../../../core/services/adminService';
import { useToast } from '../../../../core/contexts/ToastContext';
import SpiralLoader from '@/systems/event-managment/components/SpiralLoader';

interface RegisterVisitorOverlayProps {
  onClose: () => void;
  onRegistered: (visitorId: string | null) => void;
}

interface NewVisitorForm {
  full_name: string;
  telephone: string;
  email: string;
  id_type: string;
  identification_number: string;
  gender: string;
  badge_number: string;
  has_vehicle: boolean;
  plate_number: string;
}

const EMPTY_FORM: NewVisitorForm = {
  full_name: '',
  telephone: '',
  email: '',
  id_type: 'National ID',
  identification_number: '',
  gender: '',
  badge_number: '',
  has_vehicle: false,
  plate_number: '',
};

const ICON_STYLE: React.CSSProperties = { color: '#9CA3AF' };
const ICON_INPUT_STYLE: React.CSSProperties = { paddingLeft: '2.5rem' };
const ERROR_STYLE: React.CSSProperties = { color: '#E74C3C' };

const RegisterVisitorOverlay: React.FC<RegisterVisitorOverlayProps> = ({ onClose, onRegistered }) => {
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const [form, setForm] = useState<NewVisitorForm>(EMPTY_FORM);
  const [idError, setIdError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);
  const [searching, setSearching] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setForm(prev => ({ ...prev, [name]: val }));
    if (name === 'id_type' || name === 'identification_number') {
      const newIdType = name === 'id_type' ? value : form.id_type;
      const newIdNumber = name === 'identification_number' ? value : form.identification_number;
      setIdError(validateIdNumber(newIdType, newIdNumber));
    }
    if (name === 'email') setEmailError(validateEmail(value));
  };

  const handleSearch = async () => {
    if (!form.identification_number.trim()) {
      showWarning('Please enter an ID number to search');
      return;
    }
    setSearching(true);
    const visitor = await findVisitorByIdNumber(form.id_type, form.identification_number);
    setSearching(false);
    if (!visitor) {
      showInfo('No visitor found with this ID number. Fill in the form and save: the visitor is saved automatically.');
      return;
    }
    setForm(prev => ({
      ...prev,
      full_name: visitor.full_name || '',
      telephone: visitor.telephone || '',
      email: visitor.email || '',
      id_type: visitor.identification?.id_type || prev.id_type,
      identification_number: visitor.identification?.number || prev.identification_number,
      gender: visitor.gender || '',
    }));
    setIdError(null);
    setEmailError(null);
    showSuccess('Visitor found and form auto-filled');
  };

  const handleSave = async () => {
    if (loading || submitting.current) return;
    if (!form.full_name.trim() || !form.telephone.trim()) {
      showError('Please fill in required fields');
      return;
    }
    const idValidationError = validateIdNumber(form.id_type, form.identification_number);
    if (idValidationError) {
      showError(idValidationError);
      return;
    }
    const emailValidationError = validateEmail(form.email);
    if (emailValidationError) {
      showError(emailValidationError);
      return;
    }
    const plate = form.plate_number.trim();
    if (form.has_vehicle && !plate) {
      showError('Please enter the plate number');
      return;
    }

    submitting.current = true;
    setLoading(true);
    try {
      const response = await serviceDeliveryService.checkIn({
        full_name: form.full_name.trim(),
        telephone: form.telephone.trim(),
        email: form.email.trim() || null,
        identification: identificationPayload(form.id_type, form.identification_number),
        gender: form.gender || 'Not specified',
        badge_number: form.badge_number.trim() || null,
        has_vehicle: form.has_vehicle && !!plate,
        plate_number: form.has_vehicle ? plate : undefined,
      });
      if (response?.success) {
        showSuccess(response.message || 'Visitor checked in');
        const data = (response.data || {}) as { visitor_id?: string };
        onRegistered(data.visitor_id ? String(data.visitor_id) : null);
      } else {
        showError(response?.message || 'Operation failed');
      }
    } catch (error) {
      const failure = failureOf(error);
      if (failure.code === 'ALREADY_IN_HOUSE') showWarning(failure.message);
      else showError(failure.message || 'Request failed');
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  return (
    <OverlayShell
      title="New Visitor"
      onClose={onClose}
      busy={loading}
      width="xl"
      footer={(
        <button
          type="button"
          onClick={handleSave}
          disabled={loading}
          className="cok-btn-primary max-h-[50px] flex items-center flex-row justify-center gap-2 w-full sm:w-auto"
          style={{ padding: '0.7rem 1.2rem' }}
        >
          {loading && <SpiralLoader color="#FFFFFF" />}
          Save
        </button>
      )}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="cok-auth-label cok-req">Full Name</label>
            <div className="relative">
              <FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5" style={ICON_STYLE} />
              <input name="full_name" value={form.full_name} onChange={handleChange} disabled={loading} className="cok-auth-input pr-3 py-3" style={ICON_INPUT_STYLE} placeholder="Enter full name" />
            </div>
          </div>

          <div>
            <label className="cok-auth-label cok-req">Telephone</label>
            <div className="relative">
              <FiPhone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5" style={ICON_STYLE} />
              <input name="telephone" value={form.telephone} onChange={handleChange} disabled={loading} className="cok-auth-input pr-3 py-3" style={ICON_INPUT_STYLE} placeholder="Phone number" />
            </div>
          </div>

          <div>
            <label className="cok-auth-label">Email</label>
            <div className="relative">
              <FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5" style={ICON_STYLE} />
              <input name="email" type="email" value={form.email} onChange={handleChange} disabled={loading} className="cok-auth-input pr-3 py-3" style={ICON_INPUT_STYLE} placeholder="Email address" />
            </div>
            {emailError && <p className="mt-1 text-xs" style={ERROR_STYLE}>{emailError}</p>}
          </div>

          <div>
            <label className="cok-auth-label">Badge Number</label>
            <div className="relative">
              <FiAward className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5" style={ICON_STYLE} />
              <input name="badge_number" value={form.badge_number} onChange={handleChange} disabled={loading} className="cok-auth-input pr-3 py-3" style={ICON_INPUT_STYLE} placeholder="Badge number (optional)" />
            </div>
          </div>

          <div>
            <label className="cok-auth-label">ID Type</label>
            <select name="id_type" value={form.id_type} onChange={handleChange} disabled={loading} className="cok-auth-input pr-3 py-3">
              {ID_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="cok-auth-label">ID Number</label>
            <div className="relative">
              <FiCreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5" style={ICON_STYLE} />
              <input
                name="identification_number"
                value={form.identification_number}
                onChange={handleChange}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleSearch(); } }}
                disabled={loading}
                className="cok-auth-input pr-10 py-3"
                style={ICON_INPUT_STYLE}
                placeholder={form.id_type === 'National ID' ? 'Enter 16-digit national ID' : 'Enter ID number'}
              />
              <button
                type="button"
                onClick={handleSearch}
                disabled={searching || loading}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded hover:bg-white cursor-pointer disabled:opacity-50"
                title="Search visitor by ID"
              >
                {searching ? (
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <FiSearch className="w-5 h-5" style={{ color: '#056daa' }} />
                )}
              </button>
            </div>
            {idError && <p className="mt-1 text-xs" style={ERROR_STYLE}>{idError}</p>}
          </div>

          <div>
            <label className="cok-auth-label">Gender</label>
            <select name="gender" value={form.gender} onChange={handleChange} disabled={loading} className="cok-auth-input pr-3 py-3">
              <option value="">Not specified</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              name="has_vehicle"
              checked={form.has_vehicle}
              onChange={handleChange}
              disabled={loading}
              className="h-4 w-4"
              style={{ accentColor: '#056daa' }}
            />
            <span className="text-sm font-semibold uppercase" style={{ fontFamily: 'var(--cok-font-heading)', color: '#333' }}>Has Vehicle</span>
          </label>
          {form.has_vehicle && (
            <div className="mt-2 relative">
              <label className="cok-auth-label cok-req">Plate Number</label>
              <div className="relative">
                <FiCreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5" style={ICON_STYLE} />
                <input
                  name="plate_number"
                  value={form.plate_number}
                  onChange={(e) => setForm(prev => ({ ...prev, plate_number: e.target.value.toUpperCase() }))}
                  disabled={loading}
                  className="cok-auth-input pr-3 py-3"
                  style={ICON_INPUT_STYLE}
                  placeholder="Enter plate number"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </OverlayShell>
  );
};

export default RegisterVisitorOverlay;
