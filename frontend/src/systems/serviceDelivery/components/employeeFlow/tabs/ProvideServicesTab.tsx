import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FiSearch, FiClock, FiCheckCircle, FiRefreshCw, FiArrowRightCircle, FiLoader } from "react-icons/fi";
import { useAuth } from "../../../../../core/contexts/AuthContext";
import { serviceDeliveryService, departmentService, employeeService } from "../../../../../core/services/adminService";
import { useToast } from "../../../../../core/contexts/ToastContext";
import { SearchableSelect, LiveTimer, TransferModal } from "./sub";

export interface ProvideServicesTabProps { isDashboardView?: boolean; }

const ProvideServicesTab: React.FC<ProvideServicesTabProps> = ({ isDashboardView = false }) => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchSuggestions, setSearchSuggestions] = useState<any[]>([]);
  const [showSearchPreview, setShowSearchPreview] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isServing, setIsServing] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferVisitor, setTransferVisitor] = useState<any>(null);
  const [transferDepartment, setTransferDepartment] = useState<string>("");
  const [transferEmployee, setTransferEmployee] = useState<any>(null);
  const [transferring, setTransferring] = useState(false);
  const [departments, setDepartments] = useState<any[]>([]);
  const [transferEmployees, setTransferEmployees] = useState<any[]>([]);
  const [transferEmployeesLoading, setTransferEmployeesLoading] = useState(false);
  const [units, setUnits] = useState<any[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<string>("");

  const currentUser = user as any;
  const myId = String(currentUser?.userId || currentUser?._id || currentUser?.id || currentUser?.employee_id || "");
  const myName = String(currentUser?.full_name || currentUser?.fullName || currentUser?.name || "Unknown").trim();

  const formatVisitors = (allVisitors: any[]) => {
    return allVisitors.map((v: any) => {
      const colors = ["bg-purple-500","bg-pink-500","bg-yellow-400","bg-teal-500","bg-lavender-400","bg-blue-500"];
      const visitorName = v.full_name || v.name || v.visitorName || "Unknown";
      const colorIndex = visitorName.charCodeAt(0) % colors.length;
      const initials = visitorName.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase();
      let identification = "N/A";
      if (typeof v.identification === "string") identification = v.identification;
      else if (v.identification?.number) identification = v.identification.number;
      let badgeNumber = v.badge_number || "";
      const myAssignment = v.departments_assigned?.find((d: any) => String(d.provider_id) === myId);
      const checkInTime = myAssignment?.assigned_time || v.entry_date || new Date().toISOString();
      const serviceDuration = v.durations?.services_durations?.find((d: any) => String(d.provider_id) === myId && d.ended_at === null);
      const serviceStartTimeVal = serviceDuration?.started_at || "";
      let myServiceStatus = null;
      if (Array.isArray(v.services_status)) myServiceStatus = v.services_status.find((s: any) => String(s.provider_id) === myId);
      let status = (myServiceStatus?.s_type || v.status || "Not started").toLowerCase();
      if (status === "not started") status = "Not started";
      if (status === "inprogress") status = "inprogress";
      if (status === "completed") status = "completed";
      if (status === "transfered" || status === "transferred") status = "transfered";
      const waitTimeEndStamp = (status === "inprogress" || status === "completed" || status === "transfered") && serviceStartTimeVal ? new Date(serviceStartTimeVal).getTime() : new Date().getTime();
      let waitTimeString = "Just now";
      if (checkInTime) { const diffMins = Math.floor((waitTimeEndStamp - new Date(checkInTime).getTime()) / 60000); if (diffMins > 0) { const hours = Math.floor(diffMins / 60); const mins = diffMins % 60; waitTimeString = hours > 0 ? `${hours}h ${mins}m` : `${mins} mins`; } }
      const assignedToDisplay = myAssignment?.provider_name || myAssignment?.department_name || "Unassigned";
      return { id: v._id || v.id, visitorName, visitorId: identification, badgeNumber, assignedTo: assignedToDisplay, serviceType: myAssignment?.department_name || v._departmentGroup || "General Service", waitTime: waitTimeString, avatarColor: colors[colorIndex], initials, status, serviceStartTime: serviceStartTimeVal, telephone: v.telephone || "N/A", checkInRaw: checkInTime, rawVisitor: v, not_transferred_to_me: myServiceStatus ? String(myServiceStatus.provider_id) !== myId && myServiceStatus.s_type?.toLowerCase() === "transferred" : false };
    });
  };

  const fetchSearchSuggestions = useCallback(async (query: string) => {
    if (!query || query.trim().length === 0) { setSearchSuggestions([]); setShowSearchPreview(false); return; }
    try {
      const response = await serviceDeliveryService.search(query, 1, 5);
      if (response && response.success) {
        const allVisitors: any[] = response.data || [];
        const formattedSuggestions = allVisitors.map((v: any) => {
          const colors = ["bg-purple-500","bg-pink-500","bg-yellow-400","bg-teal-500","bg-lavender-400","bg-blue-500"];
          const visitorName = v.full_name || v.name || v.visitorName || "Unknown";
          const colorIndex = visitorName.charCodeAt(0) % colors.length;
          const initials = visitorName.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase();
          let identification = "N/A";
          if (typeof v.identification === "string") identification = v.identification;
          else if (v.identification?.number) identification = v.identification.number;
          let badgeNumber = v.badge_number || "";
          const myAssignment = v.departments_assigned?.find((d: any) => String(d.provider_id) === myId);
          const checkInTime = myAssignment?.assigned_time || v.entry_date || new Date().toISOString();
          const serviceDuration = v.durations?.services_durations?.find((d: any) => String(d.provider_id) === myId && d.ended_at === null);
          const serviceStartTimeVal = serviceDuration?.started_at || "";
          let myServiceStatus = null;
          if (Array.isArray(v.services_status)) myServiceStatus = v.services_status.find((s: any) => String(s.provider_id) === myId);
          let status = (myServiceStatus?.s_type || v.status || "Not started").toLowerCase();
          if (status === "not started") status = "Not started";
          if (status === "inprogress") status = "inprogress";
          if (status === "completed") status = "completed";
          if (status === "transfered" || status === "transferred") status = "transfered";
          const waitTimeEndStamp = (status === "inprogress" || status === "completed" || status === "transfered") && serviceStartTimeVal ? new Date(serviceStartTimeVal).getTime() : new Date().getTime();
          let waitTimeString = "Just now";
          if (checkInTime) { const diffMins = Math.floor((waitTimeEndStamp - new Date(checkInTime).getTime()) / 60000); if (diffMins > 0) { const hours = Math.floor(diffMins / 60); const mins = diffMins % 60; waitTimeString = hours > 0 ? `${hours}h ${mins}m` : `${mins} mins`; } }
          return { id: v._id || v.id, visitorName, visitorId: identification, badgeNumber, assignedTo: myAssignment?.provider_name || myAssignment?.department_name || "Unassigned", serviceType: myAssignment?.department_name || v._departmentGroup || "General Service", waitTime: waitTimeString, avatarColor: colors[colorIndex], initials, status, serviceStartTime: serviceStartTimeVal, telephone: v.telephone || "N/A", checkInRaw: checkInTime, rawVisitor: v, not_transferred_to_me: myServiceStatus ? String(myServiceStatus.provider_id) !== myId && myServiceStatus.s_type?.toLowerCase() === "transferred" : false };
        }).reverse();
        setSearchSuggestions(formattedSuggestions);
        setShowSearchPreview(true);
      }
    } catch (error) { console.error(error); }
  }, [myId]);

  const handleSuggestionClick = async (suggestion: any) => {
    setSearchTerm(suggestion.visitorName); setShowSearchPreview(false); setSearchSuggestions([]); setCurrentPage(1);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    try {
      const response = await serviceDeliveryService.search(suggestion.visitorName, 1, 20);
      if (response && response.success) { const allVisitors: any[] = response.data || []; setRequests(formatVisitors(allVisitors)); setTotalCount(allVisitors.length); setTotalPages(Math.ceil(allVisitors.length / 20)); }
    } catch (error) { console.error(error); }
  };

  const fetchAssignedVisitors = useCallback(async (silent: boolean = false, page: number = currentPage, query: string = searchTerm) => {
    if (!myId || myId === "undefined") { if (!silent) setLoading(false); return; }
    try { if (!silent) setLoading(true); let response; if (query && query.trim()) response = await serviceDeliveryService.search(query, page, 20); else response = await serviceDeliveryService.getCurrentVisitorsByProvider(myId, page, 20);
      if (response && response.success) { const allVisitors: any[] = response.data || []; setTotalCount(response.total || 0); setTotalPages(Math.ceil((response.total || 0) / 20)); setRequests(formatVisitors(allVisitors)); }
    } catch (error) { console.error(error); } finally { if (!silent) setLoading(false); }
  }, [myId, currentPage, searchTerm]);

  const fetchDepartments = async () => { try { const response = (await departmentService.getAll()) as any; if (response && (response.data || Array.isArray(response))) setDepartments(Array.isArray(response.data) ? response.data : response); } catch (error) { console.error(error); } };
  const fetchTransferEmployees = async (deptId: string) => { if (!deptId) { setTransferEmployees([]); return; } setTransferEmployeesLoading(true); try { const response = (await employeeService.getByDepartment(deptId, false)) as any; if (response && (response.data || Array.isArray(response))) setTransferEmployees(Array.isArray(response.data) ? response.data : response); } catch (error) { setTransferEmployees([]); } finally { setTransferEmployeesLoading(false); } };
  const loadUnitsByDepartment = async (departmentId: string) => { setTransferEmployeesLoading(true); try { const response = await departmentService.getAll(); if (response.status || response.success) { const deptData = Array.isArray(response.data) ? response.data : []; const subDepts = deptData.filter((dept: any) => (dept.sub_department_mng?.is_sub_department === true || dept.sub_department_mng?.is_sub_department === "true") && String(dept.sub_department_mng?.parent_department_id) === String(departmentId)); setUnits(subDepts.map((subDept: any) => ({ id: subDept._id || subDept.department_id, name: subDept.department_name || subDept.name, staffAvailable: subDept.total_employees || 0, currentQueue: 0, isActive: true }))); } else setUnits([]); } catch (error) { setUnits([]); } finally { setTransferEmployeesLoading(false); } };

  const handleTransferVisitor = async () => {
    if (!transferVisitor || !transferDepartment) return;
    setTransferring(true);
    try {
      const targetId = selectedUnit || transferDepartment;
      const targetInfo = selectedUnit ? units.find((u) => u.id === selectedUnit) : departments.find((d) => d._id === transferDepartment);
      const targetName = targetInfo?.name || targetInfo?.department_name || "Unknown";
      const currentDept = transferVisitor.rawVisitor?.departments_assigned?.find((d: any) => String(d.provider_id) === myId);
      const previousDepartmentId = currentDept?.department_id;
      const providerId = transferEmployee ? String(transferEmployee._id || transferEmployee.employee_id || "") : undefined;
      const providerName = transferEmployee ? String(transferEmployee.full_name || "") : undefined;
      setRequests((prev) => prev.map((r) => r.id === transferVisitor.id ? { ...r, status: "transfered", assignedTo: providerName || `${targetName}` || "Transferred" } : r));
      await serviceDeliveryService.assignToDepartment(transferVisitor.id, targetId, targetName, providerId, providerName, previousDepartmentId);
      setShowTransferModal(false); setTransferVisitor(null); setTransferDepartment(""); setTransferEmployee(null); setTransferEmployees([]); setUnits([]); setSelectedUnit("");
      fetchAssignedVisitors(true);
    } catch (error) { console.error(error); alert("Failed to transfer"); fetchAssignedVisitors(true); } finally { setTransferring(false); }
  };

  const handleTransferClick = (e: React.MouseEvent<HTMLButtonElement>, request: any) => { e.stopPropagation(); if (request.status === "completed") return; setTransferVisitor(request); setTransferDepartment(""); setTransferEmployee(null); setTransferEmployees([]); setUnits([]); setSelectedUnit(""); setShowTransferModal(true); };
  const handleVisitorClick = (request: any) => navigate(`/service-delivery/visitors/${request.id}`);
  const handleSearchTyping = useCallback((value: string) => {
    setSearchTerm(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (value && value.trim().length >= 1) searchTimeoutRef.current = setTimeout(() => fetchSearchSuggestions(value), 1);
    else { setSearchSuggestions([]); setShowSearchPreview(false); }
  }, [fetchSearchSuggestions]);

  const filteredRequests = requests
    .filter((request) => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || request.visitorName.toLowerCase().includes(searchLower) || request.visitorId.toLowerCase().includes(searchLower) || request.badgeNumber.toLowerCase().includes(searchLower) || request.telephone?.toLowerCase().includes(searchLower);
      let normalizedStatus = request.status.replace(/[\s_]+/g, "-").toLowerCase();
      if (normalizedStatus === "transfered") normalizedStatus = "transferred";
      const matchesStatus = statusFilter === "all" || normalizedStatus === statusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => { const statusOrder: Record<string, number> = { inprogress: 1, transfered: 2, transferred: 2, "not-started": 3, completed: 4 }; return (statusOrder[a.status.replace(/[\s_]+/g, "-").toLowerCase()] ?? 99) - (statusOrder[b.status.replace(/[\s_]+/g, "-").toLowerCase()] ?? 99); });

  const paginatedRequests = filteredRequests.slice((currentPage - 1) * 20, currentPage * 20);

  useEffect(() => { return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); }; }, []);
  useEffect(() => { fetchDepartments(); }, []);
  useEffect(() => { if (searchTerm?.trim()?.length >= 1) return; const interval = setInterval(() => { fetchAssignedVisitors(true, currentPage, searchTerm); }, 10000); return () => clearInterval(interval); }, [isDashboardView, searchTerm, fetchAssignedVisitors, currentPage]);
  useEffect(() => { fetchAssignedVisitors(false); }, []);

  return (
    <div className={isDashboardView ? "" : "p-4"}>
      <div className={`bg-white p-4 shadow-sm ${!isDashboardView ? "mt-4" : ""}`}>
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex">
              <div className="flex-1 relative min-w-0">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input type="text" placeholder="Search by visitor name, ID, or badge..." value={searchTerm} onChange={(e) => handleSearchTyping(e.target.value)} className="w-full h-10 pl-9 pr-3 border border-gray-200 text-xs" onFocus={() => searchTerm && searchTerm?.trim()?.length >= 1 && setShowSearchPreview(true)} />
                {showSearchPreview && searchSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 shadow-lg max-h-60 overflow-y-auto" style={{ minWidth: "400px" }}>
                    <div className="py-1">{searchSuggestions.map((suggestion) => (
                      <div key={suggestion.id} onClick={() => handleSuggestionClick(suggestion)} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-blue-50">
                        <div className={`w-8 h-8 ${suggestion.avatarColor} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>{suggestion.initials}</div>
                        <div className="flex-1 min-w-0"><div className="text-gray-800 text-xs font-medium truncate">{suggestion.visitorName}</div><div className="text-gray-500 text-xs truncate">ID: {suggestion.visitorId}</div></div>
                        <div className="text-gray-600 text-xs whitespace-nowrap">
                          {suggestion.status === "Not started" && <span className="text-orange-600">Not started</span>}
                          {suggestion.status === "inprogress" && <span className="text-blue-600">In progress</span>}
                          {suggestion.status === "completed" && <span className="text-green-700">Completed</span>}
                          {suggestion.status === "transfered" && <span className="text-purple-700">Transferred</span>}
                        </div>
                      </div>
                    ))}</div>
                  </div>
                )}
                {showSearchPreview && <div className="fixed inset-0 z-40" onClick={() => setShowSearchPreview(false)} />}
              </div>
              <button onClick={() => { setCurrentPage(1); setShowSearchPreview(false); setSearchSuggestions([]); fetchAssignedVisitors(false, 1, searchTerm); }} disabled={loading} className="h-10 px-4 bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 justify-center">
                {loading && searchTerm ? <FiRefreshCw className="w-3 h-3 animate-spin" /> : null}
                {loading && searchTerm ? "Searching..." : "Search"}
              </button>
            </div>
          </div>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }} className="h-10 px-3 border border-gray-200 text-xs bg-white">
            <option value="all">All Status</option>
            <option value="not-started">Not Started</option>
            <option value="inprogress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
          {isDashboardView && (
            <button onClick={() => { setShowSearchPreview(false); setSearchSuggestions([]); if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); fetchAssignedVisitors(false); }} className="flex items-center gap-1.5 h-10 px-3 border border-gray-200 bg-white text-gray-700 text-xs hover:bg-gray-50 justify-center">
              <FiRefreshCw className={loading ? "animate-spin" : ""} /> Refresh
            </button>
          )}
        </div>
      </div>

      <div className="bg-white p-4 mt-4 shadow-sm overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="bg-blue-600 border-b border-gray-200">
              <th className="text-left text-xs font-semibold text-white uppercase px-3 py-2.5 w-[5%]">NAME / TEL</th>
              <th className="text-left text-xs font-semibold text-white uppercase px-3 py-2.5 w-[15%]">BADGE / ID</th>
              <th className="text-left text-xs font-semibold text-white uppercase px-3 py-2.5 w-[12%]">SERVICE</th>
              <th className="text-left py-2.5 px-2 text-white text-xs uppercase tracking-wider font-medium w-[15%]">DURATIONS</th>
              <th className="text-left py-2.5 px-2 text-white text-xs uppercase tracking-wider font-medium w-[15%]">STATUS</th>
              <th className="text-left py-2.5 px-2 text-white text-xs uppercase tracking-wider font-medium w-[10%]">ACTION</th>
            </tr>
          </thead>
          <tbody>
            {loading && requests.length === 0 ? (
              <tr><td colSpan={6} className="py-8 text-center text-gray-500"><div className="flex items-center justify-center p-8"><div className="h-6 w-6   mx-auto"> <FiLoader className="animate-spin h-6 w-6 text-blue-600" /> </div></div></td></tr>
            ) : paginatedRequests.length > 0 ? (
              paginatedRequests.map((request) => (
                <tr title="Click to view visitor details" key={request.id} className="border-b border-gray-100 h-12 cursor-pointer hover:bg-gray-50" onClick={() => handleVisitorClick(request)}>
                  <td className="py-2.5 px-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 ${request.avatarColor} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>{request.initials}</div>
                      <div className="min-w-0 flex-1">
                        <div onClick={() => handleVisitorClick(request)} className="text-gray-800 text-xs font-medium truncate cursor-pointer hover:text-blue-600 hover:underline inline-flex items-center gap-1">{request.visitorName}</div>
                        <div className="text-gray-500 text-xs truncate">{request.telephone !== "____" ? request.telephone : "No phone"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-2">
                    <div className="text-gray-800 text-xs font-medium">{request.badgeNumber ? `Badge: ${request.badgeNumber}` : "No Badge"}</div>
                    <div className="text-gray-500 text-xs">ID: {request.visitorId}</div>
                  </td>
                  <td className="py-2.5 px-2 text-gray-800 text-xs font-medium">{request.assignedTo}</td>
                  <td className="py-2.5 px-2 text-gray-600 text-xs font-medium">{request.waitTime}</td>
                  <td className="py-2.5 px-2">
                    {request.status === "Not started" && <span className="inline-flex items-center px-2 py-0.5 text-xs font-bold bg-orange-100 text-orange-700">Not Started</span>}
                    {request.status === "inprogress" && <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-bold bg-blue-100 text-blue-700"><FiClock className="w-3 h-3 animate-pulse" /><LiveTimer startTime={request.serviceStartTime} /></span>}
                    {request.status === "completed" && <span className="inline-flex items-center px-2 py-0.5 text-xs font-bold bg-green-100 text-green-700">Completed</span>}
                    {request.status === "transfered" && <span className="inline-flex items-center px-2 py-0.5 text-xs font-bold bg-purple-100 text-purple-700">Transferred</span>}
                  </td>
                  <td className="py-2.5 px-2">
                    {request.status === "completed" ? <span className="text-green-600 text-xs font-medium">✓ Served</span>
                    : <button title="Click to transfer visitor" onClick={(e) => handleTransferClick(e, request)} disabled={isServing} className="h-7 w-18 bg-purple-700 text-white text-xs font-bold hover:bg-purple-800 disabled:opacity-50 flex items-center justify-center gap-1"><FiArrowRightCircle className="w-3 h-3" /> Transfer</button>}
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={6} className="text-center py-8 text-gray-500">{searchTerm ? "No visitors found matching your search." : "No visitors found for your department."}</td></tr>
            )}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-4 pt-2 border-t border-gray-100">
            <div className="text-gray-600 text-xs">Showing {(currentPage - 1) * 20 + 1} to {Math.min(currentPage * 20, totalCount)} of {totalCount} visitors</div>
            <div className="flex gap-2">
              <button onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))} disabled={currentPage === 1} className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
              <span className="px-3 py-1.5 text-xs font-medium text-gray-700">Page {currentPage} of {totalPages}</span>
              <button onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
            </div>
          </div>
        )}
      </div>

      <TransferModal
        show={showTransferModal} onClose={() => { setShowTransferModal(false); setTransferVisitor(null); setTransferDepartment(""); setTransferEmployee(null); setTransferEmployees([]); setUnits([]); setSelectedUnit(""); }}
        departments={departments} units={units} transferDepartment={transferDepartment} selectedUnit={selectedUnit} transferring={transferring}
        transferVisitor={transferVisitor} transferEmployee={transferEmployee} transferEmployees={transferEmployees} transferEmployeesLoading={transferEmployeesLoading}
        onDepartmentChange={(id) => { setTransferDepartment(id); setTransferEmployee(null); setSelectedUnit(""); if (id) { loadUnitsByDepartment(id); fetchTransferEmployees(id); } else { setUnits([]); setTransferEmployees([]); } }}
        onUnitChange={setSelectedUnit}
        onEmployeeChange={setTransferEmployee}
        onTransfer={handleTransferVisitor}
      />
    </div>
  );
};

export default ProvideServicesTab;