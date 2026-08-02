import React, { useState, useEffect, useCallback, useRef } from "react";
import { FiSearch, FiRefreshCw, FiArrowRightCircle } from "react-icons/fi";
import { useAuth } from "../../../../../core/contexts/AuthContext";
import { useSocket } from "../../../../../core/contexts/SocketContext";
import { useToast } from "../../../../../core/contexts/ToastContext";
import { serviceDeliveryService, departmentService, employeeService } from "../../../../../core/services/adminService";
import Table from "../../../../../core/components/Table";
import EmployeeVisitorClicked from "../../../../../core/components/EmployeeVisitorClicked";
import { TransferModal } from "./sub";

const PRIMARY = "#056daa";
const SUCCESS = "#4CAF50";
const WARNING = "#F39C12";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const WHITE = "#FFFFFF";
const GRAY_DISABLED = "#9E9E9E";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";
const btnTypography: React.CSSProperties = { fontFamily: fontHeading, fontSize: 13, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' };

interface FormattedVisitor {
  id: string;
  visitorName: string;
  visitorId: string;
  badgeNumber: string;
  assignedTo: string;
  waitTime: string;
  initials: string;
  status: string;
  serviceStartTime: string;
  telephone: string;
  checkInRaw: string;
  rawVisitor: any;
  not_transferred_to_me: boolean;
}

const EmployeeVisitorsTab: React.FC = () => {
  const { user } = useAuth();
  const { showError } = useToast();
  const { socket, isConnected } = useSocket();

  const currentUser = user as any;
  const myId = String(currentUser?.userId || currentUser?._id || currentUser?.id || currentUser?.employee_id || "");

  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const resultsPerPage = 20;
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [visitors, setVisitors] = useState<FormattedVisitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<any[]>([]);
  const [transferEmployees, setTransferEmployees] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [showingTransferModal, setShowingTransferModal] = useState(false);
  const [showVisitorDetails, setShowVisitorDetails] = useState(false);
  const [selectedVisitorForDetails, setSelectedVisitorForDetails] = useState<any>(null);
  const [transferVisitor, setTransferVisitor] = useState<any>(null);
  const [transferDepartment, setTransferDepartment] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("");
  const [transferEmployee, setTransferEmployee] = useState<any>(null);
  const [transferEmployeesLoading, setTransferEmployeesLoading] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const formatVisitors = (allVisitors: any[]): FormattedVisitor[] => {
    return allVisitors.map((v: any) => {
      const visitorName = v.full_name || v.name || v.visitorName || "Unknown";
      const initials = visitorName.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase();
      let identification = "N/A";
      if (typeof v.identification === "string") identification = v.identification;
      else if (v.identification?.number) identification = v.identification.number;
      const badgeNumber = v.badge_number || "";
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
      if (checkInTime) {
        const diffMins = Math.floor((waitTimeEndStamp - new Date(checkInTime).getTime()) / 60000);
        if (diffMins > 0) {
          const hours = Math.floor(diffMins / 60);
          const mins = diffMins % 60;
          waitTimeString = hours > 0 ? `${hours}h ${mins}m` : `${mins} mins`;
        }
      }
      const assignedToDisplay = myAssignment?.provider_name || myAssignment?.department_name || "---";
      return {
        id: v._id || v.id,
        visitorName,
        visitorId: identification,
        badgeNumber,
        assignedTo: assignedToDisplay,
        waitTime: waitTimeString,
        initials,
        status,
        serviceStartTime: serviceStartTimeVal,
        telephone: v.telephone || "N/A",
        checkInRaw: checkInTime,
        rawVisitor: v,
        not_transferred_to_me: myServiceStatus ? String(myServiceStatus.provider_id) !== myId && myServiceStatus.s_type?.toLowerCase() === "transferred" : false,
      };
    }).reverse();
  };

  const fetchAssignedVisitors = useCallback(async (silent: boolean = false, page: number = currentPage, query: string = searchTerm) => {
    if (!myId || myId === "undefined") { if (!silent) setLoading(false); return; }
    try {
      if (!silent) setLoading(true);
      let response;
      if (query && query.trim()) {
        response = await serviceDeliveryService.search(query, page, resultsPerPage);
      } else {
        response = await serviceDeliveryService.getCurrentVisitorsByProvider(myId, page, resultsPerPage);
      }
      if (response && response.success) {
        const allVisitors: any[] = response.data || [];
        const formatted = formatVisitors(allVisitors);
        setVisitors(formatted);
        setTotalCount(response.total || 0);
        setTotalPages(Math.max(1, Math.ceil((response.total || 0) / resultsPerPage)));
      } else {
        setVisitors([]);
        setTotalCount(0);
        setTotalPages(1);
      }
    } catch (error) {
      console.error(error);
      setVisitors([]);
      setTotalCount(0);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [myId, currentPage, searchTerm]);

  const fetchDepartments = async () => {
    try {
      const response = await departmentService.getAll() as any;
      if (response && (response.data || Array.isArray(response))) {
        const deptData = Array.isArray(response.data) ? response.data : response;
        setDepartments(deptData);
      }
    } catch (error) { console.error(error); }
  };

  const fetchTransferEmployees = async (deptId: string) => {
    if (!deptId) { setTransferEmployees([]); return; }
    setTransferEmployeesLoading(true);
    try {
      const response = await employeeService.getByDepartment(deptId, false) as any;
      if (response && (response.data || Array.isArray(response))) {
        setTransferEmployees(Array.isArray(response.data) ? response.data : response);
      } else {
        setTransferEmployees([]);
      }
    } catch (error) { setTransferEmployees([]); }
    finally { setTransferEmployeesLoading(false); }
  };

  const loadUnitsByDepartment = async (departmentId: string) => {
    setTransferEmployeesLoading(true);
    try {
      const response = await departmentService.getAll();
      if (response.status || response.success) {
        const deptData = Array.isArray(response.data) ? response.data : [];
        const subDepts = deptData.filter((dept: any) =>
          (dept.sub_department_mng?.is_sub_department === true || dept.sub_department_mng?.is_sub_department === "true") &&
          String(dept.sub_department_mng?.parent_department_id) === String(departmentId)
        );
        setUnits(subDepts.map((subDept: any) => ({
          id: subDept._id || subDept.department_id,
          name: subDept.department_name || subDept.name,
          staffAvailable: subDept.total_employees || 0,
          currentQueue: 0,
          isActive: true,
        })));
      } else {
        setUnits([]);
      }
    } catch (error) { setUnits([]); }
    finally { setTransferEmployeesLoading(false); }
  };

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

      setVisitors((prev) => prev.map((r) => r.id === transferVisitor.id ? { ...r, status: "Transfered", assignedTo: providerName || targetName || "Transferred" } : r));

      await serviceDeliveryService.assignToDepartment(transferVisitor.id, targetId, targetName, providerId, providerName, previousDepartmentId);

      setShowingTransferModal(false);
      setTransferVisitor(null);
      setTransferDepartment("");
      setTransferEmployee(null);
      setTransferEmployees([]);
      setUnits([]);
      setSelectedUnit("");
      fetchAssignedVisitors(true);
    } catch (error) {
      console.error(error);
      showError("Failed to transfer visitor");
      fetchAssignedVisitors(true);
    } finally {
      setTransferring(false);
    }
  };

  const handleTransferClick = (e: React.MouseEvent<HTMLButtonElement>, request: FormattedVisitor) => {
    e.stopPropagation();
    if (request.status === "completed") return;
    setTransferVisitor(request);
    setTransferDepartment("");
    setTransferEmployee(null);
    setTransferEmployees([]);
    setUnits([]);
    setSelectedUnit("");
    setShowingTransferModal(true);
  };

  const handleSearchInput = (value: string) => {
    setSearchTerm(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (value && value.trim().length >= 1) {
      searchTimeoutRef.current = setTimeout(() => {
        setCurrentPage(1);
        fetchAssignedVisitors(false, 1, value);
      }, 500);
    } else {
      setCurrentPage(1);
      fetchAssignedVisitors(false, 1, "");
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    fetchAssignedVisitors(false, 1, searchTerm);
  };

  const handleRefresh = () => {
    fetchAssignedVisitors(false, currentPage, searchTerm);
  };

  const filteredVisitors = visitors.filter((request) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm ||
      request.visitorName.toLowerCase().includes(searchLower) ||
      request.visitorId.toLowerCase().includes(searchLower) ||
      request.badgeNumber.toLowerCase().includes(searchLower) ||
      (request.telephone || "").toLowerCase().includes(searchLower);
    return matchesSearch;
  });

  const paginatedVisitors = filteredVisitors.slice(0, resultsPerPage);

  useEffect(() => { return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); }; }, []);
  useEffect(() => { fetchDepartments(); }, []);
  useEffect(() => {
    if (myId && myId !== "undefined") {
      fetchAssignedVisitors(false);
    } else if (!myId || myId === "undefined") {
      setLoading(false);
    }
  }, [fetchAssignedVisitors, currentPage, searchTerm]);
  useEffect(() => {
    if (!socket || !isConnected) return;
    const h = () => fetchAssignedVisitors(true);
    socket.on("visitor_checkedin", h);
    socket.on("visitor_checkedout", h);
    socket.on("car_checkedin", h);
    socket.on("car_checkedout", h);
    socket.on("new_visitor_assigned", h);
    return () => {
      socket.off("visitor_checkedin", h);
      socket.off("visitor_checkedout", h);
      socket.off("car_checkedin", h);
      socket.off("car_checkedout", h);
      socket.off("new_visitor_assigned", h);
    };
  }, [socket, isConnected, fetchAssignedVisitors]);

  return (
    <div className="space-y-4 w-full " style={{ backgroundColor: NEUTRAL_LIGHT }}>
    <div className="w-full">
  <div className="flex  w-full flex-col sm:flex-row gap-2 sm:gap-3">
    
    <div className="relative flex-1 min-w-0">
      <input
        type="text"
        placeholder="Search by visitor name, ID, or badge..."
        value={searchTerm}
        onChange={(e) => handleSearchInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        className="w-full h-12 sm:h-14 pl-10 pr-3 text-base sm:text-lg  cok-auth-input"
      />
      <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 sm:w-6 sm:h-6" />
    </div>
    
    
    <button
      onClick={handleSearch}
      disabled={loading}
      className="flex-shrink-0 h-12 sm:h-14 px-6 sm:px-8 cok-btn-primary flex items-center justify-center gap-2 text-base sm:text-lg whitespace-nowrap max-w-[200px] min-w-[100px] sm:min-w-[120px]"
    >
      {loading ? (
        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
      ) : (
        <></>
      )}
      <span>{loading ? "Wait" : "Search"}</span>
    </button>
  </div>
</div>

      <div
        className="overflow-hidden"
        style={{
          backgroundColor: WHITE,
          boxShadow: CARD_SHADOW,
          borderRadius: 0,
        }}
      >
        <Table
          headers={[
            { key: "badge", label: "BADGE" },
            { key: "visitor", label: "NAME" },
            { key: "id", label: "ID" },
            { key: "phone", label: "PHONE" },
            { key: "service", label: "ASSIGNED TO" },
            { key: "duration", label: "WAIT TIME" },
            { key: "status", label: "STATUS" },
            { key: "action", label: "IS SERVED" },
          ]}
          data={paginatedVisitors}
          loading={loading && visitors.length === 0}
          emptyMessage="No visitors found for your department."
          headerClassName="cok-bg-primary"
          onRowClick={(v: any) => {
            setSelectedVisitorForDetails(v.rawVisitor || v);
            setShowVisitorDetails(true);
          }}
          pagination={{
            currentPage,
            totalPages,
            totalCount,
            itemsPerPage: resultsPerPage,
            onPageChange: (p) => {
              setCurrentPage(p);
            },
            loading,
          }}
          renderCell={(header, v: any) => {
            switch (header.key) {
              case "badge":
                return (
                  <span
                    className="text-xs px-2 py-0.5"
                    style={{
                      backgroundColor: "rgba(5,109,170,0.1)",
                      color: PRIMARY,
                      borderRadius: 0,
                    }}
                  >
                    {v.badgeNumber || "---"}
                  </span>
                );
              case "visitor":
                return (
                  <div className="flex items-center gap-2">
                    <div
                      className="w-7.5 h-7.5 flex items-center justify-center text-xs font-bold"
                      style={{
                        backgroundColor: "rgba(5,109,170,0.1)",
                        color: PRIMARY,
                        borderRadius: 999,
                      }}
                    >
                      {v.initials}
                    </div>
                    <span className="text-sm font-semibold" style={{ color: NEUTRAL_DARK }}>
                      {v.visitorName}
                    </span>
                  </div>
                );
              case "id":
                return (
                  <span className="text-xs" style={{ color: "#555555" }}>
                    {v.visitorId}
                  </span>
                );
              case "phone":
                return (
                  <span className="text-xs" style={{ color: "#555555" }}>
                    {v.telephone || "---"}
                  </span>
                );
              case "service":
                return <span className="text-xs font-medium" style={{ color: NEUTRAL_DARK }}>{v.assignedTo}</span>;
              case "duration":
                return <span className="text-xs font-semibold" style={{ color: "#555555" }}>{v.waitTime}</span>;
              case "status":
                return (
                  <span
                    className="text-xs px-2 py-0.5 font-bold uppercase"
                    style={{
                      borderRadius: 0,
                      backgroundColor:
                        v.status === "inprogress"
                          ? "rgba(76,175,80,0.12)"
                          : v.status === "completed"
                            ? "rgba(51,51,51,0.08)"
                            : v.status === "transfered"
                              ? "rgba(41,128,185,0.12)"
                              : "rgba(243,156,18,0.12)",
                      color:
                        v.status === "inprogress"
                          ? SUCCESS
                          : v.status === "completed"
                            ? "#555555"
                            : v.status === "transfered"
                              ? "#2980B9"
                              : WARNING,
                    }}
                  >
                    {v.status === "Not started" ? "Not Started" : v.status === "inprogress" ? "In Progress" : v.status === "completed" ? "Completed" : v.status === "transfered" ? "Transferred" : v.status}
                  </span>
                );
              case "action":
                return v.status === "completed" ? (
                  <span className="text-xs" style={{ color: SUCCESS, fontWeight: 600 }}>
                    ✓ Served
                  </span>
                ) : (
                  <span className="text-xs" style={{ color: "#555555", fontWeight: 600 }}>
                    PENDING
                  </span>
                );
              default:
                return <span className="text-xs" style={{ color: "#555555" }}>{v[header.key] || "-"}</span>;
            }
          }}
         />
       </div>

      <EmployeeVisitorClicked
        isOpen={showVisitorDetails}
        onClose={() => { setShowVisitorDetails(false); setSelectedVisitorForDetails(null); }}
        visitor={selectedVisitorForDetails}
        myProviderId={myId}
        onSaved={() => fetchAssignedVisitors(true)}
      />
    </div>
  );
};

export default EmployeeVisitorsTab;
