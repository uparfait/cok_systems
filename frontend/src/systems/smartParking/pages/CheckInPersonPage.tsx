

import React, { useState, useEffect } from 'react';
import MainLayout from '../../../core/components/Layout/MainLayout';
import { useToast } from '../../../core/contexts/ToastContext';
import { useSocket } from '../../../core/contexts/SocketContext';
import { serviceDeliveryService } from '../../../core/services/adminService';
import { FiPlus, FiPhone, FiCreditCard, FiUser, FiMail, FiSearch } from 'react-icons/fi';

// City of Kigali (CoK) institutional design constants
const PRIMARY = "#056daa";
const PRIMARY_HOVER = "#045d94";
const SUCCESS = "#4CAF50";
const DANGER = "#E74C3C";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const TERTIARY = "#CDB896";
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



const buttonBaseStyle: React.CSSProperties = {
  fontFamily: fontHeading,
  fontSize: '13px',
  fontWeight: 600,
  letterSpacing: '1px',
  textTransform: 'uppercase',
  borderRadius: 0,
};

const handleInputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
  e.currentTarget.style.borderColor = PRIMARY;
  e.currentTarget.style.boxShadow = '0px 4px 8px rgba(5,109,170,0.25)';
};

const handleInputBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
  e.currentTarget.style.borderColor = 'transparent';
  e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)';
};

interface VisitorFormData {
  full_name: string;
  telephone: string;
  email: string;
  id_type: string;
  id_number: string;
  gender: string;
  badge_number: string;
}

// Validation helper function
const validateIdNumber = (idType: string, idNumber: string): string | null => {
  if (!idNumber || idNumber.trim() === '') {
    return null; // Optional field - no validation needed
  }
  
  const trimmedId = idNumber.trim();
  
  if (idType === 'National ID') {
    // National ID must be 16 characters
    if (trimmedId.length !== 16) {
      return 'National ID must be 16_digits';
    }
    // National ID should only contain numbers (Egyptian national ID format)
    if (!/^\d+$/.test(trimmedId)) {
      return 'National ID must contain only numbers';
    }
  } else if (idType === 'Passport') {
    // Passport typically 6-9 characters with letters and numbers
    if (trimmedId.length < 6) {
      return 'Passport number must be at least 6 characters';
    }
    if (!/^[A-Z0-9]+$/i.test(trimmedId)) {
      return 'Passport number must contain only letters and numbers';
    }
  } else if (idType === 'Driving Licence') {
    // Driving licence typically 8-15 characters
    if (trimmedId.length < 8) {
      return 'Driving Licence must be at least 8 characters';
    }
    if (!/^[A-Z0-9]+$/i.test(trimmedId)) {
      return 'Driving Licence must contain only letters and numbers';
    }
  }
  
  return null; // Valid
}

// Email validation helper
const validateEmail = (email: string): string | null => {
  if (!email || email.trim() === '') {
    return null; // Optional field - no validation needed
  }
  
  const trimmedEmail = email.trim();
  // General email regex - accepts any valid email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    return 'Please enter a valid email address';
  }
  
  return null; // Valid
}

