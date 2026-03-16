// RegisterVisitorPage - Smart Parking Visitor Activity
// Page for viewing and managing visitor activity

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useToast } from '../../../core/contexts/ToastContext';
import { smartParkingService, serviceDeliveryService } from '../../../core/services/adminService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import { 
  FiSearch, FiPlus, FiUser, FiArrowRight, FiArrowLeft,
  FiLogIn, FiLogOut, FiX, FiSave, FiPhone, FiCreditCard,
  FiClock, FiCalendar, FiActivity, FiAlertTriangle, FiTruck
} from 'react-icons/fi';

interface ParkingRecord {
  _id?: string;
  id?: number;
  plate_number: string;
  driver_identification: {
    id_type?: string;
    number?: string;
  } | string;
  driver_name: string;
  driver_telephone: string;
  status: string;
  driver_type: string;
  driver_gender: string;
  slot_number: string;
  badge_number?: string;
  check_in: string;
  check_out: string | null;
  duration: string;
  is_flagged: boolean;
  checked_in_by: string;
}

interface Stats {
  totalVisitors: number;
  todayVisitors: number;
  totalCheckIns: number;
  todayCheckIns: number;
  totalCheckOuts: number;
  todayCheckOuts: number;
}

interface VisitorFormData {
  visitor_name: string;
  id_number: string;
  phone: string;
  badge: string;
  plate_number: string;
  driver_type: string;
  gender: string;
}

