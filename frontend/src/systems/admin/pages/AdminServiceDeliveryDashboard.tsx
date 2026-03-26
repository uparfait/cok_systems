// AdminServiceDeliveryDashboard - Admin Service Delivery Management Dashboard
// Features: Stats cards, visitor management, hourly activity chart, PDF export

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { statisticsService, serviceDeliveryService, departmentService } from '../../../core/services/adminService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import LoadingSpinner from '../../../core/components/LoadingSpinner';
import { useToast } from '../../../core/contexts/ToastContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  FiUsers, FiUserPlus, FiUserMinus, FiClock, FiCheckCircle, FiX,
  FiRefreshCw, FiSearch, FiFilter, FiCalendar, FiDownload, FiAlertCircle,
  FiFileText
} from 'react-icons/fi';
import { HiOutlineClipboardList } from 'react-icons/hi';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// Types
interface Visitor {
  _id: string;
  full_name?: string;
  name?: string;
  visitorName?: string;
  telephone?: string;
  phone?: string;
  badge_number?: string;
  departments_assigned?: Array<{
    department_id: string;
    department_name: string;
    assigned_time: Date;
    reached_in: boolean;
    provider_name?: string;
    provider_id?: string;
  }>;
  services_status?: Array<{
    department_name: string;
    department_id: string;
    provider_name?: string;
    provider_id?: string;
    s_type: string;
  }>;
  entry_date?: string;
  exist_date?: string;
  is_still_inhouse?: boolean;
}

interface HourlyData {
  hour: number;
  visitors_checked_in: number;
}

interface ServiceDeliveryStats {
  total: number;
  inhouse: number;
  completed: number;
  by_status: { [key: string]: number };
  by_department: { [key: string]: number };
}

