// Service Status Tab Component

import { useState, useEffect } from "react";
import { FiSearch, FiFilter } from "react-icons/fi";
import ServiceDetailsModal from "../ServiceDetailsModal";

// Import shared components
import { Pagination } from '../../shared';

// City of Kigali institutional design constants
const PRIMARY = "#056daa";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const TERTIARY = "#CDB896";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";

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
          <h1 className="text-3xl font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Service Status Tracking</h1>
          <p className="text-sm text-[#555555] mt-1">manage and track live visitor requests across all departments.</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Active Today Card */}
          <div className="bg-white p-4 min-w-[140px]" style={{ boxShadow: CARD_SHADOW }}>
            <p className="uppercase" style={{ fontFamily: fontHeading, color: TERTIARY, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px' }}>ACTIVE TODAY</p>
            <p className="text-2xl font-bold mt-1" style={{ fontFamily: fontHeading, color: PRIMARY }}>124</p>
          </div>
          {/* Avg Wait Card */}
          <div className="bg-white p-4 min-w-[140px]" style={{ boxShadow: CARD_SHADOW }}>
            <p className="uppercase" style={{ fontFamily: fontHeading, color: TERTIARY, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px' }}>AVG. WAIT</p>
            <p className="text-2xl font-bold mt-1" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>15 min</p>
          </div>
        </div>
      </div>

      {/* Search and Filter Card */}
      <div className="bg-white p-4" style={{ boxShadow: CARD_SHADOW }}>
        <div className="flex items-center gap-4">
          {/* Search Box */}
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by ID, Name, or Number...."
              value={serviceStatusSearch}
              onChange={(e) => setServiceStatusSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 focus:outline-none"
              style={{ fontFamily: fontHeading, fontSize: '14px', background: NEUTRAL_LIGHT, border: '1px solid transparent', borderRadius: 0, boxShadow: '0px 2px 4px rgba(0,0,0,0.1)' }}
              onFocus={(e) => {
                e.currentTarget.style.border = `1px solid ${PRIMARY}`;
                e.currentTarget.style.boxShadow = '0px 4px 8px rgba(5,109,170,0.25)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.border = '1px solid transparent';
                e.currentTarget.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.1)';
              }}
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <select
              value={serviceStatusFilter}
              onChange={(e) => setServiceStatusFilter(e.target.value)}
              className="px-4 py-2 focus:outline-none text-[#333333]"
              style={{ fontFamily: fontHeading, fontSize: '14px', background: NEUTRAL_LIGHT, border: '1px solid transparent', borderRadius: 0, boxShadow: '0px 2px 4px rgba(0,0,0,0.1)' }}
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
              className="px-4 py-2 focus:outline-none text-[#333333]"
              style={{ fontFamily: fontHeading, fontSize: '14px', background: NEUTRAL_LIGHT, border: '1px solid transparent', borderRadius: 0, boxShadow: '0px 2px 4px rgba(0,0,0,0.1)' }}
            >
              <option value="all">Any Date</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          </div>

          {/* Apply Button */}
          <button className="flex items-center gap-2 px-4 py-2 bg-[#056daa] text-white text-[13px] font-semibold uppercase tracking-[1px] hover:bg-[#045d94] transition-colors" style={{ fontFamily: fontHeading, borderRadius: 0 }}>
            <FiFilter className="w-4 h-4" />
            Apply
          </button>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F7F9FB]">
              <tr>
                <th className="text-left text-[13px] font-semibold uppercase tracking-[0.5px] px-6 py-3" style={{ fontFamily: fontHeading, color: TERTIARY }}>REQUEST ID</th>
                <th className="text-left text-[13px] font-semibold uppercase tracking-[0.5px] px-6 py-3" style={{ fontFamily: fontHeading, color: TERTIARY }}>VISITOR NAME</th>
                <th className="text-left text-[13px] font-semibold uppercase tracking-[0.5px] px-6 py-3" style={{ fontFamily: fontHeading, color: TERTIARY }}>CONTACT NUMBER</th>
                <th className="text-left text-[13px] font-semibold uppercase tracking-[0.5px] px-6 py-3" style={{ fontFamily: fontHeading, color: TERTIARY }}>REQUESTED SERVICE</th>
                <th className="text-left text-[13px] font-semibold uppercase tracking-[0.5px] px-6 py-3" style={{ fontFamily: fontHeading, color: TERTIARY }}>STATUS</th>
                <th className="text-left text-[13px] font-semibold uppercase tracking-[0.5px] px-6 py-3" style={{ fontFamily: fontHeading, color: TERTIARY }}>ASSIGNED TO</th>
                <th className="text-left text-[13px] font-semibold uppercase tracking-[0.5px] px-6 py-3" style={{ fontFamily: fontHeading, color: TERTIARY }}>ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E0E0E0]">
              {paginatedServiceVisitors.map((visitor) => (
                <tr key={visitor.id} className="h-16 hover:bg-[#F7F9FB] transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-[13px] font-medium text-[#056daa]">#{visitor.requestId}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-9 h-9 rounded-full bg-[#E0E0E0] flex items-center justify-center text-[#555555] font-semibold text-[13px] mr-3">
                        {visitor.initials}
                      </div>
                      <p className="text-[14px] font-medium text-[#333333]">{visitor.fullName}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-[13px] text-[#555555]">{visitor.contact}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-[13px] text-[#555555]">{visitor.service}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-3 py-1 text-[12px] font-semibold ${
                      visitor.status === 'Pending' ? 'bg-[rgba(243,156,18,0.12)] text-[#F39C12]' :
                      visitor.status === 'In-Progress' ? 'bg-[rgba(5,109,170,0.1)] text-[#056daa]' :
                      visitor.status === 'Completed' ? 'bg-[rgba(51,51,51,0.08)] text-[#333333]' :
                      'bg-[rgba(41,128,185,0.12)] text-[#2980B9]'
                    }`}>
                      {visitor.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      {visitor.assignedToInitials ? (
                        <>
                          <div className="w-7 h-7 rounded-full bg-[#E0E0E0] flex items-center justify-center text-[#555555] font-semibold text-[11px] mr-2">
                            {visitor.assignedToInitials}
                          </div>
                          <p className="text-[13px] text-[#555555]">{visitor.assignedTo}</p>
                        </>
                      ) : (
                        <p className="text-[13px] text-[#555555]">{visitor.assignedTo}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => {
                        setSelectedServiceVisitor(visitor);
                        setShowServiceDetailsModal(true);
                      }}
                      className="text-[14px] font-medium text-[#056daa] cursor-pointer hover:underline"
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