const CheckInPersonPage: React.FC = () => {
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const { socket, isConnected } = useSocket();
  
  const [loading, setLoading] = useState(false);
  const [idError, setIdError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  
  // Listen for visitor check-in events from other sessions
  useEffect(() => {
    if (!socket || !isConnected) return;
    
    const handleVisitorCheckin = (data: any) => {
      console.log('🔔 [CheckInPerson] visitor_checkedin event received:', data);
      
      // Check if notification should be shown
      if (data.show_notif === false) {
        // Show notification based on type
        const message = data.message || 'Visitor checked in';
        const type = data.type || 'info';
        
        if (type === 'success') {
          showSuccess(message);
        } else if (type === 'error') {
          showError(message);
        } else if (type === 'warning') {
          showWarning(message);
        } else {
          showInfo(message);
        }
      }
      
      // Always trigger refetch to update all related data (tables, cards, counts, etc.)
      // This will cause any component listening to refetchTrigger to refetch data
      setRefetchTrigger(prev => prev + 1);
      
      console.log('✅ [CheckInPerson] Refetch triggered for all related components');
    };
    
    socket.on('visitor_checkedin', handleVisitorCheckin);
    
    // Listen for visitor check-out events
    const handleVisitorCheckout = (data: any) => {
      console.log('🔔 [CheckInPerson] visitor_checkedout event received:', data);
      
      // Check if notification should be shown
      if (data.show_notif === false) {
        // Show notification based on type
        const message = data.message || 'Visitor checked out';
        const type = data.type || 'info';
        
        if (type === 'success') {
          showSuccess(message);
        } else if (type === 'error') {
          showError(message);
        } else if (type === 'warning') {
          showWarning(message);
        } else {
          showInfo(message);
        }
      }
      
      // Always trigger refetch to update all related data (tables, cards, counts, graphs, etc.)
      setRefetchTrigger(prev => prev + 1);
      
      console.log('✅ [CheckInPerson] Refetch triggered after visitor checkout');
    };
    
    socket.on('visitor_checkedout', handleVisitorCheckout);
    
    // Listen for car check-out events
    const handleCarCheckout = (data: any) => {
      console.log('🔔 [CheckInPerson] car_checkedout event received:', data);
      
      // Check if notification should be shown
      if (data.show_notif === false) {
        // Show notification based on type
        const message = data.message || 'Vehicle checked out';
        const type = data.type || 'info';
        
        if (type === 'success') {
          showSuccess(message);
        } else if (type === 'error') {
          showError(message);
        } else if (type === 'warning') {
          showWarning(message);
        } else {
          showInfo(message);
        }
      }
      
      // Always trigger refetch to update all related data (tables, cards, counts, graphs, etc.)
      setRefetchTrigger(prev => prev + 1);
      
      console.log('✅ [CheckInPerson] Refetch triggered after car checkout');
    };
    
    socket.on('car_checkedout', handleCarCheckout);
    
    return () => {
      socket.off('visitor_checkedin', handleVisitorCheckin);
      socket.off('visitor_checkedout', handleVisitorCheckout);
      socket.off('car_checkedout', handleCarCheckout);
    };
  }, [socket, isConnected, showSuccess, showError, showWarning, showInfo]);
  
  const [formData, setFormData] = useState<VisitorFormData>({
    full_name: '',
    telephone: '',
    email: '',
    id_type: 'National ID',
    id_number: '',
    gender: 'Not specified',
    badge_number: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Validate ID number when id_type or id_number changes
    if (name === 'id_type' || name === 'id_number') {
      const newIdType = name === 'id_type' ? value : formData.id_type;
      const newIdNumber = name === 'id_number' ? value : formData.id_number;
      const error = validateIdNumber(newIdType, newIdNumber);
      setIdError(error);
    }
    
    // Validate email when email changes
    if (name === 'email') {
      const error = validateEmail(value);
      setEmailError(error);
    }
  };

  const [searchLoading, setSearchLoading] = useState(false);

  const handleSearchVisitor = async () => {
    if (!formData.id_number || formData.id_number.trim() === '') {
      showWarning('Please enter an ID number to search');
      return;
    }

    setSearchLoading(true);
    try {
      const response = await serviceDeliveryService.getVisitorByIdentification(formData.id_type, formData.id_number.trim());
      
      if (response.success && response.data) {
        const visitor = response.data;
        setFormData({
          full_name: visitor.full_name || '',
          telephone: visitor.telephone || '',
          email: visitor.email || '',
          id_type: visitor.identification?.id_type || formData.id_type,
          id_number: visitor.identification?.number || '',
          gender: visitor.gender || 'Not specified',
          badge_number: visitor.badge_number || '',
        });
        showSuccess('Visitor found and form auto-filled');
      } else {
        showWarning('No visitor found with this ID type and ID number. Please fill the form manually.');
      }
    } catch (error: any) {
      console.error('Error searching visitor:', error);
      showError(error.message || 'Failed to search for visitor');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.full_name || !formData.telephone) {
      showError('Please fill in required fields');
      return;
    }
    
    // Validate ID number
    const idValidationError = validateIdNumber(formData.id_type, formData.id_number);
    if (idValidationError) {
      showError(idValidationError);
      return;
    }
    
    // Validate email if provided
    const emailValidationError = validateEmail(formData.email);
    if (emailValidationError) {
      showError(emailValidationError);
      return;
    }

    setLoading(true);
    try {
      // Format data to match backend API
      const visitorData = {
        full_name: formData.full_name,
        telephone: formData.telephone,
        email: formData.email || null,
        identification: formData.id_number ? { 
          id_type: formData.id_type, 
          number: formData.id_number 
        } : {},
        gender: formData.gender || 'Not specified',
        badge_number: formData.badge_number || null
      };

      console.log('🔍 [CheckInPerson] ID Number being sent:', {
        id_type: formData.id_type,
        id_number: formData.id_number,
        identification: visitorData.identification
      });

      const response = await serviceDeliveryService.checkIn(visitorData);
      
      if (response.success) {
        showSuccess('Visitor registered successfully!');
        // Reset form
        setFormData({
          full_name: '',
          telephone: '',
          email: '',
          id_type: 'National ID',
          id_number: '',
          gender: 'Not specified',
          badge_number: '',
        });
      } else {
        showError(response.message || 'Failed to register visitor');
      }
    } catch (error: any) {
      console.error('Error registering visitor:', error);
      showError(error.message || 'Failed to register visitor');
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
        {/* Full Name */}
        <div>
          <label className="block mb-1 text-sm sm:text-base" style={labelStyle}>
            Full Name <span style={{ color: DANGER }}>*</span>
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

        {/* Phone and Email - Column on mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block mb-1 text-sm sm:text-base" style={labelStyle}>
              Phone Number <span style={{ color: DANGER }}>*</span>
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

        {/* ID Type and ID Number - Column on mobile */}
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
              <option value="National ID">National ID</option>
              <option value="Passport">Passport</option>
              <option value="Driving Licence">Driving Licence</option>
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
              <p className="mt-1 text-xs" style={{ color: SUCCESS, fontFamily: fontHeading }}>✓ National ID format valid</p>
            )}
          </div>
        </div>

        {/* Gender and Badge Number - Column on mobile */}
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

          <div>
            <label className="block mb-1 text-sm sm:text-base" style={labelStyle}>
              Badge Number
            </label>
            <input
              type="text"
              name="badge_number"
              value={formData.badge_number}
              onChange={handleChange}
              className="w-full cok-auth-input pr-3 py-2 sm:py-3 text-sm sm:text-base"
              placeholder="Badge number"
            />
          </div>
        </div>

        {/* Buttons - Stack on mobile */}
        <div className="flex flex-col  gap-3 pt-4">

          <button
            type="submit"
            disabled={loading}
            className="w-full sm:flex-1 px-4 py-2 sm:py-3 cok-btn-primary disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Registering...
              </>
            ) : (
              <>
                <FiPlus className="w-4 h-4" />
                Register Visitor
              </>
            )}
          </button>
                    <button
            type="button"
            onClick={() => {
              setFormData({
                full_name: '',
                telephone: '',
                email: '',
                id_type: 'National ID',
                id_number: '',
                gender: 'Not specified',
                badge_number: '',
              });
              setIdError(null);
              setEmailError(null);
            }}
            className="w-full sm:flex-1 px-4 py-2 sm:py-3 cok-btn-outlined text-sm sm:text-base"
          >
            Reset
          </button>
        </div>
      </form>
    </div>
  </div>
</div>    </MainLayout>
  );
};

export default CheckInPersonPage;
