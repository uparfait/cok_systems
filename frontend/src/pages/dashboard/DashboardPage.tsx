// DashboardPage - Admin Dashboard for Parking & Service Delivery Management
// Real API integration for data fetching
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../core/contexts/AuthContext';
import LoadingSpinner from '../../core/components/LoadingSpinner';
import { departmentService, employeeService, smartParkingService, serviceDeliveryService } from '../../core/services/adminService';
import { 
  FiHome, FiGrid, FiTruck, FiUsers, FiSettings, FiBell, 
  FiLogOut, FiMenu, FiArrowUpRight, FiArrowDownRight, FiCheck,
  FiChevronRight, FiActivity, FiAlertTriangle, FiRefreshCw
} from 'react-icons/fi';
import { 
  HiOutlineOfficeBuilding, HiOutlineChartBar, HiOutlineClipboardList
} from 'react-icons/hi';

const DashboardPage: React.FC = () => {
  const { user, logout, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [loadingData, setLoadingData] = useState(false);

  // Real data from API
  const [departments, setDepartments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [parkingRecords, setParkingRecords] = useState<any[]>([]);
  const [visitors, setVisitors] = useState<any[]>([]);
  const [error, setError] = useState('');

  
  // Note: API returns department_name but User interface uses departmentName
  const displayName = user?.fullName || 'Guest User';
  const displayRole = user?.role || 'User';
  // Check both departmentName (from interface) and department_name (from API response)
  const displayDepartment = (user as any)?.departmentName || (user as any)?.department_name || '';
  
  // Check if user is admin based on department name (System admin gives full access)
  // Note: isAdmin is kept for potential future role-based features

  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login');
    } else if (isAuthenticated) {
      loadDashboardData();
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Load all dashboard data from APIs
  const loadDashboardData = async () => {
    setLoadingData(true);
    setError('');
    
    try {
      // Fetch departments
      const deptResponse = await departmentService.getAll();
      if (deptResponse.status) {
        setDepartments(deptResponse.data || []);
      }

      // Fetch employees
      const empResponse = await employeeService.getAll();
      if (empResponse.status) {
        setEmployees(empResponse.data || []);
      }

      // Fetch parking records
      const parkingResponse = await smartParkingService.getAllVehicles();
      if (parkingResponse.status) {
        setParkingRecords(parkingResponse.data || []);
      }

      // Fetch visitors
      const visitorResponse = await serviceDeliveryService.getAllVisitors();
      if (visitorResponse.status) {
        setVisitors(visitorResponse.data || []);
      }
    } catch (err: any) {
      console.error('Error loading dashboard data:', err);
      // Use backend message with priority
      setError(err?.message || err?.error || 'Failed to load some dashboard data');
    } finally {
      setLoadingData(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner 
          message="Loading dashboard..."
          longLoadingMessage="This is taking longer than usual. Please check your connection."
          longLoadingDelay={3000}
        />
      </div>
    );
  }

  // Calculate stats from real data
  const parkingStats = [
    { label: 'Total Parking Records', value: parkingRecords.length || 0, icon: HiOutlineClipboardList, color: 'blue' },
    { label: 'Currently Parked', value: parkingRecords.filter((p: any) => p.status === 'Parked').length || 0, icon: FiGrid, color: 'green' },
    { label: 'Checked Out', value: parkingRecords.filter((p: any) => p.status === 'Left').length || 0, icon: FiCheck, color: 'emerald' },
    { label: 'Flagged Vehicles', value: parkingRecords.filter((p: any) => p.flagged).length || 0, icon: FiAlertTriangle, color: 'red' },
  ];

  const serviceStats = [
    { label: 'Total Visitors', value: visitors.length || 0, icon: FiUsers, color: 'purple' },
    { label: 'Currently Inside', value: visitors.filter((v: any) => v.status === 'Inside').length || 0, icon: FiArrowUpRight, color: 'green' },
    { label: 'Checked Out', value: visitors.filter((v: any) => v.status === 'Left').length || 0, icon: FiArrowDownRight, color: 'orange' },
    { label: 'Total Departments', value: departments.length || 0, icon: HiOutlineOfficeBuilding, color: 'blue' },
  ];

  const getColorClasses = (color: string) => {
    const colors: { [key: string]: { bg: string; text: string } } = {
      blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
      green: { bg: 'bg-green-100', text: 'text-green-600' },
      emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600' },
      red: { bg: 'bg-red-100', text: 'text-red-600' },
      purple: { bg: 'bg-purple-100', text: 'text-purple-600' },
      orange: { bg: 'bg-orange-100', text: 'text-orange-600' },
    };
    return colors[color] || colors.blue;
  };

  // Render content based on active menu
  const renderContent = () => {
    switch (activeMenu) {
      case 'dashboard':
        return (
          <>
            {/* Dashboard Overview Content */}
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">Dashboard Overview</h1>
                <p className="text-gray-500 mt-1">Manage parking and service delivery from one place</p>
              </div>
              <button
                onClick={loadDashboardData}
                disabled={loadingData}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                <FiRefreshCw className={`w-4 h-4 ${loadingData ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <FiTruck className="w-5 h-5 text-blue-600" /> 
                  Smart Parking
                </h2>
                <button onClick={() => setActiveMenu('parking')} className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                  View All <FiChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {parkingStats.map((stat, index) => {
                  const Icon = stat.icon;
                  const colors = getColorClasses(stat.color);
                  return (
                    <div key={index} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow duration-200">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                          <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
                        </div>
                        <div className={`w-11 h-11 ${colors.bg} rounded-xl flex items-center justify-center`}>
                          <Icon className={`w-5 h-5 ${colors.text}`} />
                        </div>
                      </div>
                      {stat.value === 0 && (
                        <p className="text-xs text-gray-400 mt-2">No records found</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <HiOutlineClipboardList className="w-5 h-5 text-green-600" /> 
                  Service Delivery
                </h2>
                <button onClick={() => setActiveMenu('service')} className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                  View All <FiChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {serviceStats.map((stat, index) => {
                  const Icon = stat.icon;
                  const colors = getColorClasses(stat.color);
                  return (
                    <div key={index} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow duration-200">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                          <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
                        </div>
                        <div className={`w-11 h-11 ${colors.bg} rounded-xl flex items-center justify-center`}>
                          <Icon className={`w-5 h-5 ${colors.text}`} />
                        </div>
                      </div>
                      {stat.value === 0 && (
                        <p className="text-xs text-gray-400 mt-2">No records found</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                  <h3 className="font-semibold text-gray-900">Recent Parking Records</h3>
                  <button onClick={() => navigate('/admin/parking')} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                    View All
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">ID</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Vehicle</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Owner</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Time</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {parkingRecords.slice(0, 5).map((record: any) => (
                        <tr key={record._id || record.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-5 py-3 text-sm font-medium text-gray-900">{record._id?.slice(-6) || record.id || 'N/A'}</td>
                          <td className="px-5 py-3 text-sm font-semibold text-gray-900">{record.vehicle || record.plateNumber || 'N/A'}</td>
                          <td className="px-5 py-3 text-sm text-gray-600">{record.owner?.name || record.ownerName || 'N/A'}</td>
                          <td className="px-5 py-3 text-sm text-gray-500">{record.checkInTime || record.time || 'N/A'}</td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${
                              record.status === 'Parked' 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {record.status || 'Unknown'}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {parkingRecords.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-5 py-8 text-center text-gray-500">
                            No parking records found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                  <h3 className="font-semibold text-gray-900">Recent Visitors</h3>
                  <button onClick={() => navigate('/admin/visitors')} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                    View All
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">ID</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Department</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Check In</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {visitors.slice(0, 5).map((visitor: any) => (
                        <tr key={visitor._id || visitor.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-5 py-3 text-sm font-medium text-gray-900">{visitor._id?.slice(-6) || visitor.id || 'N/A'}</td>
                          <td className="px-5 py-3 text-sm font-semibold text-gray-900">{visitor.name || visitor.visitorName || 'N/A'}</td>
                          <td className="px-5 py-3 text-sm text-gray-600">{visitor.department || visitor.departmentName || 'N/A'}</td>
                          <td className="px-5 py-3 text-sm text-gray-500">{visitor.checkInTime || visitor.checkIn || 'N/A'}</td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${
                              visitor.status === 'Inside' 
                                ? 'bg-blue-100 text-blue-700' 
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {visitor.status || 'Unknown'}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {visitors.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-5 py-8 text-center text-gray-500">
                            No visitors found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Department Overview Section */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <HiOutlineOfficeBuilding className="w-5 h-5 text-blue-600" />
                  Department Overview
                </h2>
                <button onClick={() => navigate('/admin/departments')} className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                  Manage Departments <FiChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {departments.map((dept: any, index) => (
                  <div key={dept._id || dept.department_id || index} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow duration-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        index % 5 === 0 ? 'bg-blue-100' :
                        index % 5 === 1 ? 'bg-green-100' :
                        index % 5 === 2 ? 'bg-purple-100' :
                        index % 5 === 3 ? 'bg-orange-100' : 'bg-red-100'
                      }`}>
                        <HiOutlineOfficeBuilding className={`w-5 h-5 ${
                          index % 5 === 0 ? 'text-blue-600' :
                          index % 5 === 1 ? 'text-green-600' :
                          index % 5 === 2 ? 'text-purple-600' :
                          index % 5 === 3 ? 'text-orange-600' : 'text-red-600'
                        }`} />
                      </div>
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                        Active
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-900 text-sm mb-1">{dept.name}</h3>
                    <p className="text-xs text-gray-500 mb-3">Head: {dept.head || 'Not assigned'}</p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Employees</span>
                      <span className="font-semibold text-gray-900">{employees.filter((e: any) => e.department === dept.name).length}</span>
                    </div>
                  </div>
                ))}
                {departments.length === 0 && (
                  <div className="col-span-full text-center py-8">
                    <p className="text-gray-500">No departments found</p>
                  </div>
                )}
              </div>
            </div>
          </>
        );

      case 'parking':
        return (
          <div className="text-center py-12">
            <FiTruck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Smart Parking Management</h2>
            <p className="text-gray-500 mb-6">Full parking management coming soon</p>
            <button 
              onClick={() => navigate('/admin/parking')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
            >
              Go to Parking Admin
            </button>
          </div>
        );

      case 'service':
        return (
          <div className="text-center py-12">
            <HiOutlineClipboardList className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Service Delivery Management</h2>
            <p className="text-gray-500 mb-6">Full service delivery management coming soon</p>
            <button 
              onClick={() => navigate('/admin/visitors')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
            >
              Go to Visitors Admin
            </button>
          </div>
        );

      case 'employees':
        return (
          <div className="text-center py-12">
            <FiUsers className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Employee Management</h2>
            <p className="text-gray-500 mb-6">Full employee management coming soon</p>
            <button 
              onClick={() => navigate('/admin/employees')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
            >
              Go to Employees Admin
            </button>
          </div>
        );

      case 'departments':
        return (
          <div className="text-center py-12">
            <HiOutlineOfficeBuilding className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Department Management</h2>
            <p className="text-gray-500 mb-6">Full department management coming soon</p>
            <button 
              onClick={() => navigate('/admin/departments')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
            >
              Go to Departments Admin
            </button>
          </div>
        );

      case 'feedback':
        return (
          <div className="text-center py-12">
            <FiActivity className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Feedback Management</h2>
            <p className="text-gray-500">Full feedback management coming soon</p>
          </div>
        );

      case 'reports':
        return (
          <div className="text-center py-12">
            <HiOutlineChartBar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Reports & Analytics</h2>
            <p className="text-gray-500">Reports and analytics coming soon</p>
          </div>
        );

      case 'settings':
        return (
          <div className="text-center py-12">
            <FiSettings className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Settings</h2>
            <p className="text-gray-500">System settings coming soon</p>
          </div>
        );

      default:
        return null;
    }
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: FiHome },
    { id: 'parking', label: 'Smart Parking', icon: FiTruck },
    { id: 'service', label: 'Service Delivery', icon: HiOutlineClipboardList },
    { id: 'employees', label: 'Employees', icon: FiUsers },
    { id: 'departments', label: 'Departments', icon: HiOutlineOfficeBuilding },
    { id: 'feedback', label: 'Feedback', icon: FiActivity },
    { id: 'reports', label: 'Reports', icon: HiOutlineChartBar },
    { id: 'settings', label: 'Settings', icon: FiSettings },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-full bg-white border-r border-gray-200 transition-all duration-300 z-40 ${sidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
          {sidebarOpen && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">COK</span>
              </div>
              <span className="font-semibold text-gray-900">Systems</span>
            </div>
          )}
          {!sidebarOpen && (
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mx-auto">
              <span className="text-white font-bold text-sm">C</span>
            </div>
          )}
        </div>

        <nav className="p-3 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeMenu === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => setActiveMenu(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
                title={!sidebarOpen ? item.label : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && (
                  <span className="font-medium text-sm truncate">{item.label}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 h-16 border-t border-gray-200 bg-white">
          <div className={`flex items-center ${sidebarOpen ? 'px-4' : 'justify-center'} h-full`}>
            <button
              onClick={() => logout()}
              className={`flex items-center gap-2 text-gray-600 hover:text-red-600 transition-colors ${!sidebarOpen && 'justify-center w-full'}`}
            >
              <FiLogOut className="w-5 h-5" />
              {sidebarOpen && <span className="text-sm font-medium">Logout</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-20'}`}>
        <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            >
              <FiMenu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{displayName}</h1>
              <p className="text-sm text-gray-500">{displayRole} - {displayDepartment || 'General User'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
              <FiBell className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className="p-6">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default DashboardPage;
