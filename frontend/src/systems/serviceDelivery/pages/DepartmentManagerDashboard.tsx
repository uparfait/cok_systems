import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { departmentManagerService } from "../../../core/services/adminService";
import { useAuth } from "../../../core/contexts/AuthContext";
import { useToast } from "../../../core/contexts/ToastContext";
import SpiralLoader from "@/systems/event-managment/components/SpiralLoader";
import DepartmentAvailabilityTab from "../components/departmentFlow/tabs/DepartmentAvailabilityTab";
import { ViewEmployeeModal, EditEmployeeModal, AddEmployeeModal } from "./sub/DeptManagerEmployeeModals";
import ServedVisitorsGenderChart from "../components/employeeFlow/tabs/sub/ServedVisitorsGenderChart";
import ExportVisitorsModal from "../../../core/components/requests/ExportVisitorsModal";
import DepartmentQueueTab from "../components/employeeFlow/tabs/DepartmentQueueTab";
import HodPeriodBar, { periodToRange } from "./hod/HodPeriodBar";
import type { HodAppliedPeriod } from "./hod/HodPeriodBar";
import HodRequestsTable from "./hod/HodRequestsTable";
import HodServedSummary from "./hod/HodServedSummary";

const PRIMARY = "#056daa";
const PRIMARY_HOVER = "#045d94";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const GRAY_MID = "#555555";
const GRAY = "#9E9E9E";
const BORDER = "#E0E0E0";
const WHITE = "#FFFFFF";
const FONT = "'Montserrat', sans-serif";

interface Employee {
  _id?: string;
  employee_id?: string;
  full_name?: string;
  name?: string;
  email?: string;
  telephone?: string;
  phone?: string;
  title?: string;
  gender?: string;
}

interface StatCounts {
  pending: number;
  active: number;
  completed: number;
  feedback: number;
  notServed: number;
}

const STAT_CARDS: { key: keyof StatCounts; label: string; subtitle: string }[] = [
  { key: "pending", label: "Pending", subtitle: "Visitors whose service has not started yet" },
  { key: "active", label: "Active", subtitle: "Visitors currently being served" },
  { key: "completed", label: "Completed", subtitle: "Visitors who have been served" },
  { key: "feedback", label: "Feedback", subtitle: "Feedback in your department and its units" },
  { key: "notServed", label: "Not Served", subtitle: "Visitors sent to your department or units but not served" },
];

const DepartmentManagerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { showSuccess } = useToast();
  const departmentId = (user as any)?.departmentId || (user as any)?.department_id || "";
  const departmentName = (user as any)?.departmentName || (user as any)?.department_name || "";
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [employees] = useState<Employee[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [showViewEmployeeModal, setShowViewEmployeeModal] = useState(false);
  const [showEditEmployeeModal, setShowEditEmployeeModal] = useState(false);
  const [selectedDeptEmployee, setSelectedDeptEmployee] = useState<Employee | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [applied, setApplied] = useState<HodAppliedPeriod>({ period: "month" });
  const [counts, setCounts] = useState<StatCounts>({ pending: 0, active: 0, completed: 0, feedback: 0, notServed: 0 });
  const [countsLoading, setCountsLoading] = useState(true);
  const firstCountsLoad = useRef(true);

  const range = useMemo(() => periodToRange(applied.period, applied.from, applied.to), [applied]);

  useEffect(() => {
    const t = searchParams.get("tab");
    const valid = ["dashboard", "employees", "departments", "feedback", "by-department", "by-provider", "availability", "active-tasks", "completed-requests", "history", "queue"];
    setActiveTab(t && valid.includes(t) ? t : "dashboard");
  }, [searchParams]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate("/login");
  }, [isAuthenticated, authLoading, navigate]);

  const fetchCounts = useCallback(async (silent = false) => {
    if (!silent && firstCountsLoad.current) setCountsLoading(true);
    try {
      const [p, a, c, f, ns] = await Promise.all([
        departmentManagerService.getVisitorsByStatus("pending", 1, 1, undefined, range.from, range.to),
        departmentManagerService.getVisitorsByStatus("active", 1, 1, undefined, range.from, range.to),
        departmentManagerService.getVisitorsByStatus("completed", 1, 1, undefined, range.from, range.to),
        departmentManagerService.getDepartmentFeedback({ page: 1, limit: 1, target: "departments", from: range.from, to: range.to }),
        departmentManagerService.getVisitorsByStatus("not_served", 1, 1, undefined, range.from, range.to),
      ]);
      setCounts({
        pending: p?.total || 0,
        active: a?.total || 0,
        completed: c?.total || 0,
        feedback: f?.total || 0,
        notServed: ns?.total || 0,
      });
    } catch {
      if (!silent) setCounts({ pending: 0, active: 0, completed: 0, feedback: 0, notServed: 0 });
    } finally {
      firstCountsLoad.current = false;
      setCountsLoading(false);
    }
  }, [range.from, range.to]);

  useEffect(() => {
    if (activeTab !== "dashboard") return;
    fetchCounts();
  }, [fetchCounts, activeTab]);

  useEffect(() => {
    if (activeTab !== "dashboard") return;
    const interval = setInterval(() => fetchCounts(true), 10000);
    return () => clearInterval(interval);
  }, [fetchCounts, activeTab]);

  const showPeriodBar = activeTab === "dashboard" || activeTab === "completed-requests" || activeTab === "active-tasks" || activeTab === "history";

  return (
    <div className="p-4" style={{ backgroundColor: NEUTRAL_LIGHT, fontFamily: FONT }}>
      {showPeriodBar && (
        <div className="mb-4">
          <HodPeriodBar applied={applied} onApply={setApplied} />
        </div>
      )}

      {activeTab === "dashboard" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {STAT_CARDS.map(card => (
              <div key={card.key} className="p-4 bg-white" style={{ border: `1px solid ${BORDER}`, borderRadius: 0 }}>
                <p className="text-xs font-semibold uppercase" style={{ fontFamily: FONT, letterSpacing: "1px", color: GRAY_MID }}>
                  {card.label}
                </p>
                {countsLoading ? (
                  <div className="mt-2"><SpiralLoader /></div>
                ) : (
                  <p className="text-2xl font-bold mt-1" style={{ fontFamily: FONT, color: NEUTRAL_DARK }}>{counts[card.key]}</p>
                )}
                <p className="text-xs mt-1" style={{ color: GRAY }}>{card.subtitle}</p>
              </div>
            ))}
          </div>

          <button
            onClick={() => setShowExportModal(true)}
            className="w-full px-6 py-3 text-white font-bold text-sm sm:text-base transition-colors flex items-center justify-center gap-2 cursor-pointer"
            style={{ backgroundColor: PRIMARY, borderRadius: 0, fontFamily: FONT, letterSpacing: "1px", textTransform: "uppercase" }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = PRIMARY; }}
          >
            Export Visitors Data
          </button>

          <ServedVisitorsGenderChart
            subtitle={`Served in ${departmentName || "your department"}`}
            period={applied.period}
            from={applied.from}
            to={applied.to}
            hideControls
          />

          {showExportModal && <ExportVisitorsModal onClose={() => setShowExportModal(false)} />}
        </div>
      )}

      {activeTab === "employees" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h2 className="text-sm font-bold uppercase" style={{ fontFamily: FONT, color: PRIMARY, letterSpacing: "1px" }}>Department Employees</h2>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search..."
                value={employeeSearch}
                onChange={e => setEmployeeSearch(e.target.value)}
                className="cok-auth-input w-full sm:w-56 text-sm"
                style={{ paddingLeft: "12px", minHeight: "38px" }}
              />
              <button
                onClick={() => setShowAddEmployeeModal(true)}
                className="px-4 py-2 text-xs font-semibold text-white"
                style={{ backgroundColor: PRIMARY, borderRadius: 0, fontFamily: FONT, textTransform: "uppercase", letterSpacing: "1px" }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = PRIMARY; }}
              >
                Add
              </button>
            </div>
          </div>
          <div className="bg-white overflow-x-auto" style={{ border: `1px solid ${BORDER}`, borderRadius: 0 }}>
            <table className="w-full min-w-[600px]">
              <thead style={{ backgroundColor: PRIMARY }}>
                <tr>
                  {["Employee", "Email", "Telephone", "Title", "Actions"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs uppercase tracking-wider text-white font-semibold" style={{ fontFamily: FONT }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0E0E0]">
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: GRAY }}>No employees</td>
                  </tr>
                ) : (
                  employees.map((e: any) => (
                    <tr key={e._id} className="hover:bg-[#F7F9FB]">
                      <td className="px-4 py-2.5 text-sm font-medium" style={{ color: NEUTRAL_DARK }}>{e.full_name}</td>
                      <td className="px-4 py-2.5 text-xs" style={{ color: GRAY_MID }}>{e.email}</td>
                      <td className="px-4 py-2.5 text-xs" style={{ color: GRAY_MID }}>{e.telephone || "-"}</td>
                      <td className="px-4 py-2.5 text-xs" style={{ color: GRAY_MID }}>{e.title || "-"}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-1">
                          <button
                            onClick={() => { setSelectedDeptEmployee(e); setShowViewEmployeeModal(true); }}
                            className="cok-btn-outlined px-3 py-1 text-xs"
                            style={{ borderRadius: 0 }}
                          >
                            View
                          </button>
                          <button
                            onClick={() => { setSelectedDeptEmployee(e); setShowEditEmployeeModal(true); }}
                            className="cok-btn-outlined px-3 py-1 text-xs"
                            style={{ borderRadius: 0 }}
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "departments" && <DepartmentAvailabilityTab />}
      {activeTab === "feedback" && <div className="text-sm p-8 text-center" style={{ color: GRAY }}>Feedback is available from the Feedback page</div>}
      {activeTab === "active-tasks" && <HodRequestsTable status="active" title="Active Requests" from={range.from} to={range.to} />}
      {activeTab === "completed-requests" && <HodRequestsTable status="completed" title="Completed Requests" from={range.from} to={range.to} />}
      {activeTab === "history" && (
        <div className="space-y-4">
          <HodServedSummary from={range.from} to={range.to} />
        </div>
      )}
      {activeTab === "queue" && <DepartmentQueueTab departmentScope />}
      {activeTab === "by-department" && <div className="text-sm p-8 text-center" style={{ color: GRAY }}>By department view</div>}
      {activeTab === "by-provider" && <div className="text-sm p-8 text-center" style={{ color: GRAY }}>By provider view</div>}
      {activeTab === "availability" && <DepartmentAvailabilityTab />}

      <AddEmployeeModal
        isOpen={showAddEmployeeModal}
        onClose={() => setShowAddEmployeeModal(false)}
        departmentId={departmentId}
        departmentName={departmentName}
        onSuccess={() => { showSuccess("Employee added"); setShowAddEmployeeModal(false); }}
      />
      <ViewEmployeeModal isOpen={showViewEmployeeModal} onClose={() => setShowViewEmployeeModal(false)} employee={selectedDeptEmployee} />
      <EditEmployeeModal
        isOpen={showEditEmployeeModal}
        onClose={() => setShowEditEmployeeModal(false)}
        employee={selectedDeptEmployee}
        onSuccess={() => { showSuccess("Employee updated"); setShowEditEmployeeModal(false); }}
      />
    </div>
  );
};

export default DepartmentManagerDashboard;
