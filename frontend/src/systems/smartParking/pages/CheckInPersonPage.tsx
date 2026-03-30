// CheckInPersonPage - Register Visitor without vehicle for Smart Parking
// Page that shows the visitor registration form directly on page

import React, { useState, useEffect } from 'react';
import MainLayout from '../../../core/components/Layout/MainLayout';
import { useToast } from '../../../core/contexts/ToastContext';
import { useSocket } from '../../../core/contexts/SocketContext';
import { serviceDeliveryService } from '../../../core/services/adminService';
import { FiPlus, FiPhone, FiCreditCard, FiUser, FiMail } from 'react-icons/fi';

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
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                    required
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter full name"
                  />
                </div>
              </div>

              {/* Phone and Email */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <FiPhone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="tel"
                      name="telephone"
                      value={formData.telephone}
                      onChange={handleChange}
                      required
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Phone number"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <div className="relative">
                    <FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${emailError ? 'border-red-500' : 'border-gray-300'}`}
                      placeholder="Email address"
                    />
                  </div>
                  {emailError && (
                    <p className="mt-1 text-xs text-red-500">{emailError}</p>
                  )}
                </div>
              </div>

              {/* ID Type and ID Number */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ID Type
                  </label>
                  <select
                    name="id_type"
                    value={formData.id_type}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="National ID">National ID</option>
                    <option value="Passport">Passport</option>
                    <option value="Driving Licence">Driving Licence</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ID Number
                  </label>
                  <div className="relative">
                    <FiCreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      name="id_number"
                      value={formData.id_number}
                      onChange={handleChange}
                      className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${idError ? 'border-red-500' : 'border-gray-300'}`}
                      placeholder={formData.id_type === 'National ID' ? 'Enter 16_digit national ID' : 'Enter ID number'}
                    />
                  </div>
                  {idError && (
                    <p className="mt-1 text-xs text-red-500">{idError}</p>
                  )}
                  {formData.id_type === 'National ID' && formData.id_number && !idError && (
                    <p className="mt-1 text-xs text-green-600">✓ National ID format valid</p>
                  )}
                </div>
              </div>

              {/* Gender and Badge Number */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Gender
                  </label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="Not specified">Not specified</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Badge Number
                  </label>
                  <input
                    type="text"
                    name="badge_number"
                    value={formData.badge_number}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Badge number"
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
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
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-100 font-medium text-sm transition-colors"
                >
                  Reset
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium text-sm flex items-center justify-center gap-2"
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
              </div>
            </form>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default CheckInPersonPage;
