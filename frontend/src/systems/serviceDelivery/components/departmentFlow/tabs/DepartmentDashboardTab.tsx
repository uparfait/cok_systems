// EmployeeDashboardTab - Dashboard page for Employee
// INTEGRATED WITH BACKEND API & BULLETPROOF ASSIGNMENT MATCHING

import React, { useState, useEffect } from 'react';
import { 
  FiSearch, FiFilter, FiClock, FiCheckCircle
} from 'react-icons/fi';
import { useAuth } from '../../../../../core/contexts/AuthContext';
import { serviceDeliveryService } from '../../../../../core/services/adminService';

// Import shared components
import { Pagination } from '../../shared';

// City of Kigali institutional design constants
const PRIMARY = "#056daa";
const SUCCESS = "#4CAF50";
const WARNING = "#F39C12";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const TERTIARY = "#CDB896";
const GRAY_DISABLED = "#9E9E9E";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";

// Service record interface
interface ServiceRecord {
  id: string;
  visitorName: string;
  serviceId: string;
  status: 'pending' | 'completed' | 'transferred';
  assignmentTime: string;
  avatarColor: string;
  initials: string;
}

// Status styles for rendering
const statusStyles = {
  pending: { bg: 'bg-[rgba(243,156,18,0.12)]', text: 'text-[#F39C12]', label: 'Pending' },
  completed: { bg: 'bg-[rgba(51,51,51,0.08)]', text: 'text-[#333333]', label: 'Completed' },
  transferred: { bg: 'bg-[rgba(5,109,170,0.1)]', text: 'text-[#056daa]', label: 'Transferred' },
};

