import React, { useState, useEffect, useCallback, useRef } from "react";
import { FiSearch } from "react-icons/fi";
import SpiralLoader from "@/systems/event-managment/components/SpiralLoader";
import { useAuth } from "../../../../../core/contexts/AuthContext";
import { useToast } from "../../../../../core/contexts/ToastContext";
import { useSocket } from "../../../../../core/contexts/SocketContext";
import { serviceDeliveryService } from "../../../../../core/services/adminService";
import { get } from "../../../../../core/services/apiClient";
import Table from "../../../../../core/components/Table";
import { useVisitorPanel, visitorIdOf } from "../../../../../core/components/visitor/VisitorPanelProvider";
import { formatDateTime } from "../../../../../core/components/visitor/visitorApi";

const PRIMARY = "#056daa";
const SUCCESS = "#4CAF50";
const WARNING = "#F39C12";
const INFO = "#2980B9";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const GRAY_DISABLED = "#9E9E9E";
const GRAY_MID = "#555555";
const fontHeading = "'Montserrat', sans-serif";
const RESULTS_PER_PAGE = 20;
const LIVE_EVENTS = ["visitor_updated", "service_status_updated", "visitor_assigned", "visitor_checkedout"];

interface ScopeService {
  department_id?: string;
  department_name?: string;
  provider_id?: string | null;
  provider_name?: string;
  s_type?: string;
}

