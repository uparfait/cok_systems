// SmartParkingDashboard - Admin Smart Parking Management Dashboard
// Features: Stats cards, hourly parking chart, parking records management, PDF report generation

import React, { useState, useEffect, useCallback } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useSocket } from '../../../core/contexts/SocketContext';
import { smartParkingService, statisticsService, parkingService } from '../../../core/services/adminService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import LoadingSpinner from '../../../core/components/LoadingSpinner';
import { 
  FiTruck, FiSearch, FiClock, FiAlertTriangle, FiFlag, FiCheckCircle, FiX,
  FiArrowRight, FiDownload, FiFilter, FiCalendar, FiRefreshCw, FiEdit2,
  FiCheck, FiMapPin, FiUser, FiPhone, FiMail, FiFileText
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
  flaggedOutside: number;
  totalCapacity: number;
}

const AdminSmartParkingDashboard: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { socket, isConnected } = useSocket();

  // State
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ParkingStats>({
    todayVehicles: 0,
    currentlyParked: 0,
    availableSlots: 0,
    flaggedInside: 0,
    flaggedOutside: 0,
    totalCapacity: 100
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

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch hourly parking stats
      const hourlyResponse = await statisticsService.getHourlyParkingStats();
      const hourly = hourlyResponse?.data?.hourly || hourlyResponse?.hourly || [];
      setHourlyData(hourly);

      // Fetch currently parked
      const parkedResponse = await statisticsService.getCurrentlyParkedStats();
      const parkedData = parkedResponse?.data?.data || parkedResponse?.data || parkedResponse;
      const currentlyParked = parkedData?.total || 0;

      // Fetch flagged vehicles
      const flaggedResponse = await statisticsService.getFlaggedVehiclesStats();
      const flaggedData = flaggedResponse?.data?.data || flaggedResponse?.data || flaggedResponse;
      
      // Fetch today's check-ins from hourly data
      const todayCheckIns = hourly.reduce((sum: number, h: HourlyData) => sum + h.check_in, 0);

      setStats({
        todayVehicles: todayCheckIns,
        currentlyParked: currentlyParked,
        availableSlots: Math.max(0, stats.totalCapacity - currentlyParked),
        flaggedInside: flaggedData?.currently_flagged?.count || 0,
        flaggedOutside: flaggedData?.history?.count || 0,
        totalCapacity: 100
      });

      // Fetch recent parking records
      const recordsResponse = await smartParkingService.getAll();
      const records = recordsResponse?.data || recordsResponse || [];
      setRecentRecords(Array.isArray(records) ? records.slice(0, 10) : []);
    } catch (error) {
      console.error('Error fetching parking data:', error);
    } finally {
      setLoading(false);
    }
  }, [stats.totalCapacity]);

  // Fetch all records for modal
  const fetchAllRecords = useCallback(async () => {
    setModalLoading(true);
    try {
      const response = await smartParkingService.getAll();
      let records = response?.data || response || [];
      
      // Apply filters
      if (Array.isArray(records)) {
        // Filter by search
        if (searchQuery) {
          records = records.filter((r: ParkingRecord) => 
            r.plate_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            r.driver_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            r.driver_telephone?.includes(searchQuery)
          );
        }
        
        // Filter by status
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
      
      setAllRecords(Array.isArray(records) ? records : []);
    } catch (error) {
      console.error('Error fetching all records:', error);
      setAllRecords([]);
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

  // Open records modal
  const handleOpenRecordsModal = useCallback(() => {
    setShowRecordsModal(true);
    fetchAllRecords();
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
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.todayVehicles}</p>
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
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.currentlyParked}</p>
                <p className="text-xs text-gray-400 mt-1">{((stats.currentlyParked / stats.totalCapacity) * 100).toFixed(1)}% occupied</p>
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
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.availableSlots}</p>
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
                  <span className="text-gray-400"> / </span>
                  <span className="text-gray-500">{stats.flaggedOutside}</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">Currently / History</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <FiFlag className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Parking Usage Chart */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Parking Usage Trends</h2>
            <span className="text-sm text-gray-500">Today's hourly activity</span>
          </div>
          
          {loading ? (
            <div className="h-64 flex items-center justify-center">
              <LoadingSpinner message="Loading chart data..." />
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hourlyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
                    tickFormatter={(value) => `${value.toString().padStart(2, '0')}:00`}
                    stroke="#9ca3af"
                    fontSize={12}
                  />
                  <YAxis stroke="#9ca3af" fontSize={12} />
                  <Tooltip 
                    formatter={(value: any, name: any) => [
                      value || 0, 
                      name === 'check_in' ? 'Check-ins' : 'Check-outs'
                    ]}
                    labelFormatter={(label) => `${label}:00`}
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

        {/* See All Parking Records Button */}
        <div className="flex justify-center">
          <button 
            onClick={handleOpenRecordsModal}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600  text-white rounded-xl font-medium hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl"
          >
            <FiFileText className="w-5 h-5" />
            View All Parking Records
            <FiArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Parking Records Management Modal */}
      {showRecordsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowRecordsModal(false)}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Parking Records Management</h2>
                  <p className="text-sm text-gray-500 mt-1">Comprehensive view of all vehicle entries and exits</p>
                </div>
                <button 
                  onClick={() => setShowRecordsModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <FiX className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <div className="flex flex-wrap gap-4 items-end">
                {/* Search */}
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                  <div className="relative">
                    <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search by plate, driver name, or phone..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && fetchAllRecords()}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Date From */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                  <div className="relative">
                    <FiCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Date To */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                  <div className="relative">
                    <FiCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Status Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                {/* Apply Button */}
                <button 
                  onClick={fetchAllRecords}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <FiFilter className="w-4 h-4" />
                  Apply Filters
                </button>

                {/* Download Button */}
                <button 
                  onClick={handleDownloadReport}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <FiDownload className="w-4 h-4" />
                  Export PDF
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-auto max-h-[calc(90vh-280px)]">
              {modalLoading ? (
                <div className="flex items-center justify-center h-64">
                  <LoadingSpinner message="Loading records..." />
                </div>
              ) : allRecords.length > 0 ? (
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Plate Number</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Driver Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Driver Type</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Check-in Time</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Check-out Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {allRecords.map((record, index) => (
                      <tr key={record._id} className={`hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                        <td className="px-4 py-3">
                          <span className="font-medium text-gray-900">
                            {record.plate_number || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {record.driver_name || '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {record.driver_telephone || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                            {record.driver_type || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${
                            record.status === 'active' ? 'bg-green-100 text-green-700' : 
                            record.status === 'completed' ? 'bg-blue-100 text-blue-700' : 
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {record.status === 'active' ? 'Active' : record.status === 'completed' ? 'Completed' : record.status || 'Unknown'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-sm">
                          {record.check_in ? new Date(record.check_in).toLocaleString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-sm">
                          {record.check_out ? new Date(record.check_out).toLocaleString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <FiTruck className="w-12 h-12 mb-2 opacity-50" />
                  <p className="text-lg font-medium">No parking records found</p>
                  <p className="text-sm mt-1">Try adjusting your filters or check back later</p>
                </div>
              )}
            </div>
            
            {/* Modal Footer with Record Count */}
            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50">
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-600">
                  Showing <span className="font-semibold">{allRecords.length}</span> records
                </p>
                <p className="text-xs text-gray-500">
                  Last updated: {new Date().toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default AdminSmartParkingDashboard;