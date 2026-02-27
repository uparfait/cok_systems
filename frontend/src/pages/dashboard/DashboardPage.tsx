// DashboardPage - Admin Dashboard for Parking & Service Delivery Management
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../core/contexts/AuthContext';
import { 
  FiHome, FiGrid, FiTruck, FiUsers, FiSettings, FiSearch, FiBell, 
  FiLogOut, FiMenu, FiArrowUpRight, FiArrowDownRight, FiCheck,
  FiChevronRight, FiActivity, FiAlertTriangle, FiFileText
} from 'react-icons/fi';
import { 
  HiOutlineOfficeBuilding, HiOutlineChartBar, HiOutlineClipboardList
} from 'react-icons/hi';

const DashboardPage: React.FC = () => {
  const { user, logout, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeMenu, setActiveMenu] = useState('dashboard');

  // Default user for demo - use from auth context
  const displayName = user?.fullName || 'Guest User';
  const displayRole = user?.role || 'User';
  const displayDepartment = user?.departmentName || '';
  
  // Check if user is admin based on department name (System admin gives full access)
  const isAdmin = displayDepartment.toLowerCase().includes('system admin') || displayDepartment.toLowerCase().includes('system admin');

  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  const parkingStats = [
    { label: 'Total Parking Slots', value: '250', change: '+12', trend: 'up', icon: HiOutlineClipboardList, color: 'blue' },
    { label: 'Currently Parked', value: '186', change: '+5', trend: 'up', icon: FiGrid, color: 'green' },
    { label: 'Available Slots', value: '64', change: '-3', trend: 'down', icon: FiCheck, color: 'emerald' },
    { label: 'Flagged Vehicles', value: '8', change: '+2', trend: 'up', icon: FiAlertTriangle, color: 'red' },
  ];

  const serviceStats = [
    { label: 'Total Visitors Today', value: '124', change: '+18', trend: 'up', icon: FiUsers, color: 'purple' },
    { label: 'Checked In', value: '98', change: '+12', trend: 'up', icon: FiArrowUpRight, color: 'green' },
    { label: 'Checked Out', value: '76', change: '+8', trend: 'up', icon: FiArrowDownRight, color: 'orange' },
    { label: 'Currently Inside', value: '48', change: '+4', trend: 'up', icon: FiActivity, color: 'blue' },
  ];

  const recentParkingRecords = [
    { id: 'PK-001', vehicle: 'RAB 123A', owner: 'John Mugisha', time: '10:30 AM', status: 'Parked', spot: 'A-12' },
    { id: 'PK-002', vehicle: 'RAB 456B', owner: 'Sarah Uwera', time: '10:25 AM', status: 'Parked', spot: 'B-05' },
    { id: 'PK-003', vehicle: 'RAB 789C', owner: 'Mike Bizimana', time: '10:15 AM', status: 'Parked', spot: 'C-08' },
    { id: 'PK-004', vehicle: 'RAB 321D', owner: 'Anna Kayitesi', time: '10:00 AM', status: 'Parked', spot: 'A-03' },
    { id: 'PK-005', vehicle: 'RAB 654E', owner: 'David Hategeka', time: '09:45 AM', status: 'Left', spot: 'B-12' },
  ];

  const recentVisitors = [
    { id: 'VIS-001', name: 'Emmanuel Nkusi', department: 'IT Department', checkIn: '09:30 AM', status: 'Inside', purpose: 'Meeting' },
    { id: 'VIS-002', name: 'Grace Mukamana', department: 'HR Department', checkIn: '09:45 AM', status: 'Inside', purpose: 'Interview' },
    { id: 'VIS-003', name: 'Patrick Habimana', department: 'Finance', checkIn: '10:00 AM', status: 'Inside', purpose: 'Consultation' },
    { id: 'VIS-004', name: 'Jeanne d\'Arc', department: 'Legal', checkIn: '08:30 AM', checkOut: '11:00 AM', status: 'Left', purpose: 'Client Meeting' },
    { id: 'VIS-005', name: 'Samuel Hakizimana', department: 'IT Department', checkIn: '10:15 AM', status: 'Inside', purpose: 'Technical Support' },
  ];

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

  // Department data
  const departments = [
    { name: 'IT Department', head: 'John Mugisha', employees: 45, status: 'active', color: 'blue' },
    { name: 'Finance Department', head: 'Sarah Uwera', employees: 32, status: 'active', color: 'green' },
    { name: 'HR Department', head: 'Mike Bizimana', employees: 18, status: 'active', color: 'purple' },
    { name: 'Legal Department', head: 'Anna Kayitesi', employees: 12, status: 'active', color: 'orange' },
    { name: 'Operations', head: 'David Hategeka', employees: 28, status: 'active', color: 'red' },
  ];

  // Employees data
  const employees = [
    { id: 'EMP-001', name: 'John Mugisha', department: 'IT', position: 'Software Engineer', status: 'active', phone: '+250 788 123 456' },
    { id: 'EMP-002', name: 'Sarah Uwera', department: 'Finance', position: 'Accountant', status: 'active', phone: '+250 788 234 567' },
    { id: 'EMP-003', name: 'Mike Bizimana', department: 'HR', position: 'HR Manager', status: 'active', phone: '+250 788 345 678' },
    { id: 'EMP-004', name: 'Anna Kayitesi', department: 'Legal', position: 'Legal Counsel', status: 'active', phone: '+250 788 456 789' },
    { id: 'EMP-005', name: 'David Hategeka', department: 'Operations', position: 'Operations Manager', status: 'active', phone: '+250 788 567 890' },
  ];

  // Feedback data
  const feedbacks = [
    { id: 'FB-001', from: 'John Mugisha', subject: 'Parking Issue', message: 'The parking lot needs better lighting', date: '2026-02-27', status: 'Pending' },
    { id: 'FB-002', from: 'Sarah Uwera', subject: 'Service Feedback', message: 'Excellent visitor management service', date: '2026-02-26', status: 'Resolved' },
    { id: 'FB-003', from: 'Mike Bizimana', subject: 'Suggestion', message: 'Add more EV charging stations', date: '2026-02-25', status: 'Pending' },
    { id: 'FB-004', from: 'Anna Kayitesi', subject: 'Complaint', message: 'Slow check-in process during peak hours', date: '2026-02-24', status: 'In Review' },
  ];

  // Reports data
  const reports = [
    { id: 'RPT-001', title: 'Monthly Parking Report', type: 'Parking', date: '2026-02-01', size: '2.4 MB' },
    { id: 'RPT-002', title: 'Visitor Analytics Q1', type: 'Service', date: '2026-01-31', size: '1.8 MB' },
    { id: 'RPT-003', title: 'Employee Summary', type: 'HR', date: '2026-01-30', size: '1.2 MB' },
    { id: 'RPT-004', title: 'Department Overview', type: 'Admin', date: '2026-01-29', size: '3.1 MB' },
  ];

  // Settings data
  const systemSettings = [
    { id: 1, category: 'General', name: 'Organization Name', value: 'KSESM' },
    { id: 2, category: 'General', name: 'Time Zone', value: 'Africa/Kigali (UTC+2)' },
    { id: 3, category: 'Parking', name: 'Max Parking Duration', value: '24 hours' },
    { id: 4, category: 'Parking', name: 'Flagged Car Threshold', value: '3 violations' },
    { id: 5, category: 'Service', name: 'Visitor Check-in Required', value: 'Yes' },
    { id: 6, category: 'Service', name: 'Max Visit Duration', value: '8 hours' },
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
            <div className="mb-6">
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">Dashboard Overview</h1>
              <p className="text-gray-500 mt-1">Manage parking and service delivery from one place</p>
            </div>

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
                      <div className="mt-4 flex items-center">
                        <span className={`inline-flex items-center text-sm font-semibold ${stat.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                          {stat.trend === 'up' ? <FiArrowUpRight className="w-3 h-3 mr-1" /> : <FiArrowDownRight className="w-3 h-3 mr-1" />}
                          {stat.change}
                        </span>
                        <span className="text-sm text-gray-400 ml-1">from yesterday</span>
                      </div>
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
                      <div className="mt-4 flex items-center">
                        <span className={`inline-flex items-center text-sm font-semibold ${stat.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                          {stat.trend === 'up' ? <FiArrowUpRight className="w-3 h-3 mr-1" /> : <FiArrowDownRight className="w-3 h-3 mr-1" />}
                          {stat.change}
                        </span>
                        <span className="text-sm text-gray-400 ml-1">from yesterday</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                  <h3 className="font-semibold text-gray-900">Recent Parking Records</h3>
                  <button onClick={() => setActiveMenu('parking')} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
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
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Spot</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {recentParkingRecords.map((record) => (
                        <tr key={record.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-5 py-3 text-sm font-medium text-gray-900">{record.id}</td>
                          <td className="px-5 py-3 text-sm font-semibold text-gray-900">{record.vehicle}</td>
                          <td className="px-5 py-3 text-sm text-gray-600">{record.owner}</td>
                          <td className="px-5 py-3 text-sm text-gray-500">{record.time}</td>
                          <td className="px-5 py-3 text-sm text-gray-600 font-medium">{record.spot}</td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${
                              record.status === 'Parked' 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {record.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                  <h3 className="font-semibold text-gray-900">Recent Visitors</h3>
                  <button onClick={() => setActiveMenu('service')} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
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
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Purpose</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {recentVisitors.map((visitor) => (
                        <tr key={visitor.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-5 py-3 text-sm font-medium text-gray-900">{visitor.id}</td>
                          <td className="px-5 py-3 text-sm font-semibold text-gray-900">{visitor.name}</td>
                          <td className="px-5 py-3 text-sm text-gray-600">{visitor.department}</td>
                          <td className="px-5 py-3 text-sm text-gray-500">{visitor.checkIn}</td>
                          <td className="px-5 py-3 text-sm text-gray-600">{visitor.purpose}</td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${
                              visitor.status === 'Inside' 
                                ? 'bg-blue-100 text-blue-700' 
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {visitor.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-blue-200 transition-all duration-200 text-left group">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-3 group-hover:bg-blue-600 transition-colors">
                    <FiTruck className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors" />
                  </div>
                  <p className="font-semibold text-gray-900">Vehicle Check-In</p>
                  <p className="text-sm text-gray-500 mt-1">Register new vehicle</p>
                </button>
                <button className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-green-200 transition-all duration-200 text-left group">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-3 group-hover:bg-green-600 transition-colors">
                    <FiUsers className="w-6 h-6 text-green-600 group-hover:text-white transition-colors" />
                  </div>
                  <p className="font-semibold text-gray-900">Visitor Check-In</p>
                  <p className="text-sm text-gray-500 mt-1">Register visitor</p>
                </button>
                <button className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-purple-200 transition-all duration-200 text-left group">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-3 group-hover:bg-purple-600 transition-colors">
                    <HiOutlineChartBar className="w-6 h-6 text-purple-600 group-hover:text-white transition-colors" />
                  </div>
                  <p className="font-semibold text-gray-900">Generate Report</p>
                  <p className="text-sm text-gray-500 mt-1">View analytics</p>
                </button>
                <button className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-gray-300 transition-all duration-200 text-left group">
                  <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-3 group-hover:bg-gray-600 transition-colors">
                    <FiSettings className="w-6 h-6 text-gray-600 group-hover:text-white transition-colors" />
                  </div>
                  <p className="font-semibold text-gray-900">System Settings</p>
                  <p className="text-sm text-gray-500 mt-1">Configure system</p>
                </button>
              </div>
            </div>

            {/* Department Overview Section */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <HiOutlineOfficeBuilding className="w-5 h-5 text-blue-600" />
                  Department Overview
                </h2>
                <button onClick={() => setActiveMenu('departments')} className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                  Manage Departments <FiChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {departments.map((dept, index) => (
                  <div key={index} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow duration-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        dept.color === 'blue' ? 'bg-blue-100' :
                        dept.color === 'green' ? 'bg-green-100' :
                        dept.color === 'purple' ? 'bg-purple-100' :
                        dept.color === 'orange' ? 'bg-orange-100' : 'bg-red-100'
                      }`}>
                        <HiOutlineOfficeBuilding className={`w-5 h-5 ${
                          dept.color === 'blue' ? 'text-blue-600' :
                          dept.color === 'green' ? 'text-green-600' :
                          dept.color === 'purple' ? 'text-purple-600' :
                          dept.color === 'orange' ? 'text-orange-600' : 'text-red-600'
                        }`} />
                      </div>
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                        Active
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-900 text-sm mb-1">{dept.name}</h3>
                    <p className="text-xs text-gray-500 mb-3">Head: {dept.head}</p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Employees</span>
                      <span className="font-semibold text-gray-900">{dept.employees}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Line Chart - Weekly Activity Overview */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-gray-900 text-lg">Weekly Activity Overview</h3>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                    <span className="text-sm text-gray-600">Parking</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                    <span className="text-sm text-gray-600">Visitors</span>
                  </div>
                </div>
              </div>
              
              {/* Line Graph with gradient fill */}
              <div className="relative h-64">
                {/* Y-axis labels */}
                <div className="absolute left-0 top-0 bottom-8 w-8 flex flex-col justify-between text-xs text-gray-400 pointer-events-none">
                  <span>100</span>
                  <span>80</span>
                  <span>60</span>
                  <span>40</span>
                  <span>20</span>
                  <span>0</span>
                </div>
                
                {/* Chart area */}
                <div className="ml-10 mr-4 h-full relative">
                  {/* Grid lines */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                    <div className="border-b border-gray-100 w-full"></div>
                    <div className="border-b border-gray-100 w-full"></div>
                    <div className="border-b border-gray-100 w-full"></div>
                    <div className="border-b border-gray-100 w-full"></div>
                    <div className="border-b border-gray-100 w-full"></div>
                    <div className="border-b border-gray-100 w-full"></div>
                  </div>
                  
                  {/* SVG Line Graph */}
                  <svg className="w-full h-full" viewBox="0 0 700 220" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="parkingGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3"/>
                        <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.05"/>
                      </linearGradient>
                      <linearGradient id="visitorsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22C55E" stopOpacity="0.3"/>
                        <stop offset="100%" stopColor="#22C55E" stopOpacity="0.05"/>
                      </linearGradient>
                    </defs>
                    
                    <path d="M0,120 C25,100 50,110 85,80 C120,50 155,90 170,60 C185,30 220,50 255,40 C290,30 325,20 340,15 C355,10 425,25 510,30 C595,35 595,20 680,10 L680,200 L0,200 Z" fill="url(#parkingGradient)" />
                    <path d="M0,140 C25,130 50,120 85,100 C120,80 155,90 170,70 C185,50 220,60 255,50 C290,40 325,35 340,30 C355,25 425,20 510,25 C595,30 595,25 680,20 L680,200 L0,200 Z" fill="url(#visitorsGradient)" />
                    <path d="M0,120 C25,100 50,110 85,80 C120,50 155,90 170,60 C185,30 220,50 255,40 C290,30 325,20 340,15 C355,10 425,25 510,30 C595,35 595,20 680,10" fill="none" stroke="#3B82F6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M0,140 C25,130 50,120 85,100 C120,80 155,90 170,70 C185,50 220,60 255,50 C290,40 325,35 340,30 C355,25 425,20 510,25 C595,30 595,25 680,20" fill="none" stroke="#22C55E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                    
                    <circle cx="0" cy="120" r="5" fill="#3B82F6" stroke="white" strokeWidth="2"/>
                    <circle cx="85" cy="80" r="5" fill="#3B82F6" stroke="white" strokeWidth="2"/>
                    <circle cx="170" cy="60" r="5" fill="#3B82F6" stroke="white" strokeWidth="2"/>
                    <circle cx="255" cy="40" r="5" fill="#3B82F6" stroke="white" strokeWidth="2"/>
                    <circle cx="340" cy="15" r="5" fill="#3B82F6" stroke="white" strokeWidth="2"/>
                    <circle cx="510" cy="30" r="5" fill="#3B82F6" stroke="white" strokeWidth="2"/>
                    <circle cx="680" cy="10" r="5" fill="#3B82F6" stroke="white" strokeWidth="2"/>
                    
                    <circle cx="0" cy="140" r="5" fill="#22C55E" stroke="white" strokeWidth="2"/>
                    <circle cx="85" cy="100" r="5" fill="#22C55E" stroke="white" strokeWidth="2"/>
                    <circle cx="170" cy="70" r="5" fill="#22C55E" stroke="white" strokeWidth="2"/>
                    <circle cx="255" cy="50" r="5" fill="#22C55E" stroke="white" strokeWidth="2"/>
                    <circle cx="340" cy="30" r="5" fill="#22C55E" stroke="white" strokeWidth="2"/>
                    <circle cx="510" cy="25" r="5" fill="#22C55E" stroke="white" strokeWidth="2"/>
                    <circle cx="680" cy="20" r="5" fill="#22C55E" stroke="white" strokeWidth="2"/>
                  </svg>
                </div>
                
                <div className="flex justify-between px-10 mt-2 text-xs font-medium text-gray-500">
                  <span>Mon</span>
                  <span>Tue</span>
                  <span>Wed</span>
                  <span>Thu</span>
                  <span>Fri</span>
                  <span>Sat</span>
                  <span>Sun</span>
                </div>
              </div>
            </div>
          </>
        );

      case 'parking':
        return (
          <>
            <div className="mb-6">
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">Smart Parking Management</h1>
              <p className="text-gray-500 mt-1">Monitor and manage all parking activities</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {parkingStats.map((stat, index) => {
                const Icon = stat.icon;
                const colors = getColorClasses(stat.color);
                return (
                  <div key={index} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                        <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
                      </div>
                      <div className={`w-11 h-11 ${colors.bg} rounded-xl flex items-center justify-center`}>
                        <Icon className={`w-5 h-5 ${colors.text}`} />
                      </div>
                    </div>
                    <div className="mt-4 flex items-center">
                      <span className={`inline-flex items-center text-sm font-semibold ${stat.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                        {stat.trend === 'up' ? <FiArrowUpRight className="w-3 h-3 mr-1" /> : <FiArrowDownRight className="w-3 h-3 mr-1" />}
                        {stat.change}
                      </span>
                      <span className="text-sm text-gray-400 ml-1">from yesterday</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <h3 className="font-semibold text-gray-900">All Parking Records</h3>
                <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  Export
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
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Spot</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {recentParkingRecords.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-3 text-sm font-medium text-gray-900">{record.id}</td>
                        <td className="px-5 py-3 text-sm font-semibold text-gray-900">{record.vehicle}</td>
                        <td className="px-5 py-3 text-sm text-gray-600">{record.owner}</td>
                        <td className="px-5 py-3 text-sm text-gray-500">{record.time}</td>
                        <td className="px-5 py-3 text-sm text-gray-600 font-medium">{record.spot}</td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${
                            record.status === 'Parked' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {record.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        );

      case 'service':
        return (
          <>
            <div className="mb-6">
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">Service Delivery Management</h1>
              <p className="text-gray-500 mt-1">Manage visitors and service delivery operations</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {serviceStats.map((stat, index) => {
                const Icon = stat.icon;
                const colors = getColorClasses(stat.color);
                return (
                  <div key={index} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                        <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
                      </div>
                      <div className={`w-11 h-11 ${colors.bg} rounded-xl flex items-center justify-center`}>
                        <Icon className={`w-5 h-5 ${colors.text}`} />
                      </div>
                    </div>
                    <div className="mt-4 flex items-center">
                      <span className={`inline-flex items-center text-sm font-semibold ${stat.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                        {stat.trend === 'up' ? <FiArrowUpRight className="w-3 h-3 mr-1" /> : <FiArrowDownRight className="w-3 h-3 mr-1" />}
                        {stat.change}
                      </span>
                      <span className="text-sm text-gray-400 ml-1">from yesterday</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <h3 className="font-semibold text-gray-900">All Visitor Records</h3>
                <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  Export
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
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Purpose</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {recentVisitors.map((visitor) => (
                      <tr key={visitor.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-3 text-sm font-medium text-gray-900">{visitor.id}</td>
                        <td className="px-5 py-3 text-sm font-semibold text-gray-900">{visitor.name}</td>
                        <td className="px-5 py-3 text-sm text-gray-600">{visitor.department}</td>
                        <td className="px-5 py-3 text-sm text-gray-500">{visitor.checkIn}</td>
                        <td className="px-5 py-3 text-sm text-gray-600">{visitor.purpose}</td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${
                            visitor.status === 'Inside' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {visitor.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        );

      case 'employees':
        return (
          <>
            <div className="mb-6">
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">Employee Management</h1>
              <p className="text-gray-500 mt-1">View and manage all employees</p>
            </div>
            
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <h3 className="font-semibold text-gray-900">All Employees</h3>
                <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  Add Employee
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">ID</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Department</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Position</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {employees.map((emp) => (
                      <tr key={emp.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-3 text-sm font-medium text-gray-900">{emp.id}</td>
                        <td className="px-5 py-3 text-sm font-semibold text-gray-900">{emp.name}</td>
                        <td className="px-5 py-3 text-sm text-gray-600">{emp.department}</td>
                        <td className="px-5 py-3 text-sm text-gray-600">{emp.position}</td>
                        <td className="px-5 py-3 text-sm text-gray-500">{emp.phone}</td>
                        <td className="px-5 py-3">
                          <span className="inline-flex px-2.5 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">
                            {emp.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        );

      case 'departments':
        return (
          <>
            <div className="mb-6">
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">Department Management</h1>
              <p className="text-gray-500 mt-1">View and manage all departments</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {departments.map((dept, index) => (
                <div key={index} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow duration-200">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                      dept.color === 'blue' ? 'bg-blue-100' :
                      dept.color === 'green' ? 'bg-green-100' :
                      dept.color === 'purple' ? 'bg-purple-100' :
                      dept.color === 'orange' ? 'bg-orange-100' : 'bg-red-100'
                    }`}>
                      <HiOutlineOfficeBuilding className={`w-7 h-7 ${
                        dept.color === 'blue' ? 'text-blue-600' :
                        dept.color === 'green' ? 'text-green-600' :
                        dept.color === 'purple' ? 'text-purple-600' :
                        dept.color === 'orange' ? 'text-orange-600' : 'text-red-600'
                      }`} />
                    </div>
                    <span className="inline-flex px-3 py-1 text-sm font-medium rounded-full bg-green-100 text-green-700">
                      Active
                    </span>
                  </div>
                  <h3 className="font-bold text-xl text-gray-900 mb-2">{dept.name}</h3>
                  <p className="text-gray-500 mb-4">Head: {dept.head}</p>
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <div>
                      <p className="text-sm text-gray-500">Employees</p>
                      <p className="text-2xl font-bold text-gray-900">{dept.employees}</p>
                    </div>
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        );

      case 'feedback':
        return (
          <>
            <div className="mb-6">
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">Feedback Management</h1>
              <p className="text-gray-500 mt-1">View and manage user feedback</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <p className="text-sm font-medium text-gray-500">Total Feedback</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">24</p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <p className="text-sm font-medium text-gray-500">Pending</p>
                <p className="text-3xl font-bold text-orange-600 mt-1">8</p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <p className="text-sm font-medium text-gray-500">Resolved</p>
                <p className="text-3xl font-bold text-green-600 mt-1">16</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
                <h3 className="font-semibold text-gray-900">All Feedback</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {feedbacks.map((fb) => (
                  <div key={fb.id} className="p-5 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-gray-900">{fb.subject}</h4>
                        <p className="text-sm text-gray-500">From: {fb.from} • {fb.date}</p>
                      </div>
                      <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${
                        fb.status === 'Pending' ? 'bg-orange-100 text-orange-700' :
                        fb.status === 'Resolved' ? 'bg-green-100 text-green-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {fb.status}
                      </span>
                    </div>
                    <p className="text-gray-600 mt-2">{fb.message}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        );

      case 'reports':
        return (
          <>
            <div className="mb-6">
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">Reports & Analytics</h1>
              <p className="text-gray-500 mt-1">Generate and view system reports</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <FiFileText className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Reports</p>
                    <p className="text-2xl font-bold text-gray-900">12</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <HiOutlineChartBar className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">This Month</p>
                    <p className="text-2xl font-bold text-gray-900">4</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <h3 className="font-semibold text-gray-900">Available Reports</h3>
                <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  Generate New
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">ID</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Size</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {reports.map((report) => (
                      <tr key={report.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-3 text-sm font-medium text-gray-900">{report.id}</td>
                        <td className="px-5 py-3 text-sm font-semibold text-gray-900">{report.title}</td>
                        <td className="px-5 py-3 text-sm text-gray-600">{report.type}</td>
                        <td className="px-5 py-3 text-sm text-gray-500">{report.date}</td>
                        <td className="px-5 py-3 text-sm text-gray-500">{report.size}</td>
                        <td className="px-5 py-3">
                          <button className="text-blue-600 hover:text-blue-700 font-medium text-sm">
                            Download
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        );

      case 'settings':
        return (
          <>
            <div className="mb-6">
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">System Settings</h1>
              <p className="text-gray-500 mt-1">Configure system preferences</p>
            </div>
            
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
                <h3 className="font-semibold text-gray-900">General Settings</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {systemSettings.map((setting) => (
                  <div key={setting.id} className="p-5 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                    <div>
                      <p className="font-medium text-gray-900">{setting.name}</p>
                      <p className="text-sm text-gray-500">{setting.category}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-gray-700">{setting.value}</span>
                      <button className="text-blue-600 hover:text-blue-700 font-medium text-sm">
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white text-gray-900 shadow-xl transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:relative lg:translate-x-0`}
      >
        <div className="h-16 flex items-center px-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <img 
              src="/LOGO_COK.jpg" 
              alt="COK Logo" 
              className="w-10 h-10 rounded-lg object-cover shadow-sm"
            />
            <div>
              <h1 className="font-bold text-lg text-gray-800 tracking-tight">KSESM</h1>
              <p className="text-xs text-gray-500 font-medium">{isAdmin ? 'Admin Portal' : 'Portal'}</p>
            </div>
          </div>
        </div>

        <nav className="mt-5 px-3">
          {isAdmin && (
            <ul className="space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => setActiveMenu(item.id)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                        activeMenu === item.id
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      {item.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-4 shadow-lg shadow-blue-200">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <span className="text-white font-bold text-base">
                  {displayName.charAt(0)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {displayName}
                </p>
                <p className="text-xs text-blue-100 truncate">
                  {displayRole}{displayDepartment ? ` | ${displayDepartment}` : ''}
                </p>
              </div>
              <button 
                onClick={logout}
                className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                title="Logout"
              >
                <FiLogOut className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen">
        <header className="h-16 bg-white shadow-sm border-b border-gray-100 flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-4">
            {/* Dashboard Title - Left side */}
            <div className="hidden md:flex flex-col">
              <span className="text-lg font-bold text-gray-900">Dashboard</span>
              <span className="text-xs font-medium text-sky-500">
                {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                <span className="mx-1">|</span>
                {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </span>
            </div>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <FiMenu className="w-6 h-6 text-gray-600" />
            </button>
          </div>
          
          {/* Search - Center */}
          <div className="hidden md:block flex-1 max-w-md mx-4">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                <FiSearch className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Search..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border-0 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <FiBell className="w-5 h-5 text-gray-600" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
            </button>

            <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-sm">
                <span className="text-white font-semibold text-sm">
                  {displayName.charAt(0)}
                </span>
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-gray-900">{displayName}</p>
                <p className="text-xs text-gray-500">{displayRole}{displayDepartment ? ` | ${displayDepartment}` : ''}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {isAdmin ? renderContent() : (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                <FiSettings className="w-12 h-12 text-gray-400" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Portal Under Development</h2>
              <p className="text-gray-500 max-w-md mb-6">
                This dashboard is currently under development. Please check back later for updates.
              </p>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-md w-full">
                <p className="text-sm text-gray-500 mb-2">Your current access:</p>
                <p className="text-lg font-semibold text-gray-900">{displayDepartment || displayRole}</p>
                <p className="text-sm text-gray-500 mt-4">Contact your administrator for access.</p>
              </div>
            </div>
          )}
        </main>

        <footer className="bg-white border-t border-gray-100 py-4 px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-2">
            <p className="text-sm text-gray-500">
              © {new Date().getFullYear()} City of Kigali. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <span className="font-medium">KSESM v1.0.0</span>
              <span>•</span>
              <span>Admin Dashboard</span>
            </div>
          </div>
        </footer>
      </div>

      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}
    </div>
  );
};

export default DashboardPage;
