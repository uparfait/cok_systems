// Department Dashboard Tab Component

import { useState } from "react";
import { FiClock, FiRefreshCw, FiArrowRightCircle, FiArrowRight, FiCheckCircle, FiFilter, FiUserCheck, FiX } from "react-icons/fi";

// Import shared components
import { Pagination } from '../../shared';

// Types
interface Visitor {
  id: string;
  fullName: string;
  nationalId: string;
  service: string;
  department: string;
  arrivalTime: string;
  status: string;
  phone: string;
  requestId?: string;
}

interface Employee {
  id: string;
  name: string;
  role: string;
  status: 'available' | 'busy' | 'off';
  avatar?: string;
}

// Get initials from name
const getInitials = (name: string) => {
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

// Get color from name
const getColorFromName = (name: string) => {
  const colors = [
    'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
    'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
};

interface DepartmentDashboardTabProps {
  visitors: Visitor[];
  setVisitors: React.Dispatch<React.SetStateAction<Visitor[]>>;
  employees: Employee[];
  mockEmployees: Employee[];
  onAssignClick: (visitor: Visitor) => void;
}

const DepartmentDashboardTab: React.FC<DepartmentDashboardTabProps> = ({
  visitors,
  employees,
  mockEmployees,
  onAssignClick
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const itemsPerPage = 9;

  // Filter visitors (only pending)
  const filteredVisitors = visitors.filter(visitor => {
    const matchesSearch = !searchTerm ? true : 
      visitor.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      visitor.nationalId.includes(searchTerm);
    return matchesSearch;
  });

  // Pagination
  const totalPages = Math.ceil(filteredVisitors.length / itemsPerPage);
  const paginatedVisitors = filteredVisitors.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Stats
  const pendingCount = visitors.filter(v => v.status === 'pending').length;
  const inProgressCount = 8;
  const transferredCount = 5;
  const completedCount = 42;

  return (
    <>
      {/* STATISTICS CARDS */}
      <div className="grid grid-cols-4 gap-5 mb-6">
        {/* Pending Card */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-3xl font-bold text-gray-800">{pendingCount}</p>
              <p className="text-sm text-green-600 mt-1">↑ 4% since yesterday</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <FiClock className="w-6 h-6 text-orange-500" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">Pending</p>
        </div>

        {/* In-Progress Card */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-3xl font-bold text-gray-800">{inProgressCount}</p>
              <p className="text-sm text-gray-500 mt-1">Current active tasks</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <FiRefreshCw className="w-6 h-6 text-blue-500" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">In-Progress</p>
        </div>

        {/* Transferred Card */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-3xl font-bold text-gray-800">{transferredCount}</p>
              <p className="text-sm text-gray-500 mt-1">To other departments</p>
            </div>
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
              <FiArrowRightCircle className="w-6 h-6 text-gray-600" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">Transferred</p>
        </div>

        {/* Completed Card */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-3xl font-bold text-gray-800">{completedCount}</p>
              <p className="text-sm text-gray-500 mt-1">Successfully completed</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <FiCheckCircle className="w-6 h-6 text-green-500" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">Completed</p>
        </div>
      </div>

      {/* CURRENT PENDING REQUESTS CARD */}
      <div className="bg-white rounded-[14px] shadow-[0_2px_8px_rgba(0,0,0,0.05)] overflow-hidden">
        {/* Card Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-[18px] font-semibold text-[#0F172A]">Current Pending Requests</h2>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-[14px] py-2 border border-[#CBD5E1] rounded-[8px] text-[#475569] hover:bg-gray-50 transition-colors">
              <FiFilter className="w-4 h-4" />
              Filter
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-[#0284C7] rounded-[8px] text-white hover:bg-[#0369A1] transition-colors">
              <FiRefreshCw className="w-4 h-4" />
              Refresh Data
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto px-6">
          <table className="w-full">
            <thead className="bg-[#F1F5F9]">
              <tr>
                <th className="text-left text-[13px] font-semibold text-[#64748B] uppercase tracking-[0.5px] px-6 py-3">VISITOR NAME</th>
                <th className="text-left text-[13px] font-semibold text-[#64748B] uppercase tracking-[0.5px] px-6 py-3">ID NUMBER</th>
                <th className="text-left text-[13px] font-semibold text-[#64748B] uppercase tracking-[0.5px] px-6 py-3">SERVICE TYPE</th>
                <th className="text-left text-[13px] font-semibold text-[#64748B] uppercase tracking-[0.5px] px-6 py-3">ARRIVAL TIME</th>
                <th className="text-left text-[13px] font-semibold text-[#64748B] uppercase tracking-[0.5px] px-6 py-3">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {paginatedVisitors.map((visitor) => (
                <tr key={visitor.id} className="h-16 border-b border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-9 h-9 rounded-full bg-[#E0F2FE] flex items-center justify-center text-[#0284C7] font-semibold text-[13px] mr-3">
                        {getInitials(visitor.fullName)}
                      </div>
                      <p className="text-[14px] font-medium text-[#1E293B]">{visitor.fullName}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-[13px] text-[#64748B] tracking-wide">{visitor.nationalId}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex px-[10px] py-1 bg-[#E2E8F0] rounded-full text-[12px] font-medium text-[#475569]">
                      {visitor.service}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-[13px] text-[#475569]">{visitor.arrivalTime}</p>
                  </td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => onAssignClick(visitor)}
                      className="flex items-center text-[14px] font-medium text-[#0284C7] cursor-pointer hover:underline hover:text-[#0369A1] transition-colors"
                    >
                      Assign <FiArrowRight className="w-3 h-3 ml-1" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bottom Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          style="prev-next"
          showPageInfo={true}
          totalItems={filteredVisitors.length}
          itemsPerPage={itemsPerPage}
        />
      </div>
    </>
  );
};

export default DepartmentDashboardTab;
