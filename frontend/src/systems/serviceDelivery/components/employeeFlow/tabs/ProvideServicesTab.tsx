import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiClock, FiCheckCircle, FiRefreshCw, FiSquare, FiArrowRightCircle, FiX, FiUser } from 'react-icons/fi';
import { useAuth } from '../../../../../core/contexts/AuthContext';
import { serviceDeliveryService, departmentService, employeeService } from '../../../../../core/services/adminService';
import { useToast } from '../../../../../core/contexts/ToastContext';

export interface ProvideServicesTabProps {
  isDashboardView?: boolean;
}

const ProvideServicesTab: React.FC<ProvideServicesTabProps> = ({ isDashboardView = false }) => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isServing, setIsServing] = useState(false);

  const fetchAssignedVisitors = useCallback(async (silent: boolean = false, page: number = currentPage, query: string = searchTerm) => {
    const currentUser = user as any;
    const myId = String(currentUser?.userId || currentUser?._id || currentUser?.id || currentUser?.employee_id || "");
    const myName = String(currentUser?.full_name || currentUser?.fullName || currentUser?.name || "Unknown").trim();

    if (!myId || myId === "undefined") {
      if (!silent) setLoading(false);
      return;
    }

    try {
      if (!silent) setLoading(true);
      let response;
      if (query && query.trim()) {
        response = await serviceDeliveryService.search(query, page, 20);
      } else {
        response = await serviceDeliveryService.getCurrentVisitorsByProvider(myId, page, 20);
      }

      if (response && response.success) {
        const allVisitors: any[] = response.data || [];
        setTotalCount(response.total || 0);
        setTotalPages(Math.ceil((response.total || 0) / 20));

        const formattedRequests = allVisitors.map((v: any) => {
          const colors = ["bg-purple-500", "bg-pink-500", "bg-yellow-400", "bg-teal-500", "bg-lavender-400", "bg-blue-500"];
          const visitorName = v.full_name || v.name || v.visitorName || "Unknown";
          const colorIndex = visitorName.charCodeAt(0) % colors.length;
          const initials = visitorName.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase();

          let identification = "N/A";
          if (typeof v.identification === "string") identification = v.identification;
          else if (v.identification?.number) identification = v.identification.number;

          let badgeNumber = "";
          if (v.badge_number) badgeNumber = v.badge_number;

          const myAssignment = v.departments_assigned?.find((d: any) => String(d.provider_id) === myId);
          const checkInTime = myAssignment?.assigned_time || v.entry_date || new Date().toISOString();

          const serviceDuration = v.durations?.services_durations?.find((d: any) => String(d.provider_id) === myId && d.ended_at === null);
          const serviceStartTimeVal = serviceDuration?.started_at || "";

          let myServiceStatus = null;
          if (Array.isArray(v.services_status)) {
            myServiceStatus = v.services_status.find((s: any) => String(s.provider_id) === myId);
          }

          let status = (myServiceStatus?.s_type || v.status || "Not started").toLowerCase();
          if (status === "not started") status = "Not started";
          if (status === "inprogress") status = "inprogress";
          if (status === "completed") status = "completed";
          if (status === "transfered" || status === "transferred") status = "transfered";

          const waitTimeEndStamp = (status === "inprogress" || status === "completed" || status === "transfered") && serviceStartTimeVal ? new Date(serviceStartTimeVal).getTime() : new Date().getTime();

          let waitTimeString = "Just now";
          if (checkInTime) {
            const diffMins = Math.floor((waitTimeEndStamp - new Date(checkInTime).getTime()) / 60000);
            if (diffMins > 0) {
              const hours = Math.floor(diffMins / 60);
              const mins = diffMins % 60;
              waitTimeString = hours > 0 ? `${hours}h ${mins}m` : `${mins} mins`;
            }
          }

          const assignedToDisplay = myAssignment?.provider_name || myAssignment?.department_name || "Unassigned";

          return {
            id: v._id || v.id,
            visitorName: visitorName,
            visitorId: identification,
            badgeNumber: badgeNumber,
            assignedTo: assignedToDisplay,
            serviceType: myAssignment?.department_name || v._departmentGroup || "General Service",
            waitTime: waitTimeString,
            avatarColor: colors[colorIndex],
            initials: initials,
            status: status,
            serviceStartTime: serviceStartTimeVal,
            telephone: v.telephone || "N/A",
            checkInRaw: checkInTime,
            rawVisitor: v,
          };
        });

        setRequests(formattedRequests);
      }
    } catch (error) {
      console.error("Error fetching assigned visitors:", error);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user, currentPage, searchTerm]);

  useEffect(() => {
    fetchAssignedVisitors(false);
  }, [fetchAssignedVisitors]);

  const handleVisitorClick = (request: any) => {
    navigate(`/service-delivery/visitors/${request.id}`);
  };

  const handleServeClick = async (request: any) => {
    if (request.status === "completed") return;
    // simplified
  };

  const handleTransferClick = (request: any) => {
    // simplified
  };

  return (
    <div className={isDashboardView ? "" : "p-7"}>
      <div className="bg-white rounded-[14px] p-4 shadow-[0_1px_4px_rgba(0,0,0,0.07)] mt-4 overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-[#f0f0f0]">
              <th className="text-left py-3 px-2 text-[#999] text-[11px] uppercase tracking-wider font-medium w-[25%]">VISITOR</th>
              <th className="text-left py-3 px-2 text-[#999] text-[11px] uppercase tracking-wider font-medium w-[20%]">BADGE & ID</th>
              <th className="text-left py-3 px-2 text-[#999] text-[11px] uppercase tracking-wider font-medium w-[15%]">ASSIGNED TO</th>
              <th className="text-left py-3 px-2 text-[#999] text-[11px] uppercase tracking-wider font-medium w-[15%]">WAIT TIME</th>
              <th className="text-left py-3 px-2 text-[#999] text-[11px] uppercase tracking-wider font-medium w-[15%]">STATUS</th>
              <th className="text-left py-3 px-2 text-[#999] text-[11px] uppercase tracking-wider font-medium w-[10%]">ACTION</th>
            </tr>
          </thead>
          <tbody>
            {loading && requests.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500">Loading requests...</td>
              </tr>
            ) : requests.length > 0 ? (
              requests.map((request) => (
                <tr key={request.id} onClick={() => handleVisitorClick(request)}  className="border-b cursor-pointer border-[#f8f8f8] h-14">
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full ${request.avatarColor} flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0`}>
                        {request.initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[#333] text-[13px] font-medium truncate cursor-pointer hover:text-[#1a73e8] hover:underline inline-flex items-center gap-2"  title="Click to view visitor details">
                          {request.visitorName}
                          <span className="inline-block w-4 h-4 text-gray-400" title="Click for details">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </span>
                        </div>
                        <div className="text-[#888] text-[11px] truncate">
                          {request.telephone !== "____" ? request.telephone : "No phone"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    <div className="text-[#333] text-[13px] font-medium">
                      {request.badgeNumber ? `Badge: ${request.badgeNumber}` : "No Badge"}
                    </div>
                    <div className="text-[#888] text-[11px]">
                      ID: {request.visitorId}
                    </div>
                  </td>
                  <td className="py-3 px-2 text-[#333] text-[13px] font-medium">
                    {request.assignedTo}
                  </td>
                  <td className="py-3 px-2 text-[#666] text-[13px] font-medium">
                    {request.waitTime}
                  </td>
                  <td className="py-3 px-2">
                    {request.status === "Not started" && (
                      <span className="inline-flex items-center px-3 py-1 rounded-[20px] text-[12px] font-bold uppercase tracking-wide bg-[#fff3e0] text-[#f57c00]">Not Started</span>
                    )}
                    {request.status === "inprogress" && (
                      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-[20px] text-[12px] font-bold uppercase tracking-wide bg-[#e3f2fd] text-[#1a73e8]">
                        <FiClock className="w-3 h-3 animate-pulse" />
                        In Progress
                      </span>
                    )}
                    {request.status === "completed" && (
                      <span className="inline-flex items-center px-3 py-1 rounded-[20px] text-[12px] font-bold uppercase tracking-wide bg-[#e8f5e9] text-[#2e7d32]">Completed</span>
                    )}
                    {request.status === "transfered" && (
                      <span className="inline-flex items-center px-3 py-1 rounded-[20px] text-[12px] font-bold uppercase tracking-wide bg-[#f3e5f5] text-[#7b1fa2]">Transferred</span>
                    )}
                  </td>
                  <td className="py-3 px-2">
                    {request.status === "completed" ? (
                      <span className="text-[#34a853] text-[12px] font-medium">✓ Served</span>
                    ) : request.status === "inprogress" ? (
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleServeClick(request)} disabled={isServing} className="h-8 w-20 bg-[#e53935] text-white text-[12px] font-bold rounded-[6px] hover:bg-[#c62828] transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
                          <FiSquare className="w-3 h-3 fill-current" /> Stop
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleServeClick(request)} disabled={isServing} className="h-8 w-16 bg-[#1a73e8] text-white text-[12px] font-bold rounded-[6px] hover:bg-[#1558c0] transition-colors disabled:opacity-50">
                          Serve
                        </button>
                        <button onClick={() => handleTransferClick(request)} disabled={isServing} className="h-8 w-20 bg-[#7b1fa2] text-white text-[12px] font-bold rounded-[6px] hover:bg-[#6a1b9a] transition-colors disabled:opacity-50 flex items-center justify-center gap-1">
                          <FiArrowRightCircle className="w-3 h-3" /> Transfer
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="text-center py-8 text-gray-500">
                  {searchTerm ? "No visitors found matching your search." : "No visitors found for your department."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProvideServicesTab;