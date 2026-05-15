// SmartParkingDashboard - Admin Smart Parking Management Dashboard
// Features: Stats cards, hourly parking chart, parking records management, PDF report generation

import React, { useState, useEffect, useCallback } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useToast } from '../../../core/contexts/ToastContext';
import { useSocket } from '../../../core/contexts/SocketContext';
import { smartParkingService, statisticsService } from '../../../core/services/adminService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import LoadingSpinner from '../../../core/components/LoadingSpinner';
import {
  FiTruck, FiSearch, FiFlag, FiCheckCircle, FiX,
  FiArrowRight, FiDownload, FiFilter, FiCalendar, FiRefreshCw,
  FiMapPin, FiFileText, FiEdit
} from 'react-icons/fi';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// Types
interface ParkingRecord {
  _id: string;
  plate_number?: string;
  driver_name?: string;
  driver_telephone?: string;
  driver_type?: string;
  status?: string;
  check_in?: string;
  check_out?: string;
  slot_number?: string;
  is_flagged?: boolean;
}

interface HourlyData {
  hour: number;
  check_in: number;
  check_out: number;
}

interface ParkingStats {
  todayVehicles: number;
  currentlyParked: number;
  availableSlots: number;
  flaggedInside: number;
  totalCapacity: number;
}

const AdminSmartParkingDashboard: React.FC = () => {
   const { isAuthenticated, isLoading: authLoading } = useAuth();
   const navigate = useNavigate();
   const { showSuccess, showError } = useToast();
   const { socket, isConnected } = useSocket();

  // State
  const [loading, setLoading] = useState(true);
  const [firstLoad, setfirstLoad] = useState(true);
   const [stats, setStats] = useState<ParkingStats>({
     todayVehicles: 0,
     currentlyParked: 0,
     availableSlots: 0,
     flaggedInside: 0,
     totalCapacity: 0
   });
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
  const [recentRecords, setRecentRecords] = useState<ParkingRecord[]>([]);
  
   // Modal states
   const [showRecordsModal, setShowRecordsModal] = useState(false);
   const [allRecords, setAllRecords] = useState<ParkingRecord[]>([]);
   const [modalLoading, setModalLoading] = useState(false);
   const [searchQuery, setSearchQuery] = useState('');
   const [statusFilter, setStatusFilter] = useState('all');
   const [dateFrom, setDateFrom] = useState('');
   const [dateTo, setDateTo] = useState('');
   const [realtimeUpdate, setRealtimeUpdate] = useState<string | null>(null);
   const [showSlotConfigModal, setShowSlotConfigModal] = useState(false);
   const [savingSlotConfig, setSavingSlotConfig] = useState(false);

   // Slot configuration - will be loaded from backend
    const [slotConfig, setSlotConfig] = useState({
      totalSlots: 0,
      staffReservedSlots: 0,
      visitorReservedSlots: 0
    });
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const PAGE_SIZE = 20;

   // Total parking capacity - loaded from backend
   // (used directly from stats.totalCapacity)

// Fetch dashboard data
   const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch hourly parking stats
      const hourlyResponse = await statisticsService.getHourlyParkingStats();
      // API returns: { success: true, data: { hourly: [...], total_check_in: x, total_check_out: y } }
      const hourly = hourlyResponse?.data?.hourly || [];
      setHourlyData(hourly);

      // Calculate today's vehicles from hourly data
      const todayCheckIns = hourly.reduce((sum: number, h: HourlyData) => sum + h.check_in, 0);

      // Fetch currently parked
      const parkedResponse = await statisticsService.getCurrentlyParkedStats();
      // API returns: { success: true, data: { total: x, by_driver_type: {...} } }
      const currentlyParked = parkedResponse?.data?.total || 0;

      // Fetch flagged vehicles
      const flaggedResponse = await statisticsService.getFlaggedVehiclesStats();
      // API returns: { success: true, data: { total: x, currently_flagged: { count: x }, history: { count: y } } }
      const flaggedData = flaggedResponse?.data;
      const flaggedInside = flaggedData?.currently_flagged?.count || 0;
      
      // Fetch parking slots configuration
      const slotsResponse = await statisticsService.getParkingSlots();
      const slotsData = slotsResponse?.data?.available_slots || {};
       const totalCapacity = slotsData?.totalSlots || 0;

      // Update slot config for modal display
      setSlotConfig({
        totalSlots: slotsData?.totalSlots || 0,
        staffReservedSlots: slotsData?.staffReservedSlots || 0,
        visitorReservedSlots: slotsData?.visitorsReservedSlots || 0
      });

      setStats({
        todayVehicles: todayCheckIns,
        currentlyParked: currentlyParked,
        availableSlots: Math.max(0, totalCapacity - currentlyParked),
        flaggedInside: flaggedInside,
        totalCapacity: totalCapacity
      });

      // Fetch recent parking records
      const recordsResponse = await smartParkingService.getAll();
      const records = recordsResponse?.data || recordsResponse || [];
      setRecentRecords(Array.isArray(records) ? records.slice(0, 10) : []);
    } catch (error) {
      console.error('Error fetching parking data:', error);
    } finally {
      setLoading(false);
      setfirstLoad(false);
    }
  }, []);

  // Fetch records for modal with pagination
  const fetchAllRecords = useCallback(async (page: number = 1) => {
    setModalLoading(true);
    try {
      // Build query parameters for server-side filtering
      let statusParam = statusFilter !== 'all' ? statusFilter : 'all';
      
      const response = await smartParkingService.getAllPaginated(page, PAGE_SIZE);
      
      // Handle response structure
      let records: ParkingRecord[] = [];
      let total = 0;
      
      if (response?.data && Array.isArray(response.data)) {
        records = response.data;
        total = response.total || 0;
      } else if (Array.isArray(response)) {
        records = response;
        total = response.length;
      }
      
      // Apply client-side filters for search and date range
      // (Backend supports status filter but not search/date filters)
      if (records.length > 0) {
        // Filter by search
        if (searchQuery) {
          records = records.filter((r: ParkingRecord) => 
            r.plate_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            r.driver_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            r.driver_telephone?.includes(searchQuery)
          );
        }
        
        // Filter by status (if not already filtered by backend)
        if (statusFilter !== 'all') {
          records = records.filter((r: ParkingRecord) => r.status === statusFilter);
        }
        
        // Filter by date range
        if (dateFrom) {
          records = records.filter((r: ParkingRecord) => 
            r.check_in && new Date(r.check_in) >= new Date(dateFrom)
          );
        }
        if (dateTo) {
          records = records.filter((r: ParkingRecord) => 
            r.check_in && new Date(r.check_in) <= new Date(dateTo + 'T23:59:59')
          );
        }
      }
      
      setAllRecords(records);
      setTotalRecords(total);
      setTotalPages(Math.ceil(total / PAGE_SIZE));
      setCurrentPage(page);
    } catch (error) {
      console.error('Error fetching records:', error);
      setAllRecords([]);
      setTotalRecords(0);
      setTotalPages(1);
    } finally {
      setModalLoading(false);
    }
  }, [searchQuery, statusFilter, dateFrom, dateTo]);

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

  // Listen to real-time smart parking events and auto-refetch
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleCarCheckedIn = (data: any) => {
      // Show notification and auto-refetch dashboard data when a car is checked in
      setRealtimeUpdate(data?.message || 'New vehicle checked in');
      // Only refetch dashboard if modal is not open to prevent looping
      if (!showRecordsModal) {
        fetchDashboardData();
      }
    };

    const handleCarCheckedOut = (data: any) => {
      // Show notification and auto-refetch dashboard data when a car is checked out
      setRealtimeUpdate(data?.message || 'Vehicle checked out');
      // Only refetch dashboard if modal is not open to prevent looping
      if (!showRecordsModal) {
        fetchDashboardData();
      }
    };

    const handleVisitorCheckedIn = (data: any) => {
      // Show notification and auto-refetch dashboard data when a visitor is checked in
      setRealtimeUpdate(data?.message || 'New visitor checked in');
      // Only refetch dashboard if modal is not open to prevent looping
      if (!showRecordsModal) {
        fetchDashboardData();
      }
    };

    const handleVisitorCheckedOut = (data: any) => {
      // Show notification and auto-refetch dashboard data when a visitor is checked out
      setRealtimeUpdate(data?.message || 'Visitor checked out');
      // Only refetch dashboard if modal is not open to prevent looping
      if (!showRecordsModal) {
        fetchDashboardData();
      }
    };

    // Subscribe to smart parking events
    socket.on('car_checkedin', handleCarCheckedIn);
    socket.on('car_checkedout', handleCarCheckedOut);
    socket.on('visitor_checkedin', handleVisitorCheckedIn);
    socket.on('visitor_checkedout', handleVisitorCheckedOut);

    // Cleanup on unmount or when socket changes
    return () => {
      socket.off('car_checkedin', handleCarCheckedIn);
      socket.off('car_checkedout', handleCarCheckedOut);
      socket.off('visitor_checkedin', handleVisitorCheckedIn);
      socket.off('visitor_checkedout', handleVisitorCheckedOut);
    };
  }, [socket, isConnected, fetchDashboardData, showRecordsModal]);

   // Clear real-time update notification after 3 seconds
   useEffect(() => {
     if (realtimeUpdate) {
       const timer = setTimeout(() => {
         setRealtimeUpdate(null);
       }, 3000);
       return () => clearTimeout(timer);
     }
   }, [realtimeUpdate]);

    // Slot configuration change handler
    const handleSlotConfigChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setSlotConfig(prev => ({ ...prev, [name]: value === '' ? 0 : parseInt(value) || 0 }));
    };

    // Save slot configuration
    const handleSaveSlotConfig = async () => {
      setSavingSlotConfig(true);
      try {
        const response = await smartParkingService.updateSlotConfig(slotConfig);

        if (response.success) {
          showSuccess('Slot configuration updated successfully');
          setShowSlotConfigModal(false);
          // Refetch dashboard data to reflect changes
          fetchDashboardData();
        } else {
          showError(response.message || 'Failed to update slot configuration');
        }
      } catch (err: any) {
        console.error('Error saving slot config:', err);
        showError(err?.message || 'Failed to update slot configuration');
      } finally {
        setSavingSlotConfig(false);
      }
    };

    const calculateRegularSlots = () => {
      return Math.max(0, slotConfig.totalSlots - slotConfig.staffReservedSlots - slotConfig.visitorReservedSlots);
    };

  // Open records modal
  const handleOpenRecordsModal = useCallback(() => {
    setShowRecordsModal(true);
    setCurrentPage(1);
    fetchAllRecords(1);
  }, [fetchAllRecords]);

  // Format date for PDF
  const formatDateForPDF = (date: Date): string => {
    return date.toLocaleDateString('en-GB', { 
      weekday: 'long', 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  // Truncate text for PDF
  const truncateText = (text: string, maxLength: number): string => {
    if (!text) return 'N/A';
    return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
  };

  // Download PDF Report with centered logo, underlined header, and centered table
  const handleDownloadReport = useCallback(() => {
    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape mode
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    let yPosition = 15;

    // Center Logo - Bigger size
    const logoWidth = 40;
    const logoHeight = 40;
    const logoX = (pageWidth - logoWidth) / 2;
    
    try {
      doc.addImage('/LOGO_COK.png', 'PNG', logoX, yPosition, logoWidth, logoHeight);
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
    doc.text(`${formatDateForPDF(now)}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 5;
    doc.text(`${now.toLocaleTimeString()}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 12;

    // Underlined Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(41, 95, 115);
    const headerText = 'PARKING RECORDS REPORT';
    const headerWidth = doc.getTextWidth(headerText);
    doc.text(headerText, pageWidth / 2, yPosition, { align: 'center' });
    
    // Underline
    doc.setDrawColor(41, 95, 115);
    doc.setLineWidth(0.8);
    const underlineY = yPosition + 2;
    doc.line((pageWidth - headerWidth) / 2 - 5, underlineY, (pageWidth + headerWidth) / 2 + 5, underlineY);
    yPosition += 15;

    // Parking Records Table - Centered
    if (allRecords.length > 0) {
      const recordsTableData = allRecords.slice(0, 200).map(record => [
        truncateText(record.plate_number || 'N/A', 12),
        truncateText(record.driver_name || 'N/A', 20),
        truncateText(record.driver_telephone || 'N/A', 15),
        truncateText(record.driver_type || 'N/A', 12),
        record.status === 'active' ? 'Active' : record.status === 'completed' ? 'Completed' : 'N/A',
        record.check_in ? new Date(record.check_in).toLocaleString().substring(0, 16) : 'N/A',
        record.check_out ? new Date(record.check_out).toLocaleString().substring(0, 16) : 'N/A'
      ]);

      // Calculate table width to center it
      const tableWidth = 280; // Total table width
      const tableStartX = (pageWidth - tableWidth) / 2;
      
      autoTable(doc, {
        startY: yPosition,
        head: [['Plate No.', 'Driver Name', 'Phone', 'Type', 'Status', 'Check-in Time', 'Check-out Time']],
        body: recordsTableData,
        theme: 'grid',
        headStyles: {
          fillColor: [41, 95, 115],
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
          0: { cellWidth: 32, halign: 'center' },
          1: { cellWidth: 52, halign: 'left' },
          2: { cellWidth: 38, halign: 'center' },
          3: { cellWidth: 32, halign: 'center' },
          4: { cellWidth: 30, halign: 'center' },
          5: { cellWidth: 48, halign: 'center' },
          6: { cellWidth: 48, halign: 'center' }
        },
        margin: { left: tableStartX, right: tableStartX },
        tableWidth: tableWidth,
        tableLineWidth: 0.2,
        styles: {
          overflow: 'linebreak',
          lineWidth: 0.2,
          lineColor: [180, 180, 180]
        },
        alternateRowStyles: {
          fillColor: [245, 247, 250]
        },
        pageBreak: 'auto',
        didDrawPage: (data) => {
          // Add footer on each page
          const footerY = pageHeight - 12;
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.3);
          doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3);
          
          doc.setFontSize(7);
          doc.setTextColor(128, 128, 128);
          doc.text('City of Kigali - Smart Parking Management System', pageWidth / 2, footerY, { align: 'center' });
          doc.text(`Report ID: SP-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`, pageWidth / 2, footerY + 4, { align: 'center' });
          doc.text(`Page ${data.pageNumber}`, pageWidth - margin, footerY, { align: 'right' });
        }
      });
    } else {
      doc.setFontSize(11);
      doc.setTextColor(100, 100, 100);
      doc.text('No parking records found', pageWidth / 2, yPosition + 30, { align: 'center' });
    }

    // Save the PDF
    doc.save(`Parking_Records_${now.toISOString().split('T')[0]}.pdf`);
  }, [allRecords]);

  // Loading state
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <LoadingSpinner message="Loading dashboard..." />
      </div>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Real-time Update Notification */}
        {realtimeUpdate && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3 animate-pulse">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>
            <p className="text-sm text-blue-700 font-medium">{realtimeUpdate}</p>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Manage and monitor parking operations in real-time</h1>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={fetchDashboardData}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              disabled={loading}
            >
              <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Today Vehicles */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Today's Vehicles</p>
                {(loading && firstLoad )? (
                  <div className="h-8 w-16 bg-gray-200 rounded animate-pulse mt-1"></div>
                ) : (
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.todayVehicles}</p>
                )}
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <FiTruck className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Currently Parked */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Currently Parked</p>
                {(loading && firstLoad) ? (
                  <div className="h-8 w-16 bg-gray-200 rounded animate-pulse mt-1"></div>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{stats.currentlyParked}</p>
                    <p className="text-xs text-gray-400 mt-1">{((stats.currentlyParked / stats.totalCapacity) * 100).toFixed(1)}% occupied</p>
                  </>
                )}
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <FiCheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          {/* Available Slots */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Available Slots</p>
                {(loading && firstLoad) ? (
                  <div className="h-8 w-16 bg-gray-200 rounded animate-pulse mt-1"></div>
                ) : (
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.availableSlots}</p>
                )}
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <FiMapPin className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          {/* Flagged Vehicles */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Flagged Vehicles</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  <span className="text-orange-600">{stats.flaggedInside}</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">Currently</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <FiFlag className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>
         </div>

         {/* Slot Configuration Button */}
         <div className="flex justify-center">
           <button
             onClick={() => setShowSlotConfigModal(true)}
             className="w-full max-w-xs group backdrop-blur-xl bg-gradient-to-br from-indigo-500/20 to-blue-500/20 hover:from-indigo-500/30 hover:to-blue-500/30 rounded-2xl p-4 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-indigo-200/30"
           >
             <div className="flex items-center justify-center gap-2 flex-col h-full">
               <div className="p-2 bg-white/20 backdrop-blur rounded-xl group-hover:scale-110 transition-transform">
                 <FiEdit className="w-5 h-5 text-indigo-700" />
               </div>
               <p className="text-indigo-700 text-sm font-medium text-center">Slot Configuration</p>
             </div>
           </button>
</div>

        {/* Parking Usage Chart */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
  <div className="flex items-center justify-between mb-4">
    <h2 className="text-lg font-semibold text-gray-900">Parking Usage Trends</h2>
    <span className="text-sm text-gray-500">Today's hourly activity</span>
  </div>
  
  {(loading && firstLoad) ? (
    <div className="h-64 flex items-center justify-center">
      <LoadingSpinner message="Loading chart data..." />
    </div>
  ) : (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={hourlyData} margin={{ top: 20, right: 30, left: 20, bottom: 25 }}>
          <defs>
            <linearGradient id="colorCheckIn" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorCheckOut" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis
            dataKey="hour"
            tickFormatter={(value: number) => `${value.toString().padStart(2, '0')}:00`}
            stroke="#9ca3af"
            tick={{ fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            stroke="#9ca3af"
            tick={{ fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            label={{ 
              value: 'Number of Vehicles', 
              angle: -90, 
              position: 'insideLeft',
              style: { fill: '#6b7280', fontSize: 12, fontWeight: 500, textAnchor: 'middle' },
              offset: 0
            }}
          />
          <Tooltip 
           
            labelFormatter={(label) => `${label}:00`}
            contentStyle={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.95)', 
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}
          />
          <Legend />
          <Area 
            type="monotone" 
            dataKey="check_in" 
            stroke="#3b82f6" 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#colorCheckIn)" 
            name="Check-ins"
            dot={false}
            activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
          />
          <Area 
            type="monotone" 
            dataKey="check_out" 
            stroke="#ef4444" 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#colorCheckOut)" 
            name="Check-outs"
            dot={false}
            activeDot={{ r: 6, fill: '#ef4444', stroke: '#fff', strokeWidth: 2 }}
          />
</AreaChart>
       </ResponsiveContainer>
      </div>
     )}
  </div>

               {/* Slot Configuration Modal */}
         {showSlotConfigModal && (
           <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
             <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-md mx-2 sm:mx-auto overflow-hidden border border-white/50 animate-scaleIn">
               <div className="px-6 py-4 flex items-center justify-between border-b border-indigo-100 bg-gradient-to-r from-indigo-50 to-blue-50">
                 <h3 className="text-xl font-bold text-gray-900">Parking Slot Configuration</h3>
                 <button
                   onClick={() => setShowSlotConfigModal(false)}
                   className="p-2 hover:bg-white/20 rounded-full transition-colors"
                 >
                   <FiX className="w-5 h-5 text-gray-600" />
                 </button>
               </div>

               <div className="p-6 space-y-6">
                 {/* Total Slots */}
                 <div>
                   <label className="block text-sm font-semibold text-gray-700 mb-2">Total Slots</label>
                   <input
                     type="number"
                     name="totalSlots"
                     value={slotConfig.totalSlots || ''}
                     onChange={handleSlotConfigChange}
                     className="w-full px-4 py-3 bg-white/50 backdrop-blur border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm"
                     min="0"
                     placeholder="0"
                   />
                   <p className="text-xs text-gray-500 mt-1">Total parking capacity</p>
                 </div>

                 {/* Staff Reserved Slots */}
                 <div>
                   <label className="block text-sm font-semibold text-gray-700 mb-2">Staff Reserved Slots</label>
                   <input
                     type="number"
                     name="staffReservedSlots"
                     value={slotConfig.staffReservedSlots || ''}
                     onChange={handleSlotConfigChange}
                     className="w-full px-4 py-3 bg-white/50 backdrop-blur border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm"
                     min="0"
                     placeholder="0"
                   />
                   <p className="text-xs text-gray-500 mt-1">Slots reserved for staff vehicles</p>
                 </div>

                 {/* Visitor Reserved Slots */}
                 <div>
                   <label className="block text-sm font-semibold text-gray-700 mb-2">Visitor Reserved Slots</label>
                   <input
                     type="number"
                     name="visitorReservedSlots"
                     value={slotConfig.visitorReservedSlots || ''}
                     onChange={handleSlotConfigChange}
                     className="w-full px-4 py-3 bg-white/50 backdrop-blur border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm"
                     min="0"
                     placeholder="0"
                   />
                   <p className="text-xs text-gray-500 mt-1">Slots reserved for visitor vehicles</p>
                 </div>

                 {/* Computed Regular Slots */}
                 <div className="p-4 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 rounded-xl border border-blue-100">
                   <div className="flex justify-between items-center">
                     <span className="text-sm font-medium text-gray-700">Regular Available Slots:</span>
                     <span className="text-xl font-bold text-blue-600">{calculateRegularSlots()}</span>
                   </div>
                   <p className="text-xs text-gray-500 mt-1">
                     Automatically calculated: Total - Staff Reserved - Visitor Reserved
                   </p>
                 </div>
               </div>

              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex gap-3">
                <button
                  onClick={() => setShowSlotConfigModal(false)}
                  className="flex-1 py-3 px-4 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSlotConfig}
                  disabled={savingSlotConfig}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-xl font-medium hover:from-indigo-600 hover:to-blue-600 shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingSlotConfig ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Saving...
                    </>
                  ) : (
                    'Save Configuration'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
          {/* Global Styles for Animations */}
          <style>{`
            @keyframes scaleIn {
              from {
                opacity: 0;
                transform: scale(0.9);
              }
              to {
                opacity: 1;
                transform: scale(1);
              }
            }

            .animate-scaleIn {
              animation: scaleIn 0.2s ease-out;
            }
          `}</style>
        </div>
        </MainLayout>
     );
   };

export default AdminSmartParkingDashboard;