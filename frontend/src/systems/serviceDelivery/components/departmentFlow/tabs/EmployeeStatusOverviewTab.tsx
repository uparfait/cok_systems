import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiSearch } from "react-icons/fi";
import { departmentManagerService } from "../../../../../core/services/adminService";
import { useSocket } from "../../../../../core/contexts/SocketContext";
import OverlayShell from "../../../../../core/components/overlay/OverlayShell";
import { useVisitorPanel, visitorIdOf } from "../../../../../core/components/visitor/VisitorPanelProvider";
import { formatDateTime } from "../../../../../core/components/visitor/visitorApi";

const PRIMARY = "#056daa";
const SUCCESS = "#4CAF50";
const WARNING = "#F39C12";
const DANGER = "#E74C3C";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const GRAY_MID = "#555555";
const BORDER = "#E0E0E0";
const TERTIARY = "#CDB896";
const GRAY_DISABLED = "#9E9E9E";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";

const TEAM_LIMIT = 100;
const VISIT_LIMIT = 50;
const MAX_PAGES = 10;
const LIVE_EVENTS = ["visitor_updated", "visitor_checkedin", "visitor_checkedout", "visitor_assigned", "service_status_updated"];
const VISIT_HEADERS = ["Full Name", "ID Type", "ID Number", "Telephone", "Email", "Gender", "Visits", "Department", "Arrival", "Status"];

interface TeamMember {
  _id?: string;
  full_name?: string;
  email?: string;
  telephone?: string;
  title?: string;
  is_active?: boolean;
  department?: { _id?: string; department_name?: string } | string | null;
  department_unit_name?: string | null;
}

interface ScopeService {
  department_id?: string;
  department_name?: string;
  provider_id?: string | null;
  provider_name?: string;
  s_type?: string;
}

interface VisitRow {
  _id: string;
  visitor_id?: string;
  visitor?: { _id?: string } | null;
  full_name?: string;
  telephone?: string;
  email?: string;
  gender?: string;
  N_visits?: number;
  identification?: { id_type?: string; number?: string };
  entry_date?: string;
  scope_service?: ScopeService | null;
  serving_by?: { user_id?: string | null; name?: string; department_name?: string } | null;
}

interface AssignedVisit { row: VisitRow; serving: boolean; }

type WorkState = "available" | "assigned" | "serving";

const STATE_LOOK: Record<WorkState, { label: string; color: string; background: string }> = {
  available: { label: "Available", color: SUCCESS, background: "rgba(76,175,80,0.12)" },
  assigned: { label: "Visitors Waiting", color: WARNING, background: "rgba(243,156,18,0.12)" },
  serving: { label: "In a Service", color: PRIMARY, background: "rgba(5,109,170,0.1)" },
};

const getInitials = (name: string): string => {
  if (!name) return "??";
  const parts = name.split(" ").filter(Boolean);
  return parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.substring(0, 2).toUpperCase();
};

const cellOf = (value: unknown): string =>
  value === undefined || value === null || value === "" ? "-" : String(value);

const departmentOf = (emp: TeamMember): string => {
  if (emp.department_unit_name) return emp.department_unit_name;
  if (emp.department && typeof emp.department === "object") return emp.department.department_name || "";
  return "";
};

const workStateOf = (visits: AssignedVisit[] | undefined): WorkState => {
  if (!visits || visits.length === 0) return "available";
  return visits.some(v => v.serving) ? "serving" : "assigned";
};

const loadInHouse = async (status: "pending" | "active"): Promise<VisitRow[]> => {
  const rows: VisitRow[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const r: any = await departmentManagerService.getVisitorsByStatus(status, page, VISIT_LIMIT);
    const data: VisitRow[] = Array.isArray(r?.data) ? r.data : [];
    rows.push(...data);
    if (data.length < VISIT_LIMIT || rows.length >= Number(r?.total || 0)) break;
  }
  return rows;
};

const groupByProvider = (pending: VisitRow[], active: VisitRow[]): Record<string, AssignedVisit[]> => {
  const buckets: Record<string, Map<string, AssignedVisit>> = {};
  const add = (row: VisitRow, providerId: string | null | undefined, serving: boolean) => {
    if (!providerId || !row?._id) return;
    const key = String(providerId);
    if (!buckets[key]) buckets[key] = new Map();
    const known = buckets[key].get(row._id);
    if (!known || (serving && !known.serving)) buckets[key].set(row._id, { row, serving });
  };
  active.forEach(row => add(row, row.scope_service?.provider_id || row.serving_by?.user_id, true));
  pending.forEach(row => add(row, row.scope_service?.provider_id, false));
  const result: Record<string, AssignedVisit[]> = {};
  Object.entries(buckets).forEach(([key, bucket]) => { result[key] = Array.from(bucket.values()); });
  return result;
};