const AdminServiceDeliveryDashboard: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  // State
  const [loading, setLoading] = useState(true);
  const [firstLoad, setfirstLoad] = useState(true);
  const [departmentCount, setDepartmentCount] = useState(0);
  const [stats, setStats] = useState<ServiceDeliveryStats>({
    total: 0,
    inhouse: 0,
    completed: 0,
    by_status: {},
    by_department: {}
  });
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch hourly service delivery stats
      const hourlyResponse = await statisticsService.getHourlyServiceDeliveryStats();
      const hourly = hourlyResponse?.data?.hourly || hourlyResponse?.hourly || [];
      setHourlyData(hourly);

      // Fetch service delivery stats
      const statsResponse = await statisticsService.getServiceDeliveryStats();
      const statsData = statsResponse?.data || statsResponse || {};
      setStats(statsData);

      // Fetch departments count
      const deptResponse = await departmentService.getAll();
      const departments = deptResponse?.data || deptResponse || [];
      const activeDepts = Array.isArray(departments) ? departments.filter((d: any) => d.status !== 'inactive').length : 0;
      setDepartmentCount(activeDepts);

      // Fetch all visitors (both inside and left)
      const [insideResponse, leftResponse] = await Promise.all([
        serviceDeliveryService.getAll(1, 100, true),
        serviceDeliveryService.getAll(1, 100, false)
      ]);
      
      // API returns response.data directly which contains { success, data, total, etc }
      const insideData = insideResponse?.data || [];
      const leftData = leftResponse?.data || [];
      setVisitors([...insideData, ...leftData]);
    } catch (error) {
      console.error('Error fetching service delivery data:', error);
      showError('Failed to load service delivery data');
    } finally {
      setLoading(false);
      setfirstLoad(false);
    }
  }, [showError]);

  // Initial load
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      fetchDashboardData();
    }
  }, [isAuthenticated, authLoading, fetchDashboardData]);

  // Filter visitors
  const filteredVisitors = visitors.filter(v => {
    const fullName = v.full_name || v.name || v.visitorName || '';
    const matchesSearch = !searchQuery || 
      fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.telephone || v.phone || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'inside' && v.is_still_inhouse) ||
      (statusFilter === 'left' && !v.is_still_inhouse);
    
    return matchesSearch && matchesStatus;
  });

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  // Get department name from visitor
  const getDepartmentName = (visitor: Visitor): string => {
    if (visitor.departments_assigned && visitor.departments_assigned.length > 0) {
      const reachedDept = visitor.departments_assigned.find(d => d.reached_in);
      return reachedDept?.department_name || visitor.departments_assigned[0]?.department_name || '___';
    }
    return 'Not Yet Assigned';
  };

  // Get assigned staff (provider) name
  const getAssignedStaff = (visitor: Visitor): string => {
    // First check if there's a provider in services_status
    if (visitor.services_status && visitor.services_status.length > 0) {
      const inProgressService = visitor.services_status.find(s => s.s_type === 'Inprogress');
      if (inProgressService?.provider_name) {
        return inProgressService.provider_name;
      }
      // Check if any service has been completed
      const completedService = visitor.services_status.find(s => s.s_type === 'Completed');
      if (completedService?.provider_name) {
        return completedService.provider_name;
      }
    }
    
    // Check departments_assigned for provider
    if (visitor.departments_assigned && visitor.departments_assigned.length > 0) {
      const reachedDept = visitor.departments_assigned.find(d => d.reached_in);
      if (reachedDept?.provider_name) {
        return reachedDept.provider_name;
      }
    }
    
    // Check if assigned to any department
    if (visitor.departments_assigned && visitor.departments_assigned.length > 0) {
      return 'Not Yet Served';
    }
    
    return 'Not Yet Assigned';
  };

  // Get check-in time
  const getCheckInTime = (visitor: Visitor): string => {
    if (visitor.entry_date) {
      return new Date(visitor.entry_date).toLocaleString();
    }
    return '___';
  };

  // Get check-out time
  const getCheckOutTime = (visitor: Visitor): string => {
    // Check exist_date for check-out time
    if (visitor.exist_date) {
      return new Date(visitor.exist_date).toLocaleString();
    }
    // If still inhouse, no check-out time
    if (visitor.is_still_inhouse) {
      return '-';
    }
    return '___';
  };

  // Get status display
  const getStatusDisplay = (visitor: Visitor): { text: string; color: string } => {
    if (visitor.is_still_inhouse) {
      return { text: 'Inside', color: 'green' };
    }
    return { text: 'Checked Out', color: 'gray' };
  };

  // Handle PDF export
  const handleExportPDF = useCallback(() => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    let yPosition = 15;

    // Logo
    const logoWidth = 40;
    const logoHeight = 40;
    const logoX = (pageWidth - logoWidth) / 2;
    
    try {
      doc.addImage('/LOGO_COK.png', 'PNG', logoX, yPosition, logoWidth, logoHeight);
    } catch (e) {
      console.log('Logo not found, continuing without logo');
    }
    yPosition += logoHeight + 8;

    // Header
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('REPUBLIC OF RWANDA', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 7;

    doc.setFontSize(12);
    doc.text('CITY OF KIGALI', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 12;

    const now = new Date();
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`${now.toLocaleDateString()}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 5;
    doc.text(`${now.toLocaleTimeString()}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 12;

    // Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 255);
    doc.text('SERVICE DELIVERY VISITORS REPORT', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;

    // Table
    if (filteredVisitors.length > 0) {
      const tableData = filteredVisitors.slice(0, 200).map(visitor => [
        visitor.full_name || visitor.name || visitor.visitorName || '___',
        getDepartmentName(visitor),
        getAssignedStaff(visitor),
        visitor.badge_number || '___',
        getCheckInTime(visitor),
        getCheckOutTime(visitor),
        getStatusDisplay(visitor).text
      ]);

      const tableWidth = 280;
      const tableStartX = (pageWidth - tableWidth) / 2;

      autoTable(doc, {
        startY: yPosition,
        head: [['Visitor Name', 'Department', 'Assigned Staff', 'Badge No.', 'Check-in', 'Check-out', 'Status']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [34, 139, 34],
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: 'bold',
          halign: 'center',
          cellPadding: 4,
          valign: 'middle'
        },
        bodyStyles: {
          fontSize: 8,
          cellPadding: 3,
          valign: 'middle',
          halign: 'center'
        },
        columnStyles: {
          0: { cellWidth: 45, halign: 'left' },
          1: { cellWidth: 40, halign: 'center' },
          2: { cellWidth: 40, halign: 'center' },
          3: { cellWidth: 30, halign: 'center' },
          4: { cellWidth: 45, halign: 'center' },
          5: { cellWidth: 45, halign: 'center' },
          6: { cellWidth: 35, halign: 'center' }
        },
        margin: { left: tableStartX, right: tableStartX },
        tableWidth: tableWidth,
        didDrawPage: (data) => {
          const footerY = pageHeight - 12;
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.3);
          doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3);
          
          doc.setFontSize(7);
          doc.setTextColor(128, 128, 128);
          doc.text('City of Kigali - Service Delivery Management System', pageWidth / 2, footerY, { align: 'center' });
          doc.text(`Report ID: SD-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`, pageWidth / 2, footerY + 4, { align: 'center' });
          doc.text(`Page ${data.pageNumber}`, pageWidth - margin, footerY, { align: 'right' });
        }
      });
    } else {
      doc.setFontSize(11);
      doc.setTextColor(100, 100, 100);
      doc.text('No visitors found', pageWidth / 2, yPosition + 30, { align: 'center' });
    }

    doc.save(`Service_Delivery_Visitors_${now.toISOString().split('T')[0]}.pdf`);
  }, [filteredVisitors]);

  // Loading state
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <LoadingSpinner message="Loading..." />
      </div>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-3">
              <HiOutlineClipboardList className="w-6 h-6 text-green-600" />
             Manage and monitor visitor services
            </h1>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={fetchDashboardData}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <FiRefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button 
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <FiDownload className="w-4 h-4" />
              Export PDF
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Visitors */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Visitors</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <FiUsers className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Currently Inside */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Currently Inside</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.inhouse}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <FiUserPlus className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          {/* Completed */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Completed</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.completed}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <FiCheckCircle className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          {/* Departments */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Departments</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {departmentCount}
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <FiClock className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Hourly Activity Chart */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Today's Visitor Activity</h2>
            <span className="text-sm text-gray-500">Hourly check-ins</span>
          </div>
          
          {(loading && firstLoad) ? (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-green-500 border-t-transparent"></div>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hourlyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis 
                    dataKey="hour" 
                    tickFormatter={(value) => `${value.toString().padStart(2, '0')}:00`}
                    stroke="#9ca3af"
                    fontSize={12}
                    label={{
                      value: 'Hour of Day',
                      position: 'insideBottom',
                      offset:0,
                      style: { fill: '#6b7280', fontSize: 11, fontWeight: 500 }
                    }}
                  />
                  <YAxis stroke="#9ca3af" fontSize={12}
                   label={{ 
                    value: 'Number of Visitors', 
                    angle: -90, 
                    position: 'insideLeft',
                    style: { fill: '#6b7280', fontSize: 12, fontWeight: 500, textAnchor: 'middle' },
                    offset: 20
            }}
                  />
                  <Tooltip 
                    formatter={(value: any) => [value || 0, 'Visitors']}
                    labelFormatter={(label) => `${label}:00`}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="visitors_checked_in" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorVisitors)" 
                    name="Visitors"
                    dot={false}
                    activeDot={{ r: 6, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Current Visitors Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Current Visitors</h2>
            <button 
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
            >
              <FiDownload className="w-4 h-4" />
              Export PDF
            </button>
          </div>
          
          {/* Filters */}
          <div className="px-5 py-3 bg-gray-50 flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="all">All Status</option>
              <option value="inside">Inside</option>
              <option value="left">Checked Out</option>
            </select>
          </div>

          {/* Table */}
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Visitor Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Department</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Assigned Staff</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Badge No.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Check-in</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Check-out</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-green-500 border-t-transparent mx-auto"></div>
                    </td>
                  </tr>
                ) : filteredVisitors.length > 0 ? (
                  filteredVisitors.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((visitor, index) => {
                    const statusDisplay = getStatusDisplay(visitor);
                    return (
                      <tr key={visitor._id || index} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className="font-medium text-gray-900">
                            {visitor.full_name || visitor.name || visitor.visitorName || '___'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {getDepartmentName(visitor)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={getAssignedStaff(visitor).includes('Not') ? 'text-orange-500' : 'text-gray-600'}>
                            {getAssignedStaff(visitor)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {visitor.badge_number || '___'}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {getCheckInTime(visitor)}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {getCheckOutTime(visitor)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            statusDisplay.color === 'green'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {statusDisplay.text}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No visitors found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredVisitors.length > 0 && (
            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredVisitors.length)} of {filteredVisitors.length} entries
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                {Array.from({ length: Math.ceil(filteredVisitors.length / itemsPerPage) }, (_, i) => i + 1).slice(
                  Math.max(0, currentPage - 3),
                  Math.min(Math.ceil(filteredVisitors.length / itemsPerPage), currentPage + 2)
                ).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1 border rounded-lg text-sm ${
                      currentPage === page
                        ? 'bg-green-600 text-white border-green-600'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredVisitors.length / itemsPerPage), p + 1))}
                  disabled={currentPage >= Math.ceil(filteredVisitors.length / itemsPerPage)}
                  className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default AdminServiceDeliveryDashboard;
