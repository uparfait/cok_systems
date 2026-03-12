// ProvideServicesTab - Service Provision page with Serve Modal
import React, { useState } from 'react';
import { 
  FiSearch, FiFilter, FiArrowLeft, FiArrowRight, FiClock, FiUser, 
  FiCheckCircle
} from 'react-icons/fi';

// Import modal components
import { ServeVisitorModal } from '../index';

// Import shared components
import { Pagination, ServiceStatusBadge } from '../../shared';

// Mock data for active service requests
interface ServiceRequest {
  id: string;
  visitorName: string;
  visitorId: string;
  serviceType: string;
  serviceColor: string;
  waitTime: string;
  avatarColor: string;
  initials: string;
  status: string;
}

const mockActiveRequests: ServiceRequest[] = [
  { id: '1', visitorName: 'Jean Bosco', visitorId: 'ID-9821', serviceType: 'Land Title', serviceColor: 'bg-[#f3e5f5] text-[#7b1fa2]', waitTime: '15 mins', avatarColor: 'bg-blue-500', initials: 'JB', status: 'waiting' },
  { id: '2', visitorName: 'Marie Claire', visitorId: 'ID-3321', serviceType: 'Building Permit', serviceColor: 'bg-[#e3f2fd] text-[#1565c0]', waitTime: '10 mins', avatarColor: 'bg-orange-500', initials: 'MC', status: 'waiting' },
  { id: '3', visitorName: 'Eric Nizeyimana', visitorId: 'ID-7743', serviceType: 'Tax Payment', serviceColor: 'bg-[#e8f5e9] text-[#2e7d32]', waitTime: '8 mins', avatarColor: 'bg-green-500', initials: 'EN', status: 'in-progress' },
  { id: '4', visitorName: 'Grace Uwase', visitorId: 'ID-5512', serviceType: 'Notary Service', serviceColor: 'bg-[#f5f5f5] text-[#616161]', waitTime: '5 mins', avatarColor: 'bg-pink-500', initials: 'GU', status: 'in-progress' },
  { id: '5', visitorName: 'Patrick Mugisha', visitorId: 'ID-1129', serviceType: 'Consultation', serviceColor: 'bg-[#e1f5fe] text-[#0277bd]', waitTime: '2 mins', avatarColor: 'bg-purple-400', initials: 'PM', status: 'completed' },
];

interface SelectedVisitor {
  name: string;
  id: string;
  email: string;
  service: string;
  checkInTime: string;
  gate: string;
}

