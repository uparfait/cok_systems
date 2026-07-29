import React, { useState, useEffect, useRef } from 'react';
import { FiX, FiLoader, FiUpload, FiMail, FiPhone, FiUser, FiAward, FiCreditCard } from 'react-icons/fi';
import { useToast } from '../contexts/ToastContext';
import { serviceDeliveryService, parkingService } from '../services/adminService';
import LoadingSpinner from './LoadingSpinner';
import SpiralLoader from '@/systems/event-managment/components/SpiralLoader';

interface Visitor {
  _id?: string;
  full_name?: string;
  telephone?: string;
  email?: string;
  identification?: { id_type?: string; number?: string };
  gender?: string;
  badge_number?: string;
  vehicle_storage?: { has_vehicle?: boolean; vehicle_details?: { plate_number?: string } };
}

interface VisitorDetailsProps {
  isOpen: boolean;
  onClose: () => void;
  visitor?: Visitor | null;
  onSaved?: (visitor: any) => void;
  onAssign?: () => void;
  onDelegate?: () => void;
}

const validateIdNumber = (idType: string, idNumber: string): string | null => {
  if (!idNumber || idNumber.trim() === '') {
    return null;
  }

  const trimmedId = idNumber.trim();

  if (idType === 'National ID') {
    if (trimmedId.length !== 16) {
      return 'National ID must be 16_digits';
    }
    if (!/^\d+$/.test(trimmedId)) {
      return 'National ID must contain only numbers';
    }
  } else if (idType === 'Passport') {
    if (trimmedId.length < 6) {
      return 'Passport number must be at least 6 characters';
    }
    if (!/^[A-Z0-9]+$/i.test(trimmedId)) {
      return 'Passport number must contain only letters and numbers';
    }
  } else if (idType === 'Driving Licence') {
    if (trimmedId.length < 8) {
      return 'Driving Licence must be at least 8 characters';
    }
    if (!/^[A-Z0-9]+$/i.test(trimmedId)) {
      return 'Driving Licence must contain only letters and numbers';
    }
  }

  return null;
};

const validateEmail = (email: string): string | null => {
  if (!email || email.trim() === '') {
    return null;
  }

  const trimmedEmail = email.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    return 'Please enter a valid email address';
  }

  return null;
};

