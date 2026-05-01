// ReportsTab - Reports page for Employee Dashboard
import React, { useState } from 'react';
import { 
  FiSearch, FiFilter, FiDownload, FiFileText,
  FiCalendar, FiCheckCircle, FiClock, FiXCircle
} from 'react-icons/fi';

// Import shared components
import { Pagination } from '../../shared';
import Table from '../../../../../core/components/Table';
import type { TableHeader } from '../../../../../core/components/Table';

// Mock report data
interface ReportRecord {
  id: string;
  visitorName: string;
  serviceId: string;
  serviceType: string;
  department: string;
  status: 'completed' | 'pending' | 'cancelled';
  date: string;
  time: string;
  avatarColor: string;
  initials: string;
}

const mockReports: ReportRecord[] = [
  { id: '1', visitorName: 'Jean Bosco Ndayisaba', serviceId: '#REQ-2023-156', serviceType: 'Land Title Transfer', department: 'Land Management', status: 'completed', date: '2023-12-15', time: '10:30 AM', avatarColor: 'bg-blue-500', initials: 'JN' },
  { id: '2', visitorName: 'Marie Claire Mukamana', serviceId: '#REQ-2023-155', serviceType: 'Building Permit', department: 'Planning', status: 'completed', date: '2023-12-15', time: '09:45 AM', avatarColor: 'bg-orange-500', initials: 'MM' },
  { id: '3', visitorName: 'Eric Niyonkuru', serviceId: '#REQ-2023-154', serviceType: 'Tax Payment', department: 'Finance', status: 'completed', date: '2023-12-15', time: '09:15 AM', avatarColor: 'bg-green-500', initials: 'EN' },
  { id: '4', visitorName: 'Grace Uwase', serviceId: '#REQ-2023-153', serviceType: 'Notary Service', department: 'Legal', status: 'cancelled', date: '2023-12-14', time: '04:30 PM', avatarColor: 'bg-pink-500', initials: 'GU' },
  { id: '5', visitorName: 'Patrick Mugisha', serviceId: '#REQ-2023-152', serviceType: 'Consultation', department: 'HR', status: 'pending', date: '2023-12-14', time: '03:00 PM', avatarColor: 'bg-purple-400', initials: 'PM' },
];

const statusStyles = {
  completed: { bg: 'bg-[#e8f5e9]', text: 'text-[#2e7d32]', icon: FiCheckCircle, label: 'Completed' },
  pending: { bg: 'bg-[#fff3e0]', text: 'text-[#f57c00]', icon: FiClock, label: 'Pending' },
  cancelled: { bg: 'bg-[#ffebee]', text: 'text-[#c62828]', icon: FiXCircle, label: 'Cancelled' },
};