const EmployeeDashboardTab: React.FC = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [serviceRecords, setServiceRecords] = useState<ServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ pending: 0, transferred: 0, completed: 0 });
  
  const resultsPerPage = 5;

  // Fetch visitors assigned to this employee
  const fetchAssignedVisitors = async () => {
    const currentUser = user as any;
    
    // Safely get all possible identifiers for the logged-in user
    const myId = currentUser?._id || currentUser?.id || currentUser?.userId || currentUser?.employee_id;
    const myName = (currentUser?.full_name || currentUser?.fullName || currentUser?.name || '').toLowerCase().trim();

    try {
      setLoading(true);
      const response = await serviceDeliveryService.getAll() as any;
      
      if (response && (response.data || response.success || Array.isArray(response))) {
        const allVisitors = Array.isArray(response.data) ? response.data : 
                            Array.isArray(response) ? response : [];
        
        // 👉 BULLETPROOF FILTER: Match by ID *OR* Name to catch any backend format
        const myVisitors = allVisitors.filter((v: any) => {
          if (!v) return false;

          // Extract assigned data from backend object
          const assignedObj = typeof v.assignedTo === 'object' ? v.assignedTo : null;
          const assignedStr = typeof v.assignedTo === 'string' ? v.assignedTo : null;
          
          const assignedId = assignedObj?._id || assignedObj?.id || assignedObj?.employee_id || assignedStr;
          const assignedName = (assignedObj?.full_name || assignedObj?.name || v.assignedStaff || assignedStr || '').toLowerCase().trim();
          
          // Check for a match
          const isIdMatch = myId && assignedId && String(myId) === String(assignedId);
          const isNameMatch = myName && assignedName && assignedName.includes(myName);

          return isIdMatch || isNameMatch;
        });
        
        // Transform visitor data to service records
        const records: ServiceRecord[] = myVisitors.map((visitor: any) => {
          
          let status: 'pending' | 'completed' | 'transferred' = 'pending';
          const rawStatus = (visitor.status || '').toLowerCase();
          
          if (rawStatus === 'completed') {
            status = 'completed';
          } else if (rawStatus === 'transferred') {
            status = 'transferred';
          } else {
            status = 'pending'; 
          }
          
          const colors = ['bg-[#2980B9]', 'bg-[#E74C3C]', 'bg-[#F39C12]', 'bg-[#4CAF50]', 'bg-[#CDB896]', 'bg-[#056daa]', 'bg-[#388E3C]'];
          const visitorName = visitor.full_name || visitor.name || visitor.visitorName || 'Unknown';
          const colorIndex = visitorName.charCodeAt(0) % colors.length;
          
          const initials = visitorName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
          
          const assignmentTime = visitor.checkInTime || visitor.check_in_time || visitor.updatedAt || new Date().toISOString();
          const formattedTime = new Date(assignmentTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          
          return {
            id: visitor._id || visitor.id || Math.random().toString(),
            visitorName: visitorName,
            serviceId: `#${(visitor._id || visitor.id || 'N/A').substring(0, 8)}`,
            status,
            assignmentTime: formattedTime,
            avatarColor: colors[colorIndex],
            initials
          };
        });
        
        // Sort newest first
        records.reverse();
        setServiceRecords(records);
        
        setStats({
          pending: records.filter(r => r.status === 'pending').length,
          transferred: records.filter(r => r.status === 'transferred').length,
          completed: records.filter(r => r.status === 'completed').length
        });
      }
    } catch (error) {
      console.error('Error fetching assigned visitors:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignedVisitors();
  }, [user]);

  // Filter records based on search
  const filteredRecords = serviceRecords.filter(record => {
    const searchLower = searchTerm.toLowerCase();
    return (
      record.visitorName.toLowerCase().includes(searchLower) ||
      record.serviceId.toLowerCase().includes(searchLower)
    );
  });

  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * resultsPerPage,
    currentPage * resultsPerPage
  );

  if (loading) {
    return (
      <div className="p-7 flex items-center justify-center h-64">
        <div className="text-[#9E9E9E]">Loading your assignments...</div>
      </div>
    );
  }

  return (
    <div className="p-7">
      <div>
        <h1 className="text-[28px] font-extrabold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Service Overview</h1>
        <p className="text-[13px] mt-1.5" style={{ color: GRAY_DISABLED }}>Manage and track visitor service requests assigned to you today.</p>
      </div>

      <div className="flex gap-5 mt-7">
        <div className="bg-white p-[22px_24px] h-[110px] w-[33%] relative overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
          <div className="absolute top-0 right-0 w-16 h-16 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#F39C12] opacity-10 -translate-x-8 -translate-y-8"></div>
          </div>
          <div className="flex justify-between items-start relative z-10">
            <span className="text-[12px] font-semibold" style={{ fontFamily: fontHeading, color: WARNING }}>Pending Requests</span>
            <FiClock className="text-[#F39C12] w-5 h-5" />
          </div>
          <div className="text-[36px] font-extrabold mt-2 relative z-10" style={{ fontFamily: fontHeading, color: WARNING }}>{stats.pending}</div>
          <div className="w-10 h-1.5 bg-[#F39C12] mt-1"></div>
        </div>

        <div className="bg-white p-[22px_24px] h-[110px] w-[33%] relative overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
          <div className="absolute top-0 right-0 w-16 h-16 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#056daa] opacity-10 -translate-x-8 -translate-y-8"></div>
          </div>
          <div className="flex justify-between items-start relative z-10">
            <span className="text-[12px] font-semibold" style={{ fontFamily: fontHeading, color: PRIMARY }}>Transferred</span>
            <div className="text-[#056daa]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
            </div>
          </div>
          <div className="text-[36px] font-extrabold mt-2 relative z-10" style={{ fontFamily: fontHeading, color: PRIMARY }}>{stats.transferred}</div>
          <div className="w-10 h-1.5 bg-[#056daa] mt-1"></div>
        </div>

        <div className="bg-white p-[22px_24px] h-[110px] w-[33%] relative overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
          <div className="absolute top-0 right-0 w-16 h-16 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#4CAF50] opacity-10 -translate-x-8 -translate-y-8"></div>
          </div>
          <div className="flex justify-between items-start relative z-10">
            <span className="text-[12px] font-semibold" style={{ fontFamily: fontHeading, color: SUCCESS }}>Completed</span>
            <FiCheckCircle className="text-[#4CAF50] w-5 h-5" />
          </div>
          <div className="text-[36px] font-extrabold mt-2 relative z-10" style={{ fontFamily: fontHeading, color: SUCCESS }}>{stats.completed}</div>
          <div className="w-10 h-1.5 bg-[#4CAF50] mt-1"></div>
        </div>
      </div>

      <div className="bg-white p-6 mt-6" style={{ boxShadow: CARD_SHADOW }}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-[16px] font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Service History</h2>
          <div className="flex gap-3">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search visitor or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-[220px] h-9 pl-10 pr-4 text-[12px] focus:outline-none"
                style={{ fontFamily: fontHeading, background: NEUTRAL_LIGHT, border: '1px solid transparent', borderRadius: 0, boxShadow: '0px 2px 4px rgba(0,0,0,0.1)' }}
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
            <button 
              onClick={fetchAssignedVisitors}
              className="flex items-center gap-2 h-9 px-4 bg-transparent text-[13px] font-semibold uppercase transition-colors hover:bg-[rgba(5,109,170,0.08)]"
              style={{ fontFamily: fontHeading, border: `1px solid ${PRIMARY}`, color: PRIMARY, letterSpacing: '1px', borderRadius: 0 }}
            >
              <FiClock className="w-4 h-4" /> Refresh
            </button>
          </div>
        </div>

        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E0E0E0]">
              <th className="text-left py-3 px-0 text-[11px] uppercase tracking-wider font-semibold" style={{ fontFamily: fontHeading, color: TERTIARY, letterSpacing: '0.5px' }}>Visitor Name ↕</th>
              <th className="text-left py-3 px-0 text-[11px] uppercase tracking-wider font-semibold" style={{ fontFamily: fontHeading, color: TERTIARY, letterSpacing: '0.5px' }}>Service ID ↕</th>
              <th className="text-left py-3 px-0 text-[11px] uppercase tracking-wider font-semibold" style={{ fontFamily: fontHeading, color: TERTIARY, letterSpacing: '0.5px' }}>Status ↕</th>
              <th className="text-left py-3 px-0 text-[11px] uppercase tracking-wider font-semibold" style={{ fontFamily: fontHeading, color: TERTIARY, letterSpacing: '0.5px' }}>Assignment Time ↕</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRecords.length > 0 ? paginatedRecords.map((record) => {
              const status = statusStyles[record.status];
              return (
                <tr key={record.id} className="border-b border-[#E0E0E0] h-14">
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full ${record.avatarColor} flex items-center justify-center text-white text-[12px] font-bold`}>
                        {record.initials}
                      </div>
                      <span className="text-[#333] text-[13px] font-medium">{record.visitorName}</span>
                    </div>
                  </td>
                  <td className="py-3 text-[#333] text-[13px]">{record.serviceId}</td>
                  <td className="py-3">
                    <span className={`inline-flex items-center px-3 py-1 text-[12px] font-bold uppercase tracking-wide ${status.bg} ${status.text}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="py-3 text-[#555555] text-[13px] font-medium">{record.assignmentTime}</td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={4} className="py-8 text-center text-[#9E9E9E]">
                  No visitors assigned to you yet. Pull from Reception.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {filteredRecords.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(filteredRecords.length / resultsPerPage)}
            onPageChange={setCurrentPage}
            style="arrows-with-numbers"
            showPageInfo={true}
            totalItems={filteredRecords.length}
            itemsPerPage={resultsPerPage}
          />
        )}
      </div>
    </div>
  );
};

export default EmployeeDashboardTab;