const VisitorDetails: React.FC<VisitorDetailsProps> = ({ isOpen, onClose, visitor, onSaved, onAssign, onDelegate }) => {
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [idError, setIdError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [showUploadTooltip, setShowUploadTooltip] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    telephone: '',
    email: '',
    identification_number: '',
    id_type: 'National ID',
    gender: '',
    badge_number: '',
    has_vehicle: false,
    plate_number: '',
  });

  type FormState = typeof form;
  const initialFormRef = useRef<FormState>(form);
  const isEdit = Boolean(visitor?._id);

  useEffect(() => {
    if (!isOpen) return;
    if (visitor) {
      setFetching(true);
      serviceDeliveryService.getById(visitor._id!)
        .then(res => {
          if (res.success && res.data) {
            const d = res.data;
            const loadedForm = {
              full_name: d.full_name || '',
              telephone: d.telephone || '',
              email: d.email || '',
              identification_number: d.identification?.number || '',
              id_type: d.identification?.id_type || 'National ID',
              gender: d.gender || '',
              badge_number: d.badge_number || '',
              has_vehicle: d.vehicle_storage?.has_vehicle || false,
              plate_number: d.vehicle_storage?.vehicle_details?.plate_number || '',
            };
            setForm(loadedForm);
            initialFormRef.current = loadedForm;
            setIsEditing(false);
          }
        })
        .catch(() => showError('Failed to load visitor details'))
        .finally(() => setFetching(false));
    } else {
      const emptyForm = {
        full_name: '',
        telephone: '',
        email: '',
        identification_number: '',
        id_type: 'National ID',
        gender: '',
        badge_number: '',
        has_vehicle: false,
        plate_number: '',
      };
      setForm(emptyForm);
      initialFormRef.current = emptyForm;
      setIsEditing(true);
    }
  }, [isOpen, visitor, showError]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    const val = type === 'checkbox' ? checked : value;
    setForm(prev => ({ ...prev, [name]: val }));

    if (name === 'id_type' || name === 'identification_number') {
      const newIdType = name === 'id_type' ? value : form.id_type;
      const newIdNumber = name === 'identification_number' ? value : form.identification_number;
      const error = validateIdNumber(newIdType, newIdNumber);
      setIdError(error);
    }

    if (name === 'email') {
      const error = validateEmail(value);
      setEmailError(error);
    }
  };

  const hasFieldChanged = (key: keyof FormState) => {
    if (key === 'identification_number' || key === 'id_type') {
      return form.identification_number !== initialFormRef.current.identification_number || form.id_type !== initialFormRef.current.id_type;
    }
    return form[key] !== initialFormRef.current[key];
  };

  const validate = (): boolean => {
    if (!form.full_name.trim() || !form.telephone.trim()) {
      showError('Please fill in required fields');
      return false;
    }

    const idValidationError = validateIdNumber(form.id_type, form.identification_number);
    if (idValidationError) {
      showError(idValidationError);
      return false;
    }

    const emailValidationError = validateEmail(form.email);
    if (emailValidationError) {
      showError(emailValidationError);
      return false;
    }

    return true;
  };

  const buildUpdatePayload = () => {
    const payload: any = {};
    if (hasFieldChanged('full_name')) payload.full_name = form.full_name.trim();
    if (hasFieldChanged('telephone')) payload.telephone = form.telephone.trim();
    if (hasFieldChanged('email')) payload.email = form.email.trim();
    if (hasFieldChanged('gender')) payload.gender = form.gender.trim();
    if (hasFieldChanged('badge_number')) payload.badge_number = form.badge_number.trim();
    if (hasFieldChanged('identification_number') || hasFieldChanged('id_type')) {
      const inIdNum = initialFormRef.current.identification_number;
      const inIdType = initialFormRef.current.id_type;
      const currIdNum = form.identification_number;
      const currIdType = form.id_type;
      if (currIdNum || currIdType) {
        payload.identification = { id_type: currIdType, number: currIdNum };
      } else if (inIdNum || inIdType) {
        payload.identification = { id_type: '', number: '' };
      }
    }
    return payload;
  };

  const buildCheckInPayload = () => {
    const payload: any = {};
    if (form.full_name.trim()) payload.full_name = form.full_name.trim();
    if (form.telephone.trim()) payload.telephone = form.telephone.trim();
    if (form.email.trim()) payload.email = form.email.trim();
    if (form.identification_number.trim() || form.id_type.trim()) {
      payload.identification = { id_type: form.id_type.trim(), number: form.identification_number.trim() };
    }
    payload.gender = form.gender || 'Not specified';
    if (form.badge_number.trim()) payload.badge_number = form.badge_number.trim();
    return payload;
  };

  const buildParkingPayload = () => {
    return {
      plate_number: form.plate_number.trim(),
      driver_name: form.full_name.trim(),
      driver_telephone: form.telephone.trim(),
      driver_email: form.email.trim() || null,
      driver_gender: form.gender.trim() || null,
      driver_identification: form.identification_number.trim() ? { id_type: form.id_type.trim(), number: form.identification_number.trim() } : {},
      driver_type: 'visitor',
      badge_number: form.badge_number.trim() || null,
    };
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      let res;
      if (isEdit && visitor._id) {
        const payload = buildUpdatePayload();
        if (Object.keys(payload).length === 0) {
          showError('No changes detected');
          setLoading(false);
          return;
        }
        res = await serviceDeliveryService.update(visitor._id, payload);
      } else if (form.has_vehicle && form.plate_number.trim()) {
        res = await parkingService.checkIn(buildParkingPayload());
      } else {
        res = await serviceDeliveryService.checkIn(buildCheckInPayload());
      }

      if (res?.success || res?.status) {
        const msg = res?.message || (isEdit ? 'Visitor updated' : 'Visitor checked in');
        showSuccess(msg);
        onSaved?.(res?.data);
        onClose();
      } else {
        const msg = res?.message || res?.error || 'Operation failed';
        showError(msg);
      }
    } catch (err: any) {
      const msg = err?.message || err?.error || 'Request failed';
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignToDepartment = () => {
    onAssign?.();
  };

  const handleDelegateRequest = () => {
    onDelegate?.();
  };

  const renderVehicleSection = () => {
    if (isEdit) {
      const hasVehicle = initialFormRef.current.has_vehicle;
      const plate = initialFormRef.current.plate_number;
      return (
        <div className="mt-2">
          <label className="cok-auth-label">Vehicle</label>
          <div className="cok-auth-input" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="text-xs font-semibold uppercase px-2 py-1" style={{ backgroundColor: hasVehicle ? 'rgba(76,175,80,0.12)' : 'rgba(158,158,158,0.12)', color: hasVehicle ? '#388E3C' : '#666', borderRadius: 0 }}>
              {hasVehicle ? 'YES' : 'NO'}
            </span>
            <span className="text-sm" style={{ color: '#555555' }}>
              {hasVehicle ? (plate || 'Unknown plate') : 'No vehicle'}
            </span>
          </div>
        </div>
      );
    }

    return (
      <div className="mt-4">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            name="has_vehicle"
            checked={form.has_vehicle}
            onChange={handleChange}
            className="h-4 w-4"
            style={{ accentColor: '#056daa' }}
          />
          <span className="text-sm font-semibold uppercase" style={{ fontFamily: "var(--cok-font-heading)", color: '#333' }}>Has Vehicle</span>
        </label>
        {form.has_vehicle && (
          <div className="mt-2 relative">
            <label className="cok-auth-label">Plate Number</label>
            <div className="relative">
              <FiCreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5" style={{ color: '#9CA3AF' }} />
              <input
                name="plate_number"
                value={form.plate_number}
                onChange={handleChange}
                className="cok-auth-input pr-3 py-3"
                style={{ paddingLeft: '2.5rem' }}
                placeholder="Enter plate number"
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  const inputDisabled = isEdit && !isEditing;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center cok-logout-overlay">
      <div className="w-[100%] max-w-4xl max-h-[90vh] overflow-y-auto bg-white shadow-2xl flex flex-col">
        {/* Sticky header */}
        <div className="sticky top-0 z-20 cok-bg-primary px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between" style={{ borderRadius: 0 }}>
          <div className="flex items-center gap-3">
            <h2 className="text-white font-bold text-lg sm:text-xl uppercase tracking-wide" style={{ fontFamily: "var(--cok-font-heading)", letterSpacing: '1px' }}>
              Visitor Details
            </h2>
          
          </div>

          <div className="flex items-center gap-3">
            {/* Toggle Edit Switch */}
            {isEdit  && (
              <>
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className="relative cursor-pointer inline-flex h-6 w-11 items-center transition-colors"
                style={{ borderRadius: 0 }}
                aria-pressed={isEditing}
              >
                <span
                  className="inline-block z-5 h-5 w-5 cok-primary-bg transition-transform duration-200"
                  style={{
                    transform: isEditing ? 'translateX(20px)' : 'translateX(2px)',
                    borderRadius: 990,
                  }}
                />
                <span
                  className="absolute inset-0 transition-colors duration-200"
                  style={{
                    borderRadius: 200,
                    backgroundColor: '#FFFFFF',
                  }}
                />
              </button>
              <div className="text-white text-xs font-semibold uppercase mr-1" style={{ fontFamily: "var(--cok-font-heading)", minWidth: '54px', textAlign: 'center' }}>
              {isEditing ? 'EDIT ON' : 'EDIT OFF'}
            </div>
            </>
            )}
            

            <button onClick={onClose} className="cok-btn-outlined-reverse" style={{ padding: '0.4rem 0.8rem' }}>
              <FiX className="w-4 h-4" />
            </button>
          </div>
        </div>

        {fetching ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <LoadingSpinner message="Loading visitor..." />
          </div>
        ) : (
          <>
            <div className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="cok-auth-label">Full Name</label>
                  <div className="relative">
                    <FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5" style={{ color: '#9CA3AF' }} />
                    <input name="full_name" value={form.full_name} onChange={handleChange} disabled={inputDisabled} className="cok-auth-input pr-3 py-3" style={{ paddingLeft: '2.5rem' }} placeholder="Enter full name" />
                  </div>
                </div>

                <div>
                  <label className="cok-auth-label">Telephone</label>
                  <div className="relative">
                    <FiPhone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5" style={{ color: '#9CA3AF' }} />
                    <input name="telephone" value={form.telephone} onChange={handleChange} disabled={inputDisabled} className="cok-auth-input pr-3 py-3" style={{ paddingLeft: '2.5rem' }} placeholder="Phone number" />
                  </div>
                </div>

                <div>
                  <label className="cok-auth-label">Email</label>
                  <div className="relative">
                    <FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5" style={{ color: '#9CA3AF' }} />
                    <input name="email" type="email" value={form.email} onChange={handleChange} disabled={inputDisabled} className="cok-auth-input pr-3 py-3" style={{ paddingLeft: '2.5rem' }} placeholder="Email address" />
                  </div>
                  {emailError && (
                    <p className="mt-1 text-xs" style={{ color: '#E74C3C' }}>{emailError}</p>
                  )}
                </div>

                <div>
                  <label className="cok-auth-label">Badge Number</label>
                  <div className="relative">
                    <FiAward className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5" style={{ color: '#9CA3AF' }} />
                    <input name="badge_number" value={form.badge_number} onChange={handleChange} disabled={inputDisabled} className="cok-auth-input pr-3 py-3" style={{ paddingLeft: '2.5rem' }} placeholder="Badge number" />
                  </div>
                </div>

                <div>
                  <label className="cok-auth-label">ID Type</label>
                  <select name="id_type" value={form.id_type} onChange={handleChange} disabled={inputDisabled} className="cok-auth-input pr-3 py-3">
                    <option value="National ID">National ID</option>
                    <option value="Passport">Passport</option>
                    <option value="Driving Licence">Driving Licence</option>
                  </select>
                </div>

                <div>
                  <label className="cok-auth-label">ID Number</label>
                  <div className="relative">
                    <FiCreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5" style={{ color: '#9CA3AF' }} />
                    <input name="identification_number" value={form.identification_number} onChange={handleChange} disabled={inputDisabled} className="cok-auth-input pr-3 py-3" style={{ paddingLeft: '2.5rem' }} placeholder={form.id_type === 'National ID' ? 'Enter 16_digit national ID' : 'Enter ID number'} />
                  </div>
                  {idError && (
                    <p className="mt-1 text-xs" style={{ color: '#E74C3C' }}>{idError}</p>
                  )}
                </div>

                <div>
                  <label className="cok-auth-label">Gender</label>
                  <select name="gender" value={form.gender} onChange={handleChange} disabled={inputDisabled} className="cok-auth-input pr-3 py-3">
                    <option value="">Not specified</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>

              {renderVehicleSection()}
            </div>

            <div className="p-4 sm:p-6 pt-2 flex flex-col gap-3 border-t" style={{ borderColor: '#E0E0E0' }}>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                {isEdit && isEditing && (
                  <button type="button" onClick={handleSave} disabled={loading} className="cok-btn-primary flex max-h-[50px] flex-row items-center justify-center gap-2" style={{ width: 'auto', padding: '0.7rem 1.2rem' }}>
                    {loading && <SpiralLoader color='#FFFFFF'/>}
                    Save
                  </button>
                )}
                {!isEdit && (
                  <button type="button" onClick={handleSave} disabled={loading} className="cok-btn-primary max-h-[50px] flex items-center flex-row justify-center gap-2 w-full sm:w-auto" style={{ padding: '0.7rem 1.2rem' }}>
                    {loading && <SpiralLoader color='#FFFFFF'/>}
                    Save
                  </button>
                )}
                {isEdit && !isEditing && (
                  <div className="flex flex-col gap-3 sm:flex-row sm:w-full sm:justify-end">
                    <button type="button" onClick={handleAssignToDepartment} className="cok-btn-outlined w-full sm:w-1/2" style={{ padding: '0.7rem 1.2rem' }}>
                      Assign to Department
                    </button>
                    <button type="button" onClick={handleDelegateRequest} className="cok-btn-outlined w-full sm:w-1/2" style={{ padding: '0.7rem 1.2rem' }}>
                      Delegate Request
                    </button>
                  </div>
                )}
                {isEdit && isEditing && (
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button type="button" onClick={handleAssignToDepartment} className="cok-btn-outlined" style={{ width: 'auto', padding: '0.7rem 1.2rem' }}>
                      Assign to Department
                    </button>
                    <button type="button" onClick={handleDelegateRequest} className="cok-btn-outlined" style={{ width: 'auto', padding: '0.7rem 1.2rem' }}>
                      Delegate Request
                    </button>
                  </div>
                )}
              </div>
              <button type="button" onClick={onClose} className="w-full cok-btn-outlined" style={{ padding: '0.9rem 1.2rem' }}>
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default VisitorDetails;