const ReportsTab: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const totalResults = 156;
  const resultsPerPage = 5;

  // Filter reports based on search and date
  const filteredReports = mockReports.filter(report => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || 
      report.visitorName.toLowerCase().includes(searchLower) ||
      report.serviceId.toLowerCase().includes(searchLower) ||
      report.serviceType.toLowerCase().includes(searchLower) ||
      report.department.toLowerCase().includes(searchLower);
    
    // Filter by date if selected
    let matchesDate = true;
    if (dateFilter !== 'all') {
      const reportDate = new Date(report.date);
      const today = new Date();
      
      if (dateFilter === 'today') {
        matchesDate = reportDate.toDateString() === today.toDateString();
      } else if (dateFilter === 'week') {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        matchesDate = reportDate >= weekAgo;
      } else if (dateFilter === 'month') {
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        matchesDate = reportDate >= monthAgo;
      }
    }
    
    return matchesSearch && matchesDate;
  });

  return (
    <div className="p-7">
      {/* Page Title Block */}
      <div>
        <h1 className="text-[#1a2744] text-[28px] font-extrabold">Service Reports</h1>
        <p className="text-[#888] text-[13px] mt-1.5">View and export your service history and performance reports.</p>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-[14px] p-4 mt-6 shadow-[0_1px_4px_rgba(0,0,0,0.07)]">
        <div className="flex items-center gap-4">
          {/* Search Input */}
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by visitor name, service ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 pl-10 pr-4 border border-[#e0e0e0] rounded-[8px] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1a73e8] focus:border-transparent"
            />
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-2">
            <FiCalendar className="text-gray-400 w-4 h-4" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="h-10 px-4 border border-[#e0e0e0] rounded-[8px] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1a73e8] bg-white"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          </div>

          {/* Filter Button */}
          <button className="flex items-center gap-2 h-10 px-4 border border-[#e0e0e0] rounded-[8px] bg-white text-[#333] text-[13px] hover:bg-gray-50">
            <FiFilter className="w-4 h-4" />
            Filter
          </button>

          {/* Export Button */}
          <button className="flex items-center gap-2 h-10 px-4 bg-[#1a73e8] rounded-[8px] text-white text-[13px] hover:bg-[#1558c0]">
            <FiDownload className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Reports Table Card */}
      <div className="bg-white rounded-[14px] p-6 mt-6 shadow-[0_1px_4px_rgba(0,0,0,0.07)]">
        {/* Card Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-[#1a2744] text-[16px] font-bold">Service Records</h2>
          <div className="flex items-center gap-2 text-[#888] text-[12px]">
            <FiFileText className="w-4 h-4" />
            {totalResults} total records
          </div>
        </div>

        {/* Table */}
        <Table
          headers={[
            { key: 'visitor', label: 'VISITOR' },
            { key: 'service_id', label: 'SERVICE ID' },
            { key: 'service_type', label: 'SERVICE TYPE' },
            { key: 'department', label: 'DEPARTMENT' },
            { key: 'date_time', label: 'DATE & TIME' },
            { key: 'status', label: 'STATUS' }
          ]}
          data={filteredReports}
          emptyMessage="No reports found."
          maxHeight="500px"
          minWidth="900px"
          renderCell={(header, record, index) => {
            switch (header.key) {
              case 'visitor':
                return (
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full ${record.avatarColor} flex items-center justify-center text-white text-[12px] font-bold`}>
                      {record.initials}
                    </div>
                    <span className="text-[#333] text-[13px]">{record.visitorName}</span>
                  </div>
                );
              case 'service_id':
                return <span className="text-[#333] text-[13px]">{record.serviceId}</span>;
              case 'service_type':
                return <span className="text-[#666] text-[13px]">{record.serviceType}</span>;
              case 'department':
                return <span className="text-[#666] text-[13px]">{record.department}</span>;
              case 'date_time':
                return (
                  <div className="text-[#666] text-[13px]">
                    <div>{record.date}</div>
                    <div className="text-[11px] text-gray-400">{record.time}</div>
                  </div>
                );
              case 'status':
                const statusKey = record.status as keyof typeof statusStyles;
                const status = statusStyles[statusKey];
                const StatusIcon = status.icon;
                return (
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-[20px] text-[12px] font-medium ${status.bg} ${status.text}`}>
                    <StatusIcon className="w-3 h-3" />
                    {status.label}
                  </span>
                );
              default:
                return <span>{record[header.key] || '-'}</span>;
            }
          }}
          pagination={{
            currentPage,
            totalPages: Math.ceil(totalResults / resultsPerPage),
            totalCount: totalResults,
            itemsPerPage: resultsPerPage,
            onPageChange: setCurrentPage
          }}
        />
      </div>

      {/* Summary Cards */}
      <div className="flex gap-5 mt-6">
        {/* Total Services */}
        <div className="bg-white rounded-[14px] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.07)] flex-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#888] text-[12px]">Total Services</p>
              <p className="text-[#1a2744] text-[32px] font-extrabold mt-1">156</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <FiFileText className="w-6 h-6 text-[#1a73e8]" />
            </div>
          </div>
        </div>

        {/* Completed */}
        <div className="bg-white rounded-[14px] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.07)] flex-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#888] text-[12px]">Completed</p>
              <p className="text-[#34a853] text-[32px] font-extrabold mt-1">142</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <FiCheckCircle className="w-6 h-6 text-[#34a853]" />
            </div>
          </div>
        </div>

        {/* Pending */}
        <div className="bg-white rounded-[14px] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.07)] flex-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#888] text-[12px]">Pending</p>
              <p className="text-[#f57c00] text-[32px] font-extrabold mt-1">8</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
              <FiClock className="w-6 h-6 text-[#f57c00]" />
            </div>
          </div>
        </div>

        {/* Cancelled */}
        <div className="bg-white rounded-[14px] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.07)] flex-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#888] text-[12px]">Cancelled</p>
              <p className="text-[#e53935] text-[32px] font-extrabold mt-1">6</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <FiXCircle className="w-6 h-6 text-[#e53935]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsTab;
