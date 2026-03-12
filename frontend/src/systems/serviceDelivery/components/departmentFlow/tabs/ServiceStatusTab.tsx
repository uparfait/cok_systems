// Service Status Tab Component

import { useState, useEffect } from "react";
import { FiSearch, FiFilter } from "react-icons/fi";
import ServiceDetailsModal from "../ServiceDetailsModal";

// Import shared components
import { Pagination } from '../../shared';

interface ServiceStatusVisitor {
  id: string;
  requestId: string;
  fullName: string;
  initials: string;
  contact: string;
  service: string;
  status: 'Pending' | 'In-Progress' | 'Completed' | 'Transferred';
  assignedTo: string;
  assignedToInitials?: string;
  createdAt?: string;
}

interface ServiceStatusTabProps {
  visitors: ServiceStatusVisitor[];
  setVisitors: React.Dispatch<React.SetStateAction<ServiceStatusVisitor[]>>;
}

const ServiceStatusTab: React.FC<ServiceStatusTabProps> = ({ visitors, setVisitors }) => {
  const [serviceStatusSearch, setServiceStatusSearch] = useState("");
  const [serviceStatusFilter, setServiceStatusFilter] = useState("all");
  const [serviceDateFilter, setServiceDateFilter] = useState("all");
  const [serviceCurrentPage, setServiceCurrentPage] = useState(1);
  const [showServiceDetailsModal, setShowServiceDetailsModal] = useState(false);
  const [selectedServiceVisitor, setSelectedServiceVisitor] = useState<ServiceStatusVisitor | null>(null);
  
  const serviceItemsPerPage = 8;

  // Filter service status visitors
  const filteredServiceVisitors = visitors.filter(visitor => {
    const matchesSearch = !serviceStatusSearch ? true : 
      visitor.fullName.toLowerCase().includes(serviceStatusSearch.toLowerCase()) ||
      visitor.requestId.toLowerCase().includes(serviceStatusSearch.toLowerCase()) ||
      visitor.contact.includes(serviceStatusSearch);
    const matchesStatus = serviceStatusFilter === 'all' ? true : 
      visitor.status.toLowerCase().replace('-', '').replace('_', '') === serviceStatusFilter.toLowerCase().replace('-', '').replace('_', '');
    
    // Date filtering
    let matchesDate = true;
    if (serviceDateFilter !== 'all') {
      const today = new Date();
      const visitorDate = visitor.createdAt ? new Date(visitor.createdAt) : today;
      
      switch (serviceDateFilter) {
        case 'today':
          matchesDate = visitorDate.toDateString() === today.toDateString();
          break;
        case 'yesterday':
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          matchesDate = visitorDate.toDateString() === yesterday.toDateString();
          break;
        case 'week':
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          matchesDate = visitorDate >= weekAgo && visitorDate <= today;
          break;
        case 'month':
          const monthAgo = new Date(today);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          matchesDate = visitorDate >= monthAgo && visitorDate <= today;
          break;
      }
    }
    
    return matchesSearch && matchesStatus && matchesDate;
  });

  // Service Status Pagination
  const serviceTotalPages = Math.ceil(filteredServiceVisitors.length / serviceItemsPerPage);
  const paginatedServiceVisitors = filteredServiceVisitors.slice(
    (serviceCurrentPage - 1) * serviceItemsPerPage,
    serviceCurrentPage * serviceItemsPerPage
  );

  // Reset serviceCurrentPage when filters change
  useEffect(() => {
    setServiceCurrentPage(1);
  }, [serviceStatusSearch, serviceStatusFilter, serviceDateFilter]);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Service Status Tracking</h1>
          <p className="text-sm text-gray-500 mt-1">manage and track live visitor requests across all departments.</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Active Today Card */}
          <div className="bg-white rounded-xl shadow-sm p-4 min-w-[140px]">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">ACTIVE TODAY</p>
            <p className="text-2xl font-bold text-blue-500 mt-1">124</p>  
          </div>
          {/* Avg Wait Card */}
          <div className="bg-white rounded-xl shadow-sm p-4 min-w-[140px]">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">AVG. WAIT</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">15 min</p>
          </div>
        </div>
      </div>

      {/* Search and Filter Card */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-center gap-4">
          {/* Search Box */}
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by ID, Name, or Number...."
              value={serviceStatusSearch}
              onChange={(e) => setServiceStatusSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#E0F2FE] border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <select
              value={serviceStatusFilter}
              onChange={(e) => setServiceStatusFilter(e.target.value)}
              className="px-4 py-2 bg-[#E0F2FE] border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
            >
              <option value="all">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="In-Progress">In-Progress</option>
              <option value="Completed">Completed</option>
              <option value="Transferred">Transferred</option>
            </select>
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-2">
            <select
              value={serviceDateFilter}
              onChange={(e) => setServiceDateFilter(e.target.value)}
              className="px-4 py-2 bg-[#E0F2FE] border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
            >
              <option value="all">Any Date</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          </div>

          {/* Apply Button */}
          <button className="flex items-center gap-2 px-4 py-2 bg-[#0284C7] text-white rounded-lg hover:bg-[#0369A1] transition-colors">
            <FiFilter className="w-4 h-4" />
            Apply
          </button>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F1F5F9]">
              <tr>
                <th className="text-left text-[13px] font-semibold text-[#475569] uppercase tracking-[0.5px] px-6 py-3">REQUEST ID</th>
                <th className="text-left text-[13px] font-semibold text-[#475569] uppercase tracking-[0.5px] px-6 py-3">VISITOR NAME</th>
                <th className="text-left text-[13px] font-semibold text-[#475569] uppercase tracking-[0.5px] px-6 py-3">CONTACT NUMBER</th>
                <th className="text-left text-[13px] font-semibold text-[#475569] uppercase tracking-[0.5px] px-6 py-3">REQUESTED SERVICE</th>
                <th className="text-left text-[13px] font-semibold text-[#475569] uppercase tracking-[0.5px] px-6 py-3">STATUS</th>
                <th className="text-left text-[13px] font-semibold text-[#475569] uppercase tracking-[0.5px] px-6 py-3">ASSIGNED TO</th>
                <th className="text-left text-[13px] font-semibold text-[#475569] uppercase tracking-[0.5px] px-6 py-3">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {paginatedServiceVisitors.map((visitor) => (
                <tr key={visitor.id} className="h-16 hover:bg-[#F8FAFC] transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-[13px] font-medium text-[#0284C7]">#{visitor.requestId}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-9 h-9 rounded-full bg-[#E2E8F0] flex items-center justify-center text-[#475569] font-semibold text-[13px] mr-3">
                        {visitor.initials}
                      </div>
                      <p className="text-[14px] font-medium text-[#1E293B]">{visitor.fullName}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-[13px] text-[#475569]">{visitor.contact}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-[13px] text-[#475569]">{visitor.service}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-3 py-1 rounded-full text-[12px] font-semibold ${
                      visitor.status === 'Pending' ? 'bg-[#FEF3C7] text-[#B45309]' :
                      visitor.status === 'In-Progress' ? 'bg-[#DBEAFE] text-[#1D4ED8]' :
                      visitor.status === 'Completed' ? 'bg-[#DCFCE7] text-[#15803D]' :
                      'bg-[#E9D5FF] text-[#7C3AED]'
                    }`}>
                      {visitor.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      {visitor.assignedToInitials ? (
                        <>
                          <div className="w-7 h-7 rounded-full bg-[#E2E8F0] flex items-center justify-center text-[#475569] font-semibold text-[11px] mr-2">
                            {visitor.assignedToInitials}
                          </div>
                          <p className="text-[13px] text-[#475569]">{visitor.assignedTo}</p>
                        </>
                      ) : (
                        <p className="text-[13px] text-[#475569]">{visitor.assignedTo}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => {
                        setSelectedServiceVisitor(visitor);
                        setShowServiceDetailsModal(true);
                      }}
                      className="text-[14px] font-medium text-[#0284C7] cursor-pointer hover:underline"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <Pagination
          currentPage={serviceCurrentPage}
          totalPages={serviceTotalPages}
          onPageChange={setServiceCurrentPage}
          style="prev-next"
          showPageInfo={true}
          totalItems={filteredServiceVisitors.length}
          itemsPerPage={serviceItemsPerPage}
        />
      </div>

      {/* Service Details Modal */}
      <ServiceDetailsModal 
        isOpen={showServiceDetailsModal} 
        onClose={() => setShowServiceDetailsModal(false)} 
        visitor={selectedServiceVisitor} 
      />
    </div>
  );
};

export default ServiceStatusTab;
