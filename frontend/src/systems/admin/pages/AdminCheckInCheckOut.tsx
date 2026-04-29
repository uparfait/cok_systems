// AdminCheckInCheckOut - Admin Check-In/Check-Out Management Page
// Features: Manual check-in/out, visitor search, status management, pagination, PDF export

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { serviceDeliveryService } from '../../../core/services/adminService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import LoadingSpinner from '../../../core/components/LoadingSpinner';
import { useToast } from '../../../core/contexts/ToastContext';
import {
  FiUserPlus, FiUserMinus, FiSearch, FiRefreshCw, FiCheckCircle, FiX,
  FiClock, FiPhone, FiMail, FiDownload
} from 'react-icons/fi';
import { HiOutlineClipboardList } from 'react-icons/hi';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ==================== TYPES ====================
interface Visitor {
  _id: string;
  full_name?: string;
  name?: string;
  visitorName?: string;
  telephone?: string;
  phone?: string;
  email?: string;
  identification?: {
    id_type?: string;
    number?: string;
  };
  badge_number?: string;
  department?: string;
  departmentName?: string;
  departments_assigned?: Array<{
    department_id: string;
    department_name: string;
    assigned_time: Date;
    reached_in: boolean;
    provider_name: string;
    provider_id: string;
  }>;
  purpose?: string;
  status?: string;
  checkInTime?: string;
  checkIn?: string;
  checkOutTime?: string;
  checkOut?: string;
  entry_date?: string;
  exist_date?: string;
  exit_date?: string;
  is_still_inhouse?: boolean;
  marked_as_out?: boolean;
  durations?: {
    services_durations?: Array<{
      department_id: string;
      department_name: string;
      duration: string;
      started_at: Date;
      ended_at: Date;
      provider_name: string;
      provider_id: string;
    }>;
    entry_and_leave_duration?: string;
  };
  current_duration?: string;
  current_duration_hours?: number;
  services_status?: Array<{
    s_type: string;
    status: string;
    notes?: string;
  }>;
}



// ==================== CONSTANTS ====================
const DEFAULT_PAGE_SIZE = 50;

// ==================== MAIN COMPONENT ====================
const AdminCheckInCheckOut: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  // ==================== STATE ====================
  const [loading, setLoading] = useState(true);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [filteredVisitors, setFilteredVisitors] = useState<Visitor[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'inside' | 'left' | 'pending'>('inside');
  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);
  const [firstLoad, setFirstLoad] = useState(true);
  


  // ==================== DERIVED STATE ====================
  // Calculate statistics from visitors data (used for stats cards and tabs)
  const insideCount = useMemo(() => 
    visitors.filter(v => (v.is_still_inhouse || v.status === 'Inside') && !v.marked_as_out).length,
    [visitors]
  );
  
  const pendingExitCount = useMemo(() => 
    visitors.filter(v => v.is_still_inhouse && v.marked_as_out).length,
    [visitors]
  );
  
  const leftCount = useMemo(() => 
    visitors.filter(v => !v.is_still_inhouse && v.status !== 'Inside' && !v.marked_as_out).length,
    [visitors]
  );

  // Real totals for cards (fetched separately)
  const [realInsideCount, setRealInsideCount] = useState(0);
  const [realPendingExitCount, setRealPendingExitCount] = useState(0);
  const [realLeftCount, setRealLeftCount] = useState(0);

  // ==================== DATA FETCHING ====================
  // Fetch real counts for cards (inside, pending, left)
  const fetchRealCounts = useCallback(async () => {
    try {
      // Fetch inside count
      const insideResponse = await serviceDeliveryService.getAll(1, 1, true);
      const insideTotal = insideResponse?.total || 0;
      setRealInsideCount(insideTotal);

      // Fetch left count
      const leftResponse = await serviceDeliveryService.getAll(1, 1, false);
      const leftTotal = leftResponse?.total || 0;
      setRealLeftCount(leftTotal);
    } catch (error) {
      console.error('Error fetching real counts:', error);
    }
  }, []);

  const fetchVisitors = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all visitors without pagination
      const response = await serviceDeliveryService.getAll(1, 1000); // Get a large number to get all records
      const data = response?.data || [];

      const visitorsData = Array.isArray(data) ? data : [];
      setVisitors(visitorsData);

      // Calculate pending exit count from fetched data
      const pendingCount = visitorsData.filter(v => v.is_still_inhouse && v.marked_as_out).length;
      setRealPendingExitCount(pendingCount);
    } catch (error) {
      console.error('Error fetching visitors:', error);
      showError('Failed to load visitors');
    } finally {
      setLoading(false);
      setFirstLoad(false);
    }
  }, [showError]);

  // ==================== SEARCH HANDLERS ====================
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      fetchVisitors();
      return;
    }

    setLoading(true);
    try {
      // Search visitors without in_house filter (pass 'all' to search all)
      const response = await serviceDeliveryService.searchVisitors(searchQuery, 1, 1000, 'all' as any);
      const data = response?.data || [];
      const visitorsData = Array.isArray(data) ? data : [];
      setVisitors(visitorsData);

      // Calculate pending exit count from search results
      const pendingCount = visitorsData.filter(v => v.is_still_inhouse && v.marked_as_out).length;
      setRealPendingExitCount(pendingCount);
    } catch (error) {
      console.error('Error searching visitors:', error);
      showError('Failed to search visitors');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, fetchVisitors, showError]);

  // ==================== FILTER VISITORS ====================
  useEffect(() => {
    let filtered = [...visitors];

    // Filter by tab (inside/left/pending)
    if (activeTab === 'inside') {
      // Currently inside (not marked as out)
      filtered = filtered.filter(v => (v.is_still_inhouse || v.status === 'Inside') && !v.marked_as_out);
    } else if (activeTab === 'pending') {
      // Pending exit (marked as out but still inhouse) - partial exit
      filtered = filtered.filter(v => v.is_still_inhouse && v.marked_as_out);
    } else {
      // Left (fully checked out)
      filtered = filtered.filter(v => !v.is_still_inhouse && v.status !== 'Inside' && !v.marked_as_out);
    }

    // Filter by search
    if (searchQuery) {
      filtered = filtered.filter(v =>
        (v.full_name || v.name || v.visitorName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.telephone || v.phone || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.badge_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.identification?.number || '').toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredVisitors(filtered);
  }, [visitors, searchQuery, activeTab]);

  // ==================== CHECK-IN/OUT HANDLERS ====================
  const handleCheckIn = async (visitor: Visitor) => {
    try {
      const response = await serviceDeliveryService.checkIn({
        full_name: visitor.full_name || visitor.name || visitor.visitorName,
        telephone: visitor.telephone || visitor.phone,
        badge_number: visitor.badge_number,
        identification: visitor.identification
      });
      
      if (response?.success) {
        showSuccess('Visitor checked in successfully');
        fetchVisitors();
        fetchRealCounts();
      } else {
        showError(response?.message || 'Failed to check in visitor');
      }
    } catch (error: any) {
      console.error('Error checking in visitor:', error);
      showError(error?.response?.data?.message || 'Failed to check in visitor');
    }
  };

  const handleCheckOut = async (visitor: Visitor) => {
    try {
      const response = await serviceDeliveryService.checkOut(visitor._id);
      
      if (response?.success) {
        showSuccess('Visitor checked out successfully');
        fetchVisitors();
        fetchRealCounts();
      } else {
        showError(response?.message || 'Failed to check out visitor');
      }
    } catch (error: any) {
      console.error('Error checking out visitor:', error);
      showError(error?.response?.data?.message || 'Failed to check out visitor');
    }
  };



  // ==================== UTILITY FUNCTIONS ====================
  const formatDuration = (visitor: Visitor) => {
    if (visitor.current_duration) return visitor.current_duration;
    if (visitor.durations?.entry_and_leave_duration) return visitor.durations.entry_and_leave_duration;
    return '-';
  };

  const formatDate = (dateValue: string | Date | undefined): string => {
    if (!dateValue) return '-';
    try {
      return new Date(dateValue).toLocaleString();
    } catch {
      return '-';
    }
  };

  const getDepartmentName = (visitor: Visitor) => {
    if (visitor.department || visitor.departmentName) {
      return visitor.department || visitor.departmentName;
    }
    if (visitor.departments_assigned && visitor.departments_assigned.length > 0) {
      return visitor.departments_assigned[0].department_name;
    }
    return 'Not Assigned';
  };

  // ==================== PDF EXPORT ====================
  const downloadPDF = useCallback(() => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = 15;

    // Full-width logo at top
    const logoHeight = 40;
    const logoWidth = pageWidth;
    
    try {
      doc.addImage('/LOGO_COK_report.png', 'PNG', 0, yPosition, logoWidth, logoHeight);
    } catch (e) {
      console.log('Logo not found, continuing without logo');
    }
    yPosition += logoHeight + 8;

    // Republic of Rwanda - Centered
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('REPUBLIC OF RWANDA', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 7;

    // City of Kigali - Centered
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('CITY OF KIGALI', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 12;

    // Date and Time - Centered
    const now = new Date();
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`${now.toLocaleDateString()}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 5;
    doc.text(`${now.toLocaleTimeString()}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 12;

    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(34, 197, 94);
    const headerText = 'VISITOR CHECK-IN / CHECK-OUT REPORT';
    const headerWidth = doc.getTextWidth(headerText);
    doc.text(headerText, pageWidth / 2, yPosition, { align: 'center' });
    
    // Underline
    doc.setDrawColor(34, 197, 94);
    doc.setLineWidth(0.8);
    const underlineY = yPosition + 2;
    doc.line((pageWidth - headerWidth) / 2 - 5, underlineY, (pageWidth + headerWidth) / 2 + 5, underlineY);
    yPosition += 15;

    // Get visitors by category
    const insideVisitors = visitors.filter(v => (v.is_still_inhouse || v.status === 'Inside') && !v.marked_as_out);
    const pendingVisitors = visitors.filter(v => v.is_still_inhouse && v.marked_as_out);
    const checkedOutVisitors = visitors.filter(v => !v.is_still_inhouse && v.status !== 'Inside' && !v.marked_as_out);

    const truncateText = (text: string | undefined, maxLength: number) => {
      if (!text) return 'N/A';
      return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    };

    const formatDateForPDF = (dateStr: string | undefined) => {
      if (!dateStr) return 'N/A';
      try {
        return new Date(dateStr).toLocaleString().substring(0, 16);
      } catch {
        return 'N/A';
      }
    };

    // Table 1: Currently Inside
    if (insideVisitors.length > 0) {
      const insideTableData = insideVisitors.map(visitor => [
        truncateText(visitor.full_name || visitor.name || visitor.visitorName || 'N/A', 20),
        truncateText(visitor.identification?.number || '-', 15),
        truncateText(visitor.badge_number || '-', 10),
        formatDateForPDF(visitor.entry_date),
        formatDuration(visitor),
        truncateText(getDepartmentName(visitor), 20)
      ]);

      autoTable(doc, {
        startY: yPosition,
        head: [['Visitor Name', 'ID Number', 'Badge', 'Entry Time', 'Duration', 'Department']],
        body: insideTableData,
        theme: 'grid',
        headStyles: {
          fillColor: [34, 197, 94],
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: 'bold'
        },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [240, 255, 240] },
        margin: { left: 10, right: 10 },
        tableWidth: 'auto'
      });

      yPosition = (doc as any).lastAutoTable.finalY + 10;
    }

    // Table 2: Pending Exit
    if (pendingVisitors.length > 0) {
      if (yPosition > pageHeight - 60) {
        doc.addPage();
        yPosition = 15;
      }

      const pendingTableData = pendingVisitors.map(visitor => [
        truncateText(visitor.full_name || visitor.name || visitor.visitorName || 'N/A', 20),
        truncateText(visitor.identification?.number || '-', 15),
        truncateText(visitor.badge_number || '-', 10),
        formatDateForPDF(visitor.entry_date),
        formatDuration(visitor),
        truncateText(getDepartmentName(visitor), 20)
      ]);

      autoTable(doc, {
        startY: yPosition,
        head: [['Visitor Name', 'ID Number', 'Badge', 'Entry Time', 'Duration', 'Department']],
        body: pendingTableData,
        theme: 'grid',
        headStyles: {
          fillColor: [249, 115, 22],
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: 'bold'
        },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [255, 251, 235] },
        margin: { left: 10, right: 10 },
        tableWidth: 'auto'
      });

      yPosition = (doc as any).lastAutoTable.finalY + 10;
    }

    // Table 3: Checked Out
    if (checkedOutVisitors.length > 0) {
      if (yPosition > pageHeight - 60) {
        doc.addPage();
        yPosition = 15;
      }

      const checkedOutTableData = checkedOutVisitors.map(visitor => [
        truncateText(visitor.full_name || visitor.name || visitor.visitorName || 'N/A', 20),
        truncateText(visitor.identification?.number || '-', 15),
        truncateText(visitor.badge_number || '-', 10),
        formatDateForPDF(visitor.entry_date),
        formatDateForPDF(visitor.exist_date),
        formatDuration(visitor),
        truncateText(getDepartmentName(visitor), 20)
      ]);

      autoTable(doc, {
        startY: yPosition,
        head: [['Visitor Name', 'ID Number', 'Badge', 'Entry Time', 'Exit Time', 'Duration', 'Department']],
        body: checkedOutTableData,
        theme: 'grid',
        headStyles: {
          fillColor: [107, 114, 128],
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: 'bold'
        },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        margin: { left: 10, right: 10 },
        tableWidth: 'auto'
      });

      yPosition = (doc as any).lastAutoTable.finalY + 10;
    }

    doc.save(`visitor-report-${new Date().toISOString().split('T')[0]}.pdf`);
    showSuccess('Report downloaded successfully');
  }, [visitors, showSuccess, formatDuration, getDepartmentName]);

  // ==================== EFFECTS ====================
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      fetchVisitors();
      fetchRealCounts();
    }
  }, [isAuthenticated, authLoading, fetchVisitors, fetchRealCounts]);

  // ==================== RENDER ====================
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
              Manage visitor check-ins and check-outs
            </h1>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={downloadPDF}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FiDownload className="w-4 h-4" />
              Download Report
            </button>
            <button
              onClick={() => fetchVisitors()}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <FiRefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Currently Inside</p>
                {(loading && firstLoad) ? (
                  <div className="h-8 w-16 bg-gray-200 rounded animate-pulse mt-1" />
                ) : (
                  <p className="text-2xl font-bold text-green-600 mt-1">{realInsideCount}</p>
                )}
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <FiUserPlus className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Pending Exit</p>
                {(loading && firstLoad) ? (
                  <div className="h-8 w-16 bg-gray-200 rounded animate-pulse mt-1" />
                ) : (
                  <p className="text-2xl font-bold text-orange-600 mt-1">{realPendingExitCount}</p>
                )}
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <FiClock className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Checked Out</p>
                {(loading && firstLoad) ? (
                  <div className="h-8 w-16 bg-gray-200 rounded animate-pulse mt-1" />
                ) : (
                  <p className="text-2xl font-bold text-gray-900 mt-1">{realLeftCount}</p>
                )}
              </div>
              <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                <FiUserMinus className="w-6 h-6 text-gray-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Records</p>
                {(loading && firstLoad) ? (
                  <div className="h-8 w-16 bg-gray-200 rounded animate-pulse mt-1" />
                ) : (
                   <p className="text-2xl font-bold text-gray-900 mt-1">{visitors.length}</p>
                )}
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <HiOutlineClipboardList className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 max-h-[600px] flex flex-col">
          <div className="border-b border-gray-100">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('inside')}
                className={`py-4 px-6 text-sm font-medium border-b-2 ${
                  activeTab === 'inside'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <FiUserPlus className="inline-block w-4 h-4 mr-2" />
                Currently Inside ({realInsideCount})
              </button>
              <button
                onClick={() => setActiveTab('pending')}
                className={`py-4 px-6 text-sm font-medium border-b-2 ${
                  activeTab === 'pending'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <FiClock className="inline-block w-4 h-4 mr-2" />
                Pending Exit ({pendingExitCount})
              </button>
              <button
                onClick={() => setActiveTab('left')}
                className={`py-4 px-6 text-sm font-medium border-b-2 ${
                  activeTab === 'left'
                    ? 'border-gray-500 text-gray-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <FiUserMinus className="inline-block w-4 h-4 mr-2" />
                Checked Out ({realLeftCount})
              </button>
            </nav>
          </div>

          {/* Search Bar */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between gap-4">
              <div className="relative max-w-md flex-1">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, phone, badge, or ID number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
              <button 
                onClick={handleSearch}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Search
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
            <table className="w-full">
            <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
              <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Visitor Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">ID Number</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Badge</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Entry Time</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Exit Time</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Duration</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Department</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(loading && firstLoad) ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-green-500 border-t-transparent mx-auto" />
                    </td>
                  </tr>
                ) : filteredVisitors.length > 0 ? (
                  filteredVisitors.map((visitor, index) => (
                    <tr key={visitor._id || index} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                            <span className="text-green-600 font-medium text-sm">
                              {(visitor.full_name || visitor.name || visitor.visitorName || 'V').charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="font-medium text-gray-900">
                            {visitor.full_name || visitor.name || visitor.visitorName || 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {visitor.identification?.number || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {visitor.badge_number || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {formatDate(visitor.entry_date)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {formatDate(visitor.exist_date)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {formatDuration(visitor)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {getDepartmentName(visitor)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          visitor.is_still_inhouse 
                            ? (visitor.marked_as_out 
                                ? 'bg-orange-100 text-orange-800' 
                                : 'bg-green-100 text-green-800')
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {visitor.is_still_inhouse 
                            ? (visitor.marked_as_out ? 'Pending Exit' : 'Inside') 
                            : 'Checked Out'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      No visitors found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>


        </div>
      </div>
    </MainLayout>
  );
};

export default AdminCheckInCheckOut;