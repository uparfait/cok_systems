// EmployeeDashboardTab - Dashboard page for Employee
import React, { useState } from 'react';
import { 
  FiSearch, FiFilter, FiClock, FiCheckCircle,
  FiUser
} from 'react-icons/fi';

// Import shared components
import { Pagination } from '../../shared';

// Mock data for service history
interface ServiceRecord {
  id: string;
  visitorName: string;
  serviceId: string;
  status: 'pending' | 'completed' | 'transferred';
  assignmentTime: string;
  avatarColor: string;
  initials: string;
}

const mockServiceRecords: ServiceRecord[] = [
  { id: '1', visitorName: 'Emmanuel Kwizera', serviceId: '#REQ-2023-001', status: 'pending', assignmentTime: '10:45 AM', avatarColor: 'bg-purple-500', initials: 'EK' },
  { id: '2', visitorName: 'Alice Mutoni', serviceId: '#REQ-2023-042', status: 'completed', assignmentTime: '09:30 AM', avatarColor: 'bg-pink-500', initials: 'AM' },
  { id: '3', visitorName: 'Jean Ndayisaba', serviceId: '#REQ-2023-089', status: 'transferred', assignmentTime: '09:15 AM', avatarColor: 'bg-yellow-400', initials: 'JN' },
  { id: '4', visitorName: 'Grace Uwase', serviceId: '#REQ-2023-112', status: 'completed', assignmentTime: '08:50 AM', avatarColor: 'bg-teal-500', initials: 'GU' },
  { id: '5', visitorName: 'David Nshuti', serviceId: '#REQ-2023-156', status: 'pending', assignmentTime: '08:30 AM', avatarColor: 'bg-lavender-400', initials: 'DN' },
];

const statusStyles = {
  pending: { bg: 'bg-[#fff3e0]', text: 'text-[#f57c00]', label: 'Pending' },
  completed: { bg: 'bg-[#e8f5e9]', text: 'text-[#2e7d32]', label: 'Completed' },
  transferred: { bg: 'bg-[#e3f2fd]', text: 'text-[#1565c0]', label: 'Transferred' },
};

const EmployeeDashboardTab: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const totalResults = 65;
  const resultsPerPage = 5;

  // Filter records based on search
  const filteredRecords = mockServiceRecords.filter(record => {
    const searchLower = searchTerm.toLowerCase();
    return (
      record.visitorName.toLowerCase().includes(searchLower) ||
      record.serviceId.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="p-7">
      {/* Page Title Block */}
      <div>
        <h1 className="text-[#1a2744] text-[28px] font-extrabold">Service Overview</h1>
        <p className="text-[#888] text-[13px] mt-1.5">Manage and track visitor service requests assigned to you today.</p>
      </div>

      {/* Stats Row */}
      <div className="flex gap-5 mt-7">
        {/* Card 1 - Pending Requests */}
        <div className="bg-white rounded-[14px] p-[22px_24px] shadow-[0_1px_4px_rgba(0,0,0,0.07)] h-[110px] w-[33%] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#ff9800] rounded-full opacity-20 -translate-x-8 -translate-y-8"></div>
          </div>
          <div className="flex justify-between items-start relative z-10">
            <span className="text-[#888] text-[12px]">Pending Requests</span>
            <FiClock className="text-[#ff9800] w-5 h-5" />
          </div>
          <div className="text-[#1a2744] text-[36px] font-extrabold mt-2 relative z-10">12</div>
          <div className="w-10 h-1.5 bg-[#ffcc80] rounded-[3px] mt-1"></div>
        </div>

        {/* Card 2 - Transferred */}
        <div className="bg-white rounded-[14px] p-[22px_24px] shadow-[0_1px_4px_rgba(0,0,0,0.07)] h-[110px] w-[33%] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#1a73e8] rounded-full opacity-20 -translate-x-8 -translate-y-8"></div>
          </div>
          <div className="flex justify-between items-start relative z-10">
            <span className="text-[#888] text-[12px]">Transferred</span>
            <div className="text-[#1a73e8]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
            </div>
          </div>
          <div className="text-[#1a2744] text-[36px] font-extrabold mt-2 relative z-10">5</div>
          <div className="w-10 h-1.5 bg-[#90caf9] rounded-[3px] mt-1"></div>
        </div>

        {/* Card 3 - Completed */}
        <div className="bg-white rounded-[14px] p-[22px_24px] shadow-[0_1px_4px_rgba(0,0,0,0.07)] h-[110px] w-[33%] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#34a853] rounded-full opacity-20 -translate-x-8 -translate-y-8"></div>
          </div>
          <div className="flex justify-between items-start relative z-10">
            <span className="text-[#888] text-[12px]">Completed</span>
            <FiCheckCircle className="text-[#34a853] w-5 h-5" />
          </div>
          <div className="text-[#1a2744] text-[36px] font-extrabold mt-2 relative z-10">48</div>
          <div className="w-10 h-1.5 bg-[#a8d5b5] rounded-[3px] mt-1"></div>
        </div>
      </div>

      {/* Service History Table Card */}
      <div className="bg-white rounded-[14px] p-6 mt-6 shadow-[0_1px_4px_rgba(0,0,0,0.07)]">
        {/* Card Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-[#1a2744] text-[16px] font-bold">Service History</h2>
          <div className="flex gap-3">
            {/* Search Input */}
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search visitor or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-[220px] h-9 border border-[#e0e0e0] rounded-[20px] pl-10 pr-4 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1a73e8] focus:border-transparent"
              />
            </div>
            {/* Filter Button */}
            <button className="flex items-center gap-2 h-9 px-4 border border-[#e0e0e0] rounded-[8px] bg-white text-[#333] text-[13px] hover:bg-gray-50">
              <FiFilter className="w-4 h-4" />
              Filter
            </button>
          </div>
        </div>

        {/* Table */}
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#f0f0f0]">
              <th className="text-left py-3 px-0 text-[#999] text-[11px] uppercase tracking-wider font-medium">
                Visitor Name ↕
              </th>
              <th className="text-left py-3 px-0 text-[#999] text-[11px] uppercase tracking-wider font-medium">
                Service ID ↕
              </th>
              <th className="text-left py-3 px-0 text-[#999] text-[11px] uppercase tracking-wider font-medium">
                Status ↕
              </th>
              <th className="text-left py-3 px-0 text-[#999] text-[11px] uppercase tracking-wider font-medium">
                Assignment Time ↕
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map((record) => {
              const status = statusStyles[record.status];
              return (
                <tr key={record.id} className="border-b border-[#f8f8f8] h-14">
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full ${record.avatarColor} flex items-center justify-center text-white text-[12px] font-bold`}>
                        {record.initials}
                      </div>
                      <span className="text-[#333] text-[13px]">{record.visitorName}</span>
                    </div>
                  </td>
                  <td className="py-3 text-[#333] text-[13px]">{record.serviceId}</td>
                  <td className="py-3">
                    <span className={`inline-flex items-center px-3 py-1 rounded-[20px] text-[12px] font-medium ${status.bg} ${status.text}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="py-3 text-[#666] text-[13px]">{record.assignmentTime}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Table Footer */}
        <Pagination
          currentPage={currentPage}
          totalPages={Math.ceil(totalResults / resultsPerPage)}
          onPageChange={setCurrentPage}
          style="arrows-with-numbers"
          showPageInfo={true}
          totalItems={totalResults}
          itemsPerPage={resultsPerPage}
        />
      </div>
    </div>
  );
};

export default EmployeeDashboardTab;
