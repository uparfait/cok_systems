// CheckInPersonPage - Add Visitor Modal for Smart Parking
// Page that shows the Add Visitor modal directly

import React, { useState, useEffect } from 'react';
import MainLayout from '../../../core/components/Layout/MainLayout';
import { useToast } from '../../../core/contexts/ToastContext';
import { smartParkingService, serviceDeliveryService } from '../../../core/services/adminService';
import { FiPlus, FiX, FiSave, FiPhone, FiCreditCard, FiUser } from 'react-icons/fi';

interface VisitorFormData {
  visitor_name: string;
  id_number: string;
  phone: string;
  badge: string;
  plate_number: string;
  driver_type: string;
  gender: string;
}

const CheckInPersonPage: React.FC = () => {
  const { showSuccess, showError } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(true); // Open modal by default
  
  const [formData, setFormData] = useState<VisitorFormData>({
    visitor_name: '',
    id_number: '',
    phone: '',
    badge: '',
    plate_number: '',
    driver_type: 'Regular',
    gender: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.visitor_name || !formData.phone) {
      showError('Please fill in required fields');
      return;
    }

    setLoading(true);
    try {
      // First, register visitor in service delivery
      const visitorData = {
        name: formData.visitor_name,
        phone: formData.phone,
        id_number: formData.id_number,
        badge_number: formData.badge,
        visitor_type: formData.driver_type,
        gender: formData.gender,
        plate_number: formData.plate_number || undefined,
        has_vehicle: !!formData.plate_number
      };

      const response = await serviceDeliveryService.checkInVisitor(visitorData);
      
      if (response.success) {
        showSuccess('Visitor registered successfully!');
        // Reset form
        setFormData({
          visitor_name: '',
          id_number: '',
          phone: '',
          badge: '',
          plate_number: '',
          driver_type: 'Regular',
          gender: '',
        });
        setShowAddModal(false);
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

  const handleClose = () => {
    setShowAddModal(false);
  };

  return (
    <MainLayout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <FiUser className="w-8 h-8 text-blue-600" />
            Person Check-in
          </h1>
          <p className="text-gray-600 mt-1">
            Register a visitor without a vehicle
          </p>
        </div>

        {/* Add Visitor Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Add Visitor</h2>
                <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors">
                  <FiX className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Visitor Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      name="visitor_name"
                      value={formData.visitor_name}
                      onChange={handleChange}
                      required
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter visitor name"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <FiPhone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        required
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Phone number"
                      />
                    </div>
                  </div>

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
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
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
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="National ID"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Badge Number
                    </label>
                    <input
                      type="text"
                      name="badge"
                      value={formData.badge}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Badge number"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Visitor Type
                    </label>
                    <select
                      name="driver_type"
                      value={formData.driver_type}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="Regular">Regular</option>
                      <option value="Visitor">Visitor</option>
                      <option value="Contractor">Contractor</option>
                      <option value="Delivery">Delivery</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Vehicle Plate (Optional)
                    </label>
                    <input
                      type="text"
                      name="plate_number"
                      value={formData.plate_number}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase"
                      placeholder="RAB 123A"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-100 font-medium text-sm transition-colors"
                  >
                    Cancel
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
        )}
      </div>
    </MainLayout>
  );
};

export default CheckInPersonPage;
