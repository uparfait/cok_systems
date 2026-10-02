import React, { useState, useEffect } from 'react';
import MainLayout from '../../../core/components/Layout/MainLayout';
import { useToast } from '../../../core/contexts/ToastContext';
import { useSocket } from '../../../core/contexts/SocketContext';
import { serviceDeliveryService } from '../../../core/services/adminService';
import { failureOf } from '../../../core/components/visitor/visitorApi';
import { ID_TYPE_OPTIONS, findVisitorByIdNumber, identificationPayload, validateEmail, validateIdNumber } from '../../../core/components/visitor/checkinRules';
import { FiPhone, FiCreditCard, FiUser, FiMail, FiSearch } from 'react-icons/fi';

const PRIMARY = "#056daa";
const SUCCESS = "#4CAF50";
const DANGER = "#E74C3C";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
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
  color: NEUTRAL_DARK,
};

interface VisitorFormData {
  full_name: string;
  telephone: string;
  email: string;
  id_type: string;
  id_number: string;
  gender: string;
}

const EMPTY_FORM: VisitorFormData = {
  full_name: '',
  telephone: '',
  email: '',
  id_type: 'National ID',
  id_number: '',
  gender: 'Not specified',
};

const CheckInPersonPage: React.FC = () => {
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const { socket, isConnected } = useSocket();

  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [idError, setIdError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formData, setFormData] = useState<VisitorFormData>(EMPTY_FORM);

  useEffect(() => {
    if (!socket || !isConnected) return;
    const notify = (fallback: string) => (data: any) => {
      if (data?.show_notif !== false) return;
      const message = data.message || fallback;
      const type = data.type || 'info';
      if (type === 'success') showSuccess(message);
      else if (type === 'error') showError(message);
      else if (type === 'warning') showWarning(message);
      else showInfo(message);
    };
    const handleVisitorCheckin = notify('Visitor checked in');
    const handleVisitorCheckout = notify('Visitor checked out');
    const handleCarCheckout = notify('Vehicle checked out');
    socket.on('visitor_checkedin', handleVisitorCheckin);
    socket.on('visitor_checkedout', handleVisitorCheckout);
    socket.on('car_checkedout', handleCarCheckout);
    return () => {
      socket.off('visitor_checkedin', handleVisitorCheckin);
      socket.off('visitor_checkedout', handleVisitorCheckout);
      socket.off('car_checkedout', handleCarCheckout);
    };
  }, [socket, isConnected, showSuccess, showError, showWarning, showInfo]);

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setIdError(null);
    setEmailError(null);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'id_type' || name === 'id_number') {
      const newIdType = name === 'id_type' ? value : formData.id_type;
      const newIdNumber = name === 'id_number' ? value : formData.id_number;
      setIdError(validateIdNumber(newIdType, newIdNumber));
    }
    if (name === 'email') setEmailError(validateEmail(value));
  };

  const handleSearchVisitor = async () => {
    if (!formData.id_number.trim()) {
      showWarning('Please enter an ID number to search');
      return;
    }
    setSearchLoading(true);
    const visitor = await findVisitorByIdNumber(formData.id_type, formData.id_number);
    setSearchLoading(false);
    if (!visitor) {
      showInfo('No visitor found with this ID number. Fill in the form and check in: the visitor is saved automatically.');
      return;
    }
    setFormData({
      full_name: visitor.full_name || '',
      telephone: visitor.telephone || '',
      email: visitor.email || '',
      id_type: visitor.identification?.id_type || formData.id_type,
      id_number: visitor.identification?.number || formData.id_number,
      gender: visitor.gender || 'Not specified',
    });
    setIdError(null);
    setEmailError(null);
    showSuccess('Visitor found and form auto-filled');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!formData.full_name.trim() || !formData.telephone.trim()) {
      showError('Please fill in required fields');
      return;
    }
    const idValidationError = validateIdNumber(formData.id_type, formData.id_number);
    if (idValidationError) {
      showError(idValidationError);
      return;
    }
    const emailValidationError = validateEmail(formData.email);
    if (emailValidationError) {
      showError(emailValidationError);
      return;
    }

    setLoading(true);
    try {
      const response = await serviceDeliveryService.checkIn({
        full_name: formData.full_name.trim(),
        telephone: formData.telephone.trim(),
        email: formData.email.trim() || null,
        identification: identificationPayload(formData.id_type, formData.id_number),
        gender: formData.gender,
      });
      if (response?.success) {
        showSuccess(response.message || 'Visitor checked in');
        resetForm();
      } else {
        showError(response?.message || 'Failed to check in the visitor');
      }
    } catch (error) {
      const failure = failureOf(error);
      if (failure.code === 'ALREADY_IN_HOUSE') showWarning(failure.message);
      else showError(failure.message || 'Failed to check in the visitor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="p-4 sm:p-6" style={{ backgroundColor: NEUTRAL_LIGHT, minHeight: '100%' }}>
        <div className="max-w-2xl mx-auto">
          <div className="p-4 sm:p-6" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW, borderRadius: 0 }}>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block mb-1 text-sm sm:text-base cok-req" style={labelStyle}>
                  Full Name
                </label>
                <div className="relative">
                  <FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5" style={{ color: GRAY_DISABLED }} />
                  <input
                    type="text"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                    required
                    className="w-full cok-auth-input pr-3 py-2 sm:py-3 text-sm sm:text-base"
                    placeholder="Enter full name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-sm sm:text-base cok-req" style={labelStyle}>
                    Phone Number
                  </label>
                  <div className="relative">
                    <FiPhone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5" style={{ color: GRAY_DISABLED }} />
                    <input
                      type="tel"
                      name="telephone"
                      value={formData.telephone}
                      onChange={handleChange}
                      required
                      className="w-full cok-auth-input pr-3 py-2 sm:py-3 text-sm sm:text-base"
                      placeholder="Phone number"
                    />
                  </div>
                </div>

                <div>
                  <label className="block mb-1 text-sm sm:text-base" style={labelStyle}>
                    Email
                  </label>
                  <div className="relative">
                    <FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5" style={{ color: GRAY_DISABLED }} />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full cok-auth-input pr-3 py-2 sm:py-3 text-sm sm:text-base"
                      placeholder="Email address"
                    />
                  </div>
                  {emailError && (
                    <p className="mt-1 text-xs" style={{ color: DANGER, fontFamily: fontHeading }}>{emailError}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-sm sm:text-base" style={labelStyle}>
                    ID Type
                  </label>
                  <select
                    name="id_type"
                    value={formData.id_type}
                    onChange={handleChange}
                    className="w-full cok-auth-input pr-3 py-2 sm:py-3 text-sm sm:text-base"
                  >
                    {ID_TYPE_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block mb-1 text-sm sm:text-base" style={labelStyle}>
                    ID Number
                  </label>
                  <div className="relative">
                    <FiCreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5" style={{ color: GRAY_DISABLED }} />
                    <input
                      type="text"
                      name="id_number"
                      value={formData.id_number}
                      onChange={handleChange}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleSearchVisitor(); } }}
                      className="w-full cok-auth-input pr-10 pl-10 py-2 sm:py-3 text-sm sm:text-base"
                      placeholder={formData.id_type === 'National ID' ? 'Enter 16-digit national ID' : 'Enter ID number'}
                    />
                    <button
                      type="button"
                      onClick={handleSearchVisitor}
                      disabled={searchLoading}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded hover:bg-white cursor-pointer disabled:opacity-50"
                      title="Search visitor by ID"
                    >
                      {searchLoading ? (
                        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <FiSearch className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: PRIMARY }} />
                      )}
                    </button>
                  </div>
                  {idError && (
                    <p className="mt-1 text-xs" style={{ color: DANGER, fontFamily: fontHeading }}>{idError}</p>
                  )}
                  {formData.id_type === 'National ID' && formData.id_number && !idError && (
                    <p className="mt-1 text-xs" style={{ color: SUCCESS, fontFamily: fontHeading }}>National ID format valid</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-sm sm:text-base" style={labelStyle}>
                    Gender
                  </label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    className="w-full cok-auth-input pr-3 py-2 sm:py-3 text-sm sm:text-base"
                  >
                    <option value="Not specified">Not specified</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:flex-1 px-4 py-2 sm:py-3 cok-btn-primary disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Waiting...
                    </>
                  ) : (
                    'Check in'
                  )}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={resetForm}
                  className="w-full sm:flex-1 px-4 py-2 sm:py-3 cok-btn-outlined text-sm sm:text-base disabled:opacity-50"
                >
                  Reset
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default CheckInPersonPage;
