// DepartmentQueueTab.tsx - In-house visitors assigned to the user's department
import React, { useState, useEffect, useCallback, useRef } from "react";
import { FiSearch } from "react-icons/fi";
import SpiralLoader from "@/systems/event-managment/components/SpiralLoader";
import { useAuth } from "../../../../../core/contexts/AuthContext";
import { useToast } from "../../../../../core/contexts/ToastContext";
import { serviceDeliveryService } from "../../../../../core/services/adminService";
import Table from "../../../../../core/components/Table";
import EmployeeVisitorClicked from "../../../../../core/components/EmployeeVisitorClicked";

const PRIMARY = "#056daa";
const SUCCESS = "#4CAF50";
const WARNING = "#F39C12";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const WHITE = "#FFFFFF";
const GRAY_DISABLED = "#9E9E9E";
const GRAY_MID = "#555555";
const fontHeading = "'Montserrat', sans-serif";
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

interface QueueSummary {
  is_parent_department: boolean;
  total_units: number;
  visitors_in_department: number;
  currently_serving: number;
  units: Array<{
    unit_id: string;
    unit_name: string;
    total_assigned: number;
    currently_serving: number;
  }>;
}

// departmentScope: HOD mode — the backend already scopes the queue to the department(s)
// the user leads; rows are matched by their first assignment and actions are hidden
const DepartmentQueueTab: React.FC<{ departmentScope?: boolean }> = ({ departmentScope = false }) => {
  const { user } = useAuth();
  const { showError } = useToast();

  const currentUser = user as any;
  const myId = String(currentUser?.userId || currentUser?._id || currentUser?.id || currentUser?.employee_id || "");

  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const resultsPerPage = 20;
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [visitors, setVisitors] = useState<FormattedVisitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [queueSummary, setQueueSummary] = useState<QueueSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [showVisitorDetails, setShowVisitorDetails] = useState(false);
  const [selectedVisitorForDetails, setSelectedVisitorForDetails] = useState<any>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const formatVisitors = (allVisitors: any[]): FormattedVisitor[] => {
    return allVisitors.map((v: any) => {
      const visitorName = v.full_name || v.name || v.visitorName || "Unknown";
      const initials = visitorName.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase();
      let identification = "N/A";
      if (typeof v.identification === "string") identification = v.identification;
      else if (v.identification?.number) identification = v.identification.number;
      const badgeNumber = v.badge_number || "";
      const myAssignment = departmentScope
        ? v.departments_assigned?.[0]
        : v.departments_assigned?.find((d: any) => String(d.provider_id) === myId);
      const checkInTime = myAssignment?.assigned_time || v.entry_date || new Date().toISOString();
      const serviceDuration = departmentScope
        ? v.durations?.services_durations?.find((d: any) => d.ended_at === null)
        : v.durations?.services_durations?.find((d: any) => String(d.provider_id) === myId && d.ended_at === null);
      const serviceStartTimeVal = serviceDuration?.started_at || "";
      let myServiceStatus = null;
      if (Array.isArray(v.services_status)) {
        myServiceStatus = departmentScope
          ? v.services_status[0]
          : v.services_status.find((s: any) => String(s.provider_id) === myId);
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
        response = await serviceDeliveryService.getCurrentVisitorsByProvider(myId, page, resultsPerPage, true);
      } else {
        response = await serviceDeliveryService.getCurrentVisitorsByProvider(myId, page, resultsPerPage, true);
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
      showError("Failed to load department queue");
      setVisitors([]);
      setTotalCount(0);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [myId, currentPage, searchTerm, showError]);

  const fetchQueueSummary = useCallback(async (silent: boolean = false) => {
    if (!myId || myId === "undefined") return;
    try {
      if (!silent) setSummaryLoading(true);
      const response = await serviceDeliveryService.getQueueSummary(true);
      if (response && response.success) {
        setQueueSummary(response);
      } else {
        setQueueSummary(null);
      }
    } catch (error) {
      console.error(error);
      showError("Failed to load queue summary");
      setQueueSummary(null);
    } finally {
      if (!silent) setSummaryLoading(false);
    }
  }, [myId, showError]);

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
    fetchQueueSummary();
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
  useEffect(() => {
    if (myId && myId !== "undefined") {
      fetchAssignedVisitors(false);
      fetchQueueSummary();
    } else if (!myId || myId === "undefined") {
      setLoading(false);
      setSummaryLoading(false);
    }
  }, [fetchAssignedVisitors, fetchQueueSummary, myId]);

  // Silent refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (myId && myId !== "undefined") {
        fetchAssignedVisitors(true);
        fetchQueueSummary(true);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchAssignedVisitors, fetchQueueSummary, myId]);

  return (
    <div className="space-y-4 w-full" style={{ backgroundColor: NEUTRAL_LIGHT }}>
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-base font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Department Queue</h1>
        </div>
        <div className="px-3 py-1.5 text-xs font-bold" style={{ fontFamily: fontHeading, color: PRIMARY, backgroundColor: 'rgba(5,109,170,0.08)' }}>{totalCount} Records</div>
      </div>

      {/* Top search bar */}
      <div className="w-full">
        <div className="flex w-full flex-col sm:flex-row gap-2 sm:gap-3">
          <div className="relative flex-1 min-w-0">
            <input
              type="text"
              placeholder="Search by visitor name, ID, or badge..."
              value={searchTerm}
              onChange={(e) => handleSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-full h-12 sm:h-14 pl-10 pr-3 text-base sm:text-lg cok-auth-input"
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2 bg-white overflow-hidden" style={{ border: `1px solid ${BORDER}`, borderRadius: 0 }}>
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
            emptyMessage="No visitors found in your department queue."
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

        <div className="bg-white p-4" style={{ border: `1px solid ${BORDER}`, borderRadius: 0 }}>
          <h3 className="text-sm font-bold uppercase mb-4" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK, letterSpacing: "1px" }}>Queue Summary</h3>
          {summaryLoading ? (
            <div className="flex items-center justify-center py-8">
              <SpiralLoader />
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {(queueSummary?.is_parent_department || (queueSummary?.total_units ?? 0) > 0) && (
                  <div className="p-4" style={{ border: `1px solid ${BORDER}`, borderRadius: 0 }}>
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ fontFamily: fontHeading, color: GRAY_MID }}>Total Units</p>
                    <p className="text-2xl font-bold mt-1" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>{queueSummary?.total_units ?? 0}</p>
                    <p className="text-xs mt-0.5" style={{ color: GRAY_DISABLED }}>Units under your department</p>
                  </div>
                )}
                <div className="p-4" style={{ border: `1px solid ${BORDER}`, borderRadius: 0 }}>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ fontFamily: fontHeading, color: GRAY_MID }}>Visitors in Department</p>
                  <p className="text-2xl font-bold mt-1" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>{queueSummary?.visitors_in_department ?? 0}</p>
                  <p className="text-xs mt-0.5" style={{ color: GRAY_DISABLED }}>In-house visitors assigned to you</p>
                </div>
                <div className="p-4" style={{ border: `1px solid ${BORDER}`, borderRadius: 0 }}>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ fontFamily: fontHeading, color: GRAY_MID }}>Currently Serving</p>
                  <p className="text-2xl font-bold mt-1" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>{queueSummary?.currently_serving ?? 0}</p>
                  <p className="text-xs mt-0.5" style={{ color: GRAY_DISABLED }}>Visitors being served right now</p>
                </div>
              </div>
              {queueSummary && Array.isArray(queueSummary.units) && queueSummary.units.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ fontFamily: fontHeading, color: GRAY_MID, letterSpacing: "1px" }}>
                    Department Units
                  </p>
                  <div className="mt-2 space-y-2">
                    {queueSummary.units.map((unit) => (
                      <div key={unit.unit_id} className="p-3" style={{ border: `1px solid ${BORDER}`, borderRadius: 0, backgroundColor: NEUTRAL_LIGHT }}>
                        <p className="text-sm font-semibold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>
                          {unit.unit_name || `Unit ${unit.unit_id.slice(-4)}`}
                        </p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs" style={{ color: GRAY_MID }}>{unit.total_assigned} assigned</span>
                          <span className="text-xs font-semibold" style={{ color: "#388E3C" }}>{unit.currently_serving} serving</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <EmployeeVisitorClicked
        isOpen={showVisitorDetails}
        onClose={() => { setShowVisitorDetails(false); setSelectedVisitorForDetails(null); }}
        visitor={selectedVisitorForDetails}
        myProviderId={myId}
        onSaved={() => { fetchAssignedVisitors(true); fetchQueueSummary(true); }}
        hideActions={departmentScope}
      />
    </div>
  );
};

export default DepartmentQueueTab;