const ProvideServicesTab: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [selectedVisitor, setSelectedVisitor] = useState<SelectedVisitor | null>(null);
  const [completedServices, setCompletedServices] = useState<{visitor: string, duration: string, startTime: string, endTime: string, notes: string}[]>([]);
  
  // Use state for requests so we can update status when service is completed
  const [requests, setRequests] = useState<ServiceRequest[]>(mockActiveRequests);
  
  // Calculate entries per page
  const entriesPerPage = 5;
  const totalEntries = requests.length;
  
  // Filter requests based on search and status
  const filteredRequests = requests.filter(request => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || 
      request.visitorName.toLowerCase().includes(searchLower) ||
      request.visitorId.toLowerCase().includes(searchLower) ||
      request.serviceType.toLowerCase().includes(searchLower);
    
    // Status filter - normalize both for comparison
    const matchesStatus = statusFilter === 'all' || 
      request.status.toLowerCase().replace('-', '').replace('_', '') === statusFilter.toLowerCase().replace('-', '').replace('_', '');
    
    return matchesSearch && matchesStatus;
  });

  // Calculate pagination
  const totalFilteredPages = Math.ceil(filteredRequests.length / entriesPerPage);
  const startIndex = (currentPage - 1) * entriesPerPage;
  const paginatedRequests = filteredRequests.slice(startIndex, startIndex + entriesPerPage);

  // Reset to page 1 when filter changes
  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const handleServeClick = (request: ServiceRequest) => {
    // If already completed, don't show serve button (but for safety)
    if (request.status === 'completed') return;
    
    setSelectedVisitor({
      name: request.visitorName + ' NDAYISABA',
      id: '1198780092211900',
      email: 'j.ndayisaba@email.com',
      service: request.serviceType + ' Transfer',
      checkInTime: '08:30 AM',
      gate: 'GATE',
    });
    setShowModal(true);
  };

  return (
    <div className="p-7">
      {/* Page Title Block */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-[#1a2744] text-[32px] font-extrabold">Service Provision</h1>
          <p className="text-[#888] text-[13px] mt-1.5">Manage active visitor requests, track wait times, and provision services efficiently.</p>
        </div>
        <button className="flex items-center gap-2 h-9 px-4 border border-[#e0e0e0] rounded-[8px] bg-white text-[#333] text-[13px] hover:bg-gray-50">
          <FiFilter className="w-4 h-4" />
          Filter
        </button>
      </div>

        {/* Stats Row */}
      <div className="flex gap-5 mt-7">
        {/* Card 1 - Avg Service Time */}
        <div className="bg-white rounded-[14px] p-6 shadow-[0_1px_4px_rgba(0,0,0,0.07)] flex-1">
          <div className="flex justify-between items-start">
            <span className="text-[#999] text-[11px] uppercase tracking-wider">AVG. SERVICE TIME</span>
            <FiClock className="text-[#90a4ae] w-7 h-7" />
          </div>
          <div className="text-[#1a2744] text-[28px] font-bold mt-3">12m 30s</div>
        </div>

        {/* Card 2 - Waiting Visitors */}
        <div className="bg-white rounded-[14px] p-6 shadow-[0_1px_4px_rgba(0,0,0,0.07)] flex-1">
          <div className="flex justify-between items-start">
            <span className="text-[#999] text-[11px] uppercase tracking-wider">WAITING VISITORS</span>
            <div className="text-[#90a4ae]">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          </div>
          <div className="text-[#1a2744] text-[28px] font-bold mt-3">{requests.filter(r => r.status === 'waiting').length}</div>
        </div>

        {/* Card 3 - Completed Today */}
        <div className="bg-white rounded-[14px] p-6 shadow-[0_1px_4px_rgba(0,0,0,0.07)] flex-1">
          <div className="flex justify-between items-start">
            <span className="text-[#999] text-[11px] uppercase tracking-wider">COMPLETED TODAY</span>
            <FiCheckCircle className="text-[#34a853] w-7 h-7" />
          </div>
          <div className="text-[#1a2744] text-[28px] font-bold mt-3">{requests.filter(r => r.status === 'completed').length}</div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-white rounded-[14px] p-4 mt-6 shadow-[0_1px_4px_rgba(0,0,0,0.07)]">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by visitor name, ID, or service type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-11 pl-10 pr-4 border border-[#e0e0e0] rounded-[8px] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => handleStatusFilterChange(e.target.value)}
            className="h-11 px-4 border border-[#e0e0e0] rounded-[8px] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1a73e8] bg-white"
          >
            <option value="all">All Status</option>
            <option value="waiting">Waiting</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Service Requests Table */}
      <div className="bg-white rounded-[14px] p-6 mt-4 shadow-[0_1px_4px_rgba(0,0,0,0.07)]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-[#1a2744] text-[16px] font-bold">Active Service Requests</h2>
          <div className="text-[#888] text-[12px]">
            Showing {startIndex + 1}-{Math.min(startIndex + entriesPerPage, filteredRequests.length)} of {filteredRequests.length} entries
          </div>
        </div>

        <table className="w-full">
          <thead>
            <tr className="border-b border-[#f0f0f0]">
              <th className="text-left py-3 px-0 text-[#999] text-[11px] uppercase tracking-wider font-medium">VISITOR</th>
              <th className="text-left py-3 px-0 text-[#999] text-[11px] uppercase tracking-wider font-medium">SERVICE TYPE</th>
              <th className="text-left py-3 px-0 text-[#999] text-[11px] uppercase tracking-wider font-medium">WAIT TIME</th>
              <th className="text-left py-3 px-0 text-[#999] text-[11px] uppercase tracking-wider font-medium">STATUS</th>
              <th className="text-left py-3 px-0 text-[#999] text-[11px] uppercase tracking-wider font-medium">ACTION</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRequests.map((request) => (
              <tr key={request.id} className="border-b border-[#f8f8f8] h-14">
                <td className="py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full ${request.avatarColor} flex items-center justify-center text-white text-[12px] font-bold`}>
                      {request.initials}
                    </div>
                    <div>
                      <div className="text-[#333] text-[13px] font-medium">{request.visitorName}</div>
                      <div className="text-[#888] text-[11px]">{request.visitorId}</div>
                    </div>
                  </div>
                </td>
                <td className="py-3">
                  <span className={`px-3 py-1 rounded-full text-[11px] font-medium ${request.serviceColor}`}>
                    {request.serviceType}
                  </span>
                </td>
                <td className="py-3 text-[#666] text-[13px]">{request.waitTime}</td>
                <td className="py-3">
                  <ServiceStatusBadge status={request.status} variant="employee" />
                </td>
                <td className="py-3">
                  {request.status === 'completed' ? (
                    <span className="text-[#34a853] text-[12px] font-medium">
                      ✓ Served
                    </span>
                  ) : (
                    <button
                      onClick={() => handleServeClick(request)}
                      className="h-8 px-4 bg-[#1a73e8] text-white text-[12px] font-medium rounded-[6px] hover:bg-[#1558c0]"
                    >
                      Serve
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalFilteredPages || 1}
          onPageChange={setCurrentPage}
          style="arrows-only"
          showPageInfo={true}
          prevLabel="Previous"
          nextLabel="Next"
        />
      </div>

      {/* Serve Modal - Using the new modular component */}
      <ServeVisitorModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedVisitor(null);
        }}
        visitor={selectedVisitor}
        onServiceStart={(startTime) => {
          console.log('Service started at:', startTime);
        }}
        onServiceEnd={(data) => {
          // Record the completed service
          if (selectedVisitor) {
            setCompletedServices(prev => [...prev, {
              visitor: selectedVisitor.name,
              duration: data.duration,
              startTime: data.startTime,
              endTime: data.endTime,
              notes: data.notes
            }]);
            
            // Update the visitor status to completed in the requests list
            // Match by visitor name (use selectedVisitor.name which includes NDAYISABA)
            setRequests(prev => prev.map(req => {
              // Try to match by name (check if selected visitor name contains the request name)
              if (selectedVisitor.name.toLowerCase().includes(req.visitorName.toLowerCase())) {
                return { ...req, status: 'completed' };
              }
              return req;
            }));
            
            console.log('Service completed:', {
              visitor: selectedVisitor.name,
              service: selectedVisitor.service,
              duration: data.duration,
              startTime: data.startTime,
              endTime: data.endTime,
              notes: data.notes
            });
          }
        }}
      />
    </div>
  );
};

export default ProvideServicesTab;