const RegisterVisitorPage: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { showSuccess, showError, showWarning } = useToast();
  const navigate = useNavigate();
  
  const [visitors, setVisitors] = useState<ParkingRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [fetching, setFetching] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [tableType, setTableType] = useState<'with_vehicle' | 'without_vehicle'>('with_vehicle');
  const [stats, setStats] = useState<Stats>({
    totalVisitors: 0,
    todayVisitors: 0,
    totalCheckIns: 0,
    todayCheckIns: 0,
    totalCheckOuts: 0,
    todayCheckOuts: 0
  });

  const [formData, setFormData] = useState<VisitorFormData>({
    visitor_name: '',
    id_number: '',
    phone: '',
    badge: '',
    plate_number: '',
    driver_type: 'Regular',
    gender: '',
  });

  const fetchData = async () => {
    try {
      setFetching(true);
      
      // Fetch parking records
      const parkingResponse = await smartParkingService.getAll();
      
      // Fetch service delivery visitors (all visitors including without vehicles)
      const serviceDeliveryResponse = await serviceDeliveryService.getAll();
      
      let allRecords: ParkingRecord[] = [];
      
      // Add parking records
      if (parkingResponse.success && parkingResponse.data) {
        allRecords = [...(parkingResponse.data || [])];
      }
      
      // Add service delivery visitors as parking records (with proper handling)
      if (serviceDeliveryResponse.success && serviceDeliveryResponse.data) {
        console.log('Service Delivery Raw Data:', JSON.stringify(serviceDeliveryResponse.data, null, 2));
        
        // Separate visitors with and without vehicles
        const sdVisitorsWithoutVehicle = serviceDeliveryResponse.data
          .filter((v: any) => !v.vehicle_storage?.has_vehicle)
          .map((v: any) => ({
            _id: v._id,
            plate_number: 'N/A',
            driver_identification: v.identification,
            driver_name: v.full_name,
            driver_telephone: v.telephone,
            status: v.is_still_inhouse ? 'active' : 'completed',
            driver_type: 'Without Vehicle',
            driver_gender: v.gender,
            slot_number: 'N/A',
            badge_number: v.badge_number,
            check_in: v.entry_date || v.createdAt,
            check_out: v.exist_date || null,
            duration: 'N/A',
            is_flagged: false,
            checked_in_by: v.registered_by || 'N/A',
            is_still_inhouse: v.is_still_inhouse
          }));
        
        // For visitors with vehicles, deduplicate with Parking records
        const sdVisitorsWithVehicle = serviceDeliveryResponse.data
          .filter((v: any) => v.vehicle_storage?.has_vehicle)
          .map((v: any) => ({
            _id: v._id,
            plate_number: v.vehicle_storage?.vehicle_details?.plate_number || 'N/A',
            driver_identification: v.identification,
            driver_name: v.full_name,
            driver_telephone: v.telephone,
            status: v.is_still_inhouse ? 'active' : 'completed',
            driver_type: 'Visitor',
            driver_gender: v.gender,
            slot_number: 'N/A',
            badge_number: v.badge_number,
            check_in: v.entry_date || v.createdAt,
            check_out: v.exist_date || null,
            duration: 'N/A',
            is_flagged: false,
            checked_in_by: v.registered_by || 'N/A',
            is_still_inhouse: v.is_still_inhouse
          }));
        
        // Deduplicate visitors with vehicles: remove SD records that have same plate as Parking records
        const parkingPlates = new Set(allRecords.map(r => r.plate_number?.toLowerCase()));
        const uniqueSdVisitorsWithVehicle = sdVisitorsWithVehicle.filter((v: any) => !parkingPlates.has(v.plate_number?.toLowerCase()));
        
        // Combine: visitors without vehicle (always added) + unique visitors with vehicle
        allRecords = [...allRecords, ...sdVisitorsWithoutVehicle, ...uniqueSdVisitorsWithVehicle];
        
        console.log('Mapped SD Visitors:', JSON.stringify({withoutVehicle: sdVisitorsWithoutVehicle.length, withVehicle: uniqueSdVisitorsWithVehicle.length}, null, 2));
      }
      
      console.log('All records count:', allRecords.length);
      
      setVisitors(allRecords);
      
      // Calculate stats from real data
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayRecords = allRecords.filter((r: ParkingRecord) => {
        const checkInDate = new Date(r.check_in);
        checkInDate.setHours(0, 0, 0, 0);
        return checkInDate.getTime() === today.getTime();
      });
      
      const activeRecords = allRecords.filter((r: ParkingRecord) => r.status === 'active');
      const checkedOutRecords = allRecords.filter((r: ParkingRecord) => r.status === 'completed' || r.check_out);
      const todayActive = todayRecords.filter((r: ParkingRecord) => r.status === 'active');
      const todayCheckedOut = todayRecords.filter((r: ParkingRecord) => r.check_out);
      
      setStats({
        totalVisitors: allRecords.length,
        todayVisitors: todayRecords.length,
        totalCheckIns: activeRecords.length + checkedOutRecords.length,
        todayCheckIns: todayActive.length,
        totalCheckOuts: checkedOutRecords.length,
        todayCheckOuts: todayCheckedOut.length
      });
    } catch (err) {
      console.error('Failed to fetch visitors:', err);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    } else if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated, authLoading, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Filter visitors based on table type
  const filteredVisitors = visitors.filter(visitor => {
    // Use driver_type to determine if visitor has vehicle
    // Backend sets driver_type: 'Without Vehicle' when has_vehicle: false
    const isWithoutVehicle = visitor.driver_type === 'Without Vehicle';
    
    // Filter by table type
    if (tableType === 'with_vehicle' && isWithoutVehicle) return false;
    if (tableType === 'without_vehicle' && !isWithoutVehicle) return false;
    
    // Handle driver_identification as object or string
    const idValue = typeof visitor.driver_identification === 'object' 
      ? visitor.driver_identification?.number || '' 
      : visitor.driver_identification || '';
    
    const matchesSearch = 
      visitor.driver_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      idValue.toLowerCase().includes(searchTerm.toLowerCase()) ||
      visitor.driver_telephone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      visitor.badge_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      visitor.plate_number?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && visitor.status === 'active') ||
      (statusFilter === 'checked_out' && (visitor.status === 'completed' || visitor.check_out));
    
    return matchesSearch && matchesStatus;
  });

  const handleAddVisitor = async () => {
    if (!formData.visitor_name || !formData.phone) {
      showWarning('Please fill in required fields');
      return;
    }

    setLoading(true);
    try {
      let response;
      
      if (tableType === 'without_vehicle') {
        // Use service delivery API for visitors without vehicles
        response = await serviceDeliveryService.checkIn({
          full_name: formData.visitor_name,
          telephone: formData.phone,
          email: formData.badge ? null : null,
          identification: formData.id_number ? { number: formData.id_number } : {},
          gender: formData.gender || 'Not specified',
          vehicle_storage: {
            has_vehicle: false,
            vehicle_details: {}
          },
          badge_number: formData.badge || null,
        });
      } else {
        // Use smart parking API for visitors with vehicles
        response = await smartParkingService.checkIn({
          plate_number: formData.plate_number || formData.visitor_name,
          driver_name: formData.visitor_name,
          driver_telephone: formData.phone,
          driver_identification: formData.id_number ? { number: formData.id_number } : null,
          badge_number: formData.badge || null,
          driver_type: formData.driver_type,
          driver_gender: formData.gender || null,
        });
      }
      
      if (response.success) {
        showSuccess(tableType === 'without_vehicle' 
          ? 'Visitor registered successfully without vehicle!' 
          : 'Visitor registered successfully');
        // Refresh data
        fetchData();
        setShowAddModal(false);
        setFormData({
          visitor_name: '',
          id_number: '',
          phone: '',
          badge: '',
          plate_number: '',
          driver_type: 'Regular',
          gender: '',
        });
      } else {
        showError(response.message || 'Failed to register visitor');
      }
    } catch (err: any) {
      showError(err?.message || 'Failed to register visitor');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getStatusBadge = (status: string) => {
    if (status === 'active') {
      return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Active</span>;
    }
    return <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">Checked Out</span>;
  };

  if (authLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Register Visitor</h1>
            <p className="text-gray-600 mt-1">Manage visitor check-ins and check-outs</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FiPlus className="w-5 h-5" />
            Add Visitor
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FiUser className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total</p>
                <p className="text-xl font-bold text-gray-900">{stats.totalVisitors}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <FiCalendar className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Today</p>
                <p className="text-xl font-bold text-gray-900">{stats.todayVisitors}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <FiLogIn className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Check-Ins</p>
                <p className="text-xl font-bold text-gray-900">{stats.todayCheckIns}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <FiLogOut className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Check-Outs</p>
                <p className="text-xl font-bold text-gray-900">{stats.todayCheckOuts}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <FiActivity className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Active</p>
                <p className="text-xl font-bold text-gray-900">{stats.todayCheckIns - stats.todayCheckOuts}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <FiAlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Flagged</p>
                <p className="text-xl font-bold text-gray-900">0</p>
              </div>
            </div>
          </div>
        </div>

        {/* Table Type Switcher */}
        <div className="flex gap-2 bg-gray-100 p-1 rounded-lg w-fit">
          <button
            onClick={() => setTableType('with_vehicle')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
              tableType === 'with_vehicle' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FiTruck className="w-4 h-4" />
            With Vehicle
          </button>
          <button
            onClick={() => setTableType('without_vehicle')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
              tableType === 'without_vehicle' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FiUser className="w-4 h-4" />
            Without Vehicle
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, ID, phone, badge..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full md:w-auto px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="checked_out">Checked Out</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {fetching ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredVisitors.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <FiUser className="w-12 h-12 mb-2" />
              <p>No visitors found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {tableType === 'with_vehicle' ? 'Plate Number' : 'Badge'}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gender</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check-In</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredVisitors.map((visitor, index) => {
                    const idValue = typeof visitor.driver_identification === 'object' 
                      ? visitor.driver_identification?.number || '' 
                      : visitor.driver_identification || '';
                    
                    return (
                      <tr key={visitor._id || index} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                              <FiUser className="w-4 h-4 text-blue-600" />
                            </div>
                            <span className="font-medium text-gray-900">{visitor.driver_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{idValue || 'N/A'}</td>
                        <td className="px-4 py-3 text-gray-600">{visitor.driver_telephone || 'N/A'}</td>
                        <td className="px-4 py-3">
                          {tableType === 'with_vehicle' ? (
                            <span className="font-mono text-gray-900">{visitor.plate_number}</span>
                          ) : (
                            <span className="text-gray-600">{visitor.badge_number || 'N/A'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{visitor.driver_gender || 'N/A'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-gray-600">
                            <FiClock className="w-4 h-4" />
                            {formatTime(visitor.check_in)}
                          </div>
                        </td>
                        <td className="px-4 py-3">{getStatusBadge(visitor.status)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Visitor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b bg-gray-200">
              <div className="flex items-center gap-2">
                {tableType === 'without_vehicle' ? (
                  <FiUser className="w-5 h-5 text-gray-700" />
                ) : (
                  <FiTruck className="w-5 h-5 text-gray-700" />
                )}
                <h2 className="text-lg font-semibold text-gray-800">
                  {tableType === 'without_vehicle' ? 'Register Visitor (No Vehicle)' : 'Register Visitor (With Vehicle)'}
                </h2>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-gray-600 hover:text-gray-900 p-1 rounded-lg hover:bg-gray-300 transition-colors">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Form Fields */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  name="visitor_name"
                  value={formData.visitor_name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter visitor name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">National ID *</label>
                <div className="relative">
                  <FiCreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    name="id_number"
                    value={formData.id_number}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter national ID"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                <div className="relative">
                  <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter phone number"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
      
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Badge ID</label>
                <input
                  type="text"
                  name="badge"
                  value={formData.badge}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter badge ID"
                />
              </div>
              
              {tableType === 'with_vehicle' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Plate Number *</label>
                    <input
                      type="text"
                      name="plate_number"
                      value={formData.plate_number}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                      placeholder="Enter plate number"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Driver Type</label>
                    <div className="flex gap-2">
                      {['Regular', 'Visitor', 'Staff'].map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, driver_type: type }))}
                          className={`flex-1 py-2 px-2 rounded-lg border text-sm font-medium transition-all ${
                            formData.driver_type === type
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            
            <div className="flex gap-2 p-4 border-t bg-gray-50">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-3 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-100 font-medium text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddVisitor}
                disabled={loading}
                className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1.5 text-sm font-medium"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                ) : (
                  <>
                    <FiSave className="w-3.5 h-3.5" />
                    Add Check-In
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default RegisterVisitorPage;