const EmployeeStatusOverviewTab: React.FC = () => {
  const { socket } = useSocket();
  const { openVisitor } = useVisitorPanel();
  const [employees, setEmployees] = useState<TeamMember[]>([]);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [stateFilter, setStateFilter] = useState<"all" | WorkState>("all");
  const [assigned, setAssigned] = useState<Record<string, AssignedVisit[]>>({});
  const [selectedEmployee, setSelectedEmployee] = useState<TeamMember | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r: any = await departmentManagerService.getTeamMembers(1, TEAM_LIMIT);
        if (!alive) return;
        if (r?.success && Array.isArray(r.data)) {
          setEmployees(r.data);
          setTotalEmployees(Number(r.total || r.data.length));
        } else {
          setError(r?.message || "The employees could not be loaded");
        }
      } catch (err: any) {
        if (alive) setError(err?.message || "The employees could not be loaded");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const loadVisits = useCallback(async () => {
    try {
      const [pending, active] = await Promise.all([loadInHouse("pending"), loadInHouse("active")]);
      setAssigned(groupByProvider(pending, active));
    } catch {
      return;
    }
  }, []);

  useEffect(() => { loadVisits(); }, [loadVisits]);

  useEffect(() => {
    if (!socket) return undefined;
    const refresh = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => { loadVisits(); }, 400);
    };
    LIVE_EVENTS.forEach(name => socket.on(name, refresh));
    return () => {
      LIVE_EVENTS.forEach(name => socket.off(name, refresh));
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [socket, loadVisits]);

  const filteredEmployees = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return employees.filter(emp => {
      const matches = !term || [emp.full_name, emp.email, emp.telephone, emp.title]
        .some(value => String(value || "").toLowerCase().includes(term));
      return matches && (stateFilter === "all" || workStateOf(assigned[String(emp._id || "")]) === stateFilter);
    });
  }, [employees, searchTerm, stateFilter, assigned]);

  const openFromList = (row: VisitRow) => {
    setSelectedEmployee(null);
    openVisitor(visitorIdOf(row));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-[#9E9E9E]">Loading employees...</div>
      </div>
    );
  }

  const selectedVisits = selectedEmployee ? assigned[String(selectedEmployee._id || "")] || [] : [];

  return (
    <div className="pb-6">
      <div className="bg-white mx-6 mt-4 p-4 flex flex-wrap items-center justify-between gap-3" style={{ boxShadow: CARD_SHADOW }}>
        <div className="relative flex-1" style={{ maxWidth: "380px", minWidth: "220px" }}>
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search employee by name, email or telephone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 focus:outline-none"
            style={{ color: NEUTRAL_DARK, fontFamily: fontHeading, fontSize: "14px", background: NEUTRAL_LIGHT, border: "1px solid transparent", borderRadius: 0, boxShadow: "0px 2px 4px rgba(0,0,0,0.1)" }}
            onFocus={(e) => {
              e.currentTarget.style.border = `1px solid ${PRIMARY}`;
              e.currentTarget.style.boxShadow = "0px 4px 8px rgba(5,109,170,0.25)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.border = "1px solid transparent";
              e.currentTarget.style.boxShadow = "0px 2px 4px rgba(0,0,0,0.1)";
            }}
          />
        </div>
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value as "all" | WorkState)}
          className="px-4 py-2 focus:outline-none cursor-pointer"
          style={{ background: NEUTRAL_LIGHT, border: "1px solid transparent", borderRadius: 0, boxShadow: "0px 2px 4px rgba(0,0,0,0.1)", color: NEUTRAL_DARK, fontFamily: fontHeading, fontSize: "14px" }}
        >
          <option value="all">All Statuses</option>
          <option value="available">{STATE_LOOK.available.label}</option>
          <option value="assigned">{STATE_LOOK.assigned.label}</option>
          <option value="serving">{STATE_LOOK.serving.label}</option>
        </select>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3 text-sm" style={{ backgroundColor: "rgba(231,76,60,0.08)", color: DANGER, borderRadius: 0 }}>{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 px-6 mt-4">
        {filteredEmployees.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-500">
            No employees found in this department
          </div>
        ) : (
          filteredEmployees.map((emp, index) => {
            const visits = assigned[String(emp._id || "")] || [];
            const look = STATE_LOOK[workStateOf(visits)];
            return (
              <div
                key={emp._id || index}
                className="bg-white p-4 cursor-pointer transition-shadow"
                style={{ boxShadow: CARD_SHADOW }}
                onClick={() => setSelectedEmployee(emp)}
              >
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <div className="w-11 h-11 rounded-full bg-[#056daa] flex items-center justify-center text-white font-medium text-sm">{getInitials(emp.full_name || "")}</div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white" style={{ background: look.color }}></div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>{emp.full_name || "Unknown"}</p>
                    <p className="text-xs truncate" style={{ color: GRAY_DISABLED }}>{emp.title || departmentOf(emp) || "Employee"}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <span className="inline-flex px-3 py-1 text-xs font-bold" style={{ background: look.background, color: look.color, border: `1px solid ${look.color}` }}>{look.label}</span>
                  <p className="text-xs mt-1" style={{ color: GRAY_DISABLED }}>{emp.is_active === false ? "Inactive account" : "Active account"}</p>
                </div>
                <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${BORDER}` }}>
                  <p className="uppercase" style={{ color: TERTIARY, fontFamily: fontHeading, fontSize: "13px", fontWeight: 600, letterSpacing: "0.5px" }}>Workload</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm" style={{ color: NEUTRAL_DARK }}>Assigned Visitors</span>
                    <span className="text-sm font-bold" style={{ color: PRIMARY }}>{visits.length}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between px-6 py-4 mt-4" style={{ borderTop: `1px solid ${BORDER}` }}>
        <p className="text-sm" style={{ color: GRAY_DISABLED }}>
          Showing <span className="font-bold text-[#333333]">{filteredEmployees.length}</span> of <span className="font-bold text-[#333333]">{totalEmployees}</span> employees
        </p>
      </div>

      <OverlayShell
        open={!!selectedEmployee}
        title={selectedEmployee?.full_name || "Employee"}
        subtitle={selectedEmployee ? selectedEmployee.title || departmentOf(selectedEmployee) || "Employee" : undefined}
        onClose={() => setSelectedEmployee(null)}
        width="xl"
      >
        <h3 className="uppercase mb-3" style={{ color: TERTIARY, fontFamily: fontHeading, fontSize: "13px", fontWeight: 600, letterSpacing: "0.5px" }}>Assigned Visitors</h3>
        {selectedVisits.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No visitors assigned to this employee
          </div>
        ) : (
          <div className="cok-table-scroll" style={{ ["--cok-table-max-h" as string]: "50vh" } as React.CSSProperties}>
            <table className="w-full min-w-[1100px]">
              <thead>
                <tr>
                  {VISIT_HEADERS.map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs uppercase tracking-wider font-semibold" style={{ color: GRAY_MID, fontFamily: fontHeading }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0E0E0]">
                {selectedVisits.map(({ row, serving }) => {
                  const statusLook = serving ? STATE_LOOK.serving : STATE_LOOK.assigned;
                  const statusLabel = serving ? "In Progress" : cellOf(row.scope_service?.s_type || "Not started");
                  return (
                    <tr key={row._id} className="hover:bg-[#F7F9FB] cursor-pointer" onClick={() => openFromList(row)}>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-8 h-8 rounded-full bg-[rgba(5,109,170,0.1)] flex items-center justify-center text-[#056daa] font-bold text-xs shrink-0">
                            {getInitials(row.full_name || "??")}
                          </span>
                          <span className="text-sm font-semibold" style={{ color: NEUTRAL_DARK, fontFamily: fontHeading }}>{row.full_name || "Unknown"}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: GRAY_MID }}>{cellOf(row.identification?.id_type)}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: GRAY_MID }}>{cellOf(row.identification?.number)}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: GRAY_MID }}>{cellOf(row.telephone)}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: GRAY_MID }}>{cellOf(row.email)}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: GRAY_MID }}>{cellOf(row.gender)}</td>
                      <td className="px-3 py-2.5 text-xs font-semibold" style={{ color: NEUTRAL_DARK }}>{Number(row.N_visits || 0)}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: GRAY_MID }}>{cellOf(row.scope_service?.department_name)}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: GRAY_MID }}>{formatDateTime(row.entry_date)}</td>
                      <td className="px-3 py-2.5">
                        <span className="px-3 py-1 text-xs font-bold" style={{ background: statusLook.background, color: statusLook.color }}>{statusLabel}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </OverlayShell>
    </div>
  );
};

export default EmployeeStatusOverviewTab;