interface QueueRow {
  id: string;
  fullName: string;
  initials: string;
  idType: string;
  idNumber: string;
  telephone: string;
  email: string;
  gender: string;
  visits: number;
  department: string;
  assignedTo: string;
  waitingSince: string;
  waitTime: string;
  status: string;
  servedBy: string;
  rawVisitor: any;
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

const STATUS_LOOK: Record<string, { label: string; color: string; background: string }> = {
  not_started: { label: "Not Started", color: WARNING, background: "rgba(243,156,18,0.12)" },
  inprogress: { label: "In Progress", color: SUCCESS, background: "rgba(76,175,80,0.12)" },
  completed: { label: "Completed", color: GRAY_MID, background: "rgba(51,51,51,0.08)" },
  transferred: { label: "Transferred", color: INFO, background: "rgba(41,128,185,0.12)" },
};

const statusKeyOf = (value?: string): string => {
  const text = String(value || "").toLowerCase().replace(/\s+/g, "");
  if (text === "inprogress") return "inprogress";
  if (text === "completed") return "completed";
  if (text === "transfered" || text === "transferred") return "transferred";
  return "not_started";
};

const durationText = (from?: string, until?: number): string => {
  if (!from) return "-";
  const start = new Date(from).getTime();
  if (Number.isNaN(start)) return "-";
  const minutes = Math.floor(((until ?? Date.now()) - start) / 60000);
  if (minutes <= 0) return "Just now";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours}h ${rest}m` : `${rest} mins`;
};

const sameId = (a: unknown, b: unknown): boolean => a !== undefined && a !== null && String(a) === String(b);

const toRow = (v: any): QueueRow => {
  const statuses: ScopeService[] = Array.isArray(v.services_status) ? v.services_status : [];
  const scope: ScopeService | null = v.scope_service || statuses[0] || null;
  const assignments: any[] = Array.isArray(v.departments_assigned) ? v.departments_assigned : [];
  const assignment = (scope?.department_id ? assignments.find((a) => sameId(a.department_id, scope.department_id)) : null) || assignments[0] || null;
  const fullName = v.full_name || v.visitor?.full_name || "Unknown";
  const initials = fullName.split(" ").filter(Boolean).map((n: string) => n[0]).join("").substring(0, 2).toUpperCase();
  const statusKey = statusKeyOf(scope?.s_type);
  const serving = v.serving_by || null;
  const durations: any[] = Array.isArray(v.durations?.services_durations) ? v.durations.services_durations : [];
  const openDuration = durations.find((d) => !d.ended_at && (!scope?.department_id || sameId(d.department_id, scope.department_id)));
  const serviceStart = statusKey === "inprogress" ? serving?.started_at || openDuration?.started_at || "" : "";
  const serviceStartStamp = serviceStart ? new Date(serviceStart).getTime() : NaN;
  const waitingSince = assignment?.assigned_time || v.entry_date || "";
  const identification = v.identification || v.visitor?.identification || {};
  return {
    id: v._id || v.id,
    fullName,
    initials,
    idType: identification.id_type || "-",
    idNumber: identification.number || "-",
    telephone: v.telephone || "-",
    email: v.email || "-",
    gender: v.gender || "-",
    visits: Number(v.N_visits ?? v.visitor?.N_visits ?? 0),
    department: scope?.department_name || assignment?.department_name || "-",
    assignedTo: statusKey === "not_started" && scope?.provider_id && scope?.provider_name ? scope.provider_name : "-",
    waitingSince,
    waitTime: durationText(waitingSince, Number.isNaN(serviceStartStamp) ? undefined : serviceStartStamp),
    status: statusKey,
    servedBy: serving?.name ? `${serving.name}${serving.department_name ? ` (${serving.department_name})` : ""}` : "-",
    rawVisitor: v,
  };
};

const DepartmentQueueTab: React.FC<{ departmentScope?: boolean }> = ({ departmentScope = false }) => {
  const { user } = useAuth();
  const { showError } = useToast();
  const { socket } = useSocket();
  const { openVisitor } = useVisitorPanel();

  const currentUser = user as any;
  const rawId = String(currentUser?.userId || currentUser?._id || currentUser?.id || currentUser?.employee_id || "");
  const myId = rawId === "undefined" ? "" : rawId;

  const [searchInput, setSearchInput] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [queueSummary, setQueueSummary] = useState<QueueSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueSequence = useRef(0);
  const summarySequence = useRef(0);
  const refreshRef = useRef<() => void>(() => undefined);

  const fetchQueue = useCallback(async (silent: boolean = false) => {
    if (!myId) { setLoading(false); return; }
    const current = ++queueSequence.current;
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(currentPage), limit: String(RESULTS_PER_PAGE), in_house: "true" });
      if (appliedQuery) params.append("q", appliedQuery);
      const response = await get(`/servicedelivery/visitor/by-provider-current/${encodeURIComponent(myId)}?${params.toString()}`);
      if (current !== queueSequence.current) return;
      if (response && response.success) {
        const total = Number(response.total) || 0;
        setRows((Array.isArray(response.data) ? response.data : []).map(toRow));
        setTotalCount(total);
        setTotalPages(Math.max(1, Math.ceil(total / RESULTS_PER_PAGE)));
      } else {
        setRows([]);
        setTotalCount(0);
        setTotalPages(1);
      }
    } catch (error: any) {
      if (current !== queueSequence.current) return;
      console.error(error);
      if (!silent) {
        showError(error?.message || "Failed to load department queue");
        setRows([]);
        setTotalCount(0);
        setTotalPages(1);
      }
    } finally {
      if (current === queueSequence.current) setLoading(false);
    }
  }, [myId, currentPage, appliedQuery, showError]);

  const fetchQueueSummary = useCallback(async (silent: boolean = false) => {
    if (!myId) { setSummaryLoading(false); return; }
    const current = ++summarySequence.current;
    if (!silent) setSummaryLoading(true);
    try {
      const response = await serviceDeliveryService.getQueueSummary(true);
      if (current !== summarySequence.current) return;
      setQueueSummary(response && response.success ? response : null);
    } catch (error: any) {
      if (current !== summarySequence.current) return;
      console.error(error);
      if (!silent) {
        showError(error?.message || "Failed to load queue summary");
        setQueueSummary(null);
      }
    } finally {
      if (current === summarySequence.current) setSummaryLoading(false);
    }
  }, [myId, showError]);

  useEffect(() => {
    refreshRef.current = () => {
      fetchQueue(true);
      fetchQueueSummary(true);
    };
  });

  useEffect(() => { fetchQueue(false); }, [fetchQueue]);
  useEffect(() => { fetchQueueSummary(false); }, [fetchQueueSummary]);

  useEffect(() => {
    const interval = setInterval(() => refreshRef.current(), 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!socket) return undefined;
    const refresh = () => {
      if (liveTimerRef.current) clearTimeout(liveTimerRef.current);
      liveTimerRef.current = setTimeout(() => refreshRef.current(), 400);
    };
    LIVE_EVENTS.forEach((name) => socket.on(name, refresh));
    return () => {
      LIVE_EVENTS.forEach((name) => socket.off(name, refresh));
      if (liveTimerRef.current) clearTimeout(liveTimerRef.current);
    };
  }, [socket]);

  useEffect(() => () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); }, []);

  const applySearch = (value: string) => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    const term = value.trim();
    if (term === appliedQuery && currentPage === 1) {
      fetchQueue(false);
      return;
    }
    setCurrentPage(1);
    setAppliedQuery(term);
  };

  const handleSearchInput = (value: string) => {
    setSearchInput(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setCurrentPage(1);
      setAppliedQuery(value.trim());
    }, value.trim() ? 500 : 0);
  };

  const summarySubtitle = departmentScope
    ? "Waiting or being served in the departments you lead"
    : "Waiting or being served in your department";

  return (
    <div className="space-y-4 w-full" style={{ backgroundColor: NEUTRAL_LIGHT }}>
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-base font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Department Queue</h1>
        </div>
        <div className="px-3 py-1.5 text-xs font-bold" style={{ fontFamily: fontHeading, color: PRIMARY, backgroundColor: 'rgba(5,109,170,0.08)' }}>{totalCount} Records</div>
      </div>

      <div className="w-full">
        <div className="flex w-full flex-col sm:flex-row gap-2 sm:gap-3">
          <div className="relative flex-1 min-w-0">
            <input
              type="text"
              placeholder="Search by name, ID number, telephone or email..."
              value={searchInput}
              onChange={(e) => handleSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applySearch(searchInput)}
              className="w-full h-12 sm:h-14 pl-10 pr-3 text-base sm:text-lg cok-auth-input"
            />
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <button
            onClick={() => applySearch(searchInput)}
            disabled={loading}
            className="flex-shrink-0 h-12 sm:h-14 px-6 sm:px-8 cok-btn-primary flex items-center justify-center gap-2 text-base sm:text-lg whitespace-nowrap max-w-[200px] min-w-[100px] sm:min-w-[120px]"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : null}
            <span>{loading ? "Wait" : "Search"}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2 bg-white min-w-0" style={{ border: `1px solid ${BORDER}`, borderRadius: 0 }}>
          <Table
            headers={[
              { key: "visitor", label: "FULL NAME" },
              { key: "idType", label: "ID TYPE" },
              { key: "idNumber", label: "ID NUMBER" },
              { key: "telephone", label: "TELEPHONE" },
              { key: "email", label: "EMAIL" },
              { key: "gender", label: "GENDER" },
              { key: "visits", label: "VISITS" },
              { key: "department", label: "DEPARTMENT" },
              { key: "assignedTo", label: "ASSIGNED TO" },
              { key: "waitingSince", label: "WAITING SINCE" },
              { key: "waitTime", label: "WAIT TIME" },
              { key: "status", label: "STATUS" },
              { key: "servedBy", label: "SERVED BY" },
            ]}
            data={rows}
            loading={loading && rows.length === 0}
            emptyMessage={appliedQuery ? "No visitor in your department queue matches this search." : "No visitors found in your department queue."}
            headerClassName="cok-bg-primary"
            minWidth="1500px"
            nowrap
            onRowClick={(v: QueueRow) => openVisitor(visitorIdOf(v.rawVisitor))}
            pagination={{
              currentPage,
              totalPages,
              totalCount,
              itemsPerPage: RESULTS_PER_PAGE,
              onPageChange: (p) => setCurrentPage(p),
              loading,
            }}
            renderCell={(header, v: QueueRow) => {
              switch (header.key) {
                case "visitor":
                  return (
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7.5 h-7.5 flex items-center justify-center text-xs font-bold"
                        style={{ backgroundColor: "rgba(5,109,170,0.1)", color: PRIMARY, borderRadius: 999 }}
                      >
                        {v.initials}
                      </div>
                      <span className="text-sm font-semibold" style={{ color: NEUTRAL_DARK }}>{v.fullName}</span>
                    </div>
                  );
                case "visits":
                  return <span className="text-xs font-semibold" style={{ color: NEUTRAL_DARK }}>{v.visits}</span>;
                case "department":
                  return <span className="text-xs font-medium" style={{ color: NEUTRAL_DARK }}>{v.department}</span>;
                case "waitingSince":
                  return <span className="text-xs" style={{ color: GRAY_MID }}>{formatDateTime(v.waitingSince)}</span>;
                case "waitTime":
                  return <span className="text-xs font-semibold" style={{ color: GRAY_MID }}>{v.waitTime}</span>;
                case "status": {
                  const look = STATUS_LOOK[v.status] || STATUS_LOOK.not_started;
                  return (
                    <span
                      className="text-xs px-2 py-0.5 font-bold uppercase"
                      style={{ borderRadius: 0, backgroundColor: look.background, color: look.color }}
                    >
                      {look.label}
                    </span>
                  );
                }
                case "servedBy":
                  return (
                    <span className="text-xs font-medium" style={{ color: v.servedBy === "-" ? GRAY_MID : SUCCESS }}>
                      {v.servedBy}
                    </span>
                  );
                default: {
                  const value = (v as unknown as Record<string, unknown>)[header.key];
                  return <span className="text-xs" style={{ color: GRAY_MID }}>{value === undefined || value === null || value === "" ? "-" : String(value)}</span>;
                }
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
                  <p className="text-xs mt-0.5" style={{ color: GRAY_DISABLED }}>{summarySubtitle}</p>
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
    </div>
  );
};

export default DepartmentQueueTab;
