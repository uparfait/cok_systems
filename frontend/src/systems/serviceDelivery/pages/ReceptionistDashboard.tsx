import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  FiSearch,
  FiUsers,
  FiClock,
  FiCheckCircle,
  FiGrid,
} from "react-icons/fi";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  serviceDeliveryService,
  departmentService,
  statisticsService,
} from "../../../core/services/adminService";
import { useAuth } from "../../../core/contexts/AuthContext";
import { useSocket } from "../../../core/contexts/SocketContext";
import { useToast } from "../../../core/contexts/ToastContext";
import AssignedVisitorsList from "../components/departmentFlow/AssignedVisitorsList";
import Table from "../../../core/components/Table";
import VisitorDetails from "../../../core/components/VisitorDetails";
import AssignVisitorComponent from "../../../core/components/AssignVisitorComponent";
import { SkeletonCard, SkeletonTableRow } from "./sub/ReceptionistSkeleton";

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
const inputStyle: React.CSSProperties = {
  fontFamily: fontHeading,
  fontSize: "14px",
  backgroundColor: NEUTRAL_LIGHT,
  border: "1px solid transparent",
  borderRadius: 0,
  boxShadow: "0px 2px 4px rgba(0,0,0,0.1)",
  color: NEUTRAL_DARK,
};
const focusInput = (e: React.FocusEvent<HTMLElement>) => {
  e.currentTarget.style.borderColor = PRIMARY;
  e.currentTarget.style.boxShadow = "0px 4px 8px rgba(5,109,170,0.25)";
};
const blurInput = (e: React.FocusEvent<HTMLElement>) => {
  e.currentTarget.style.borderColor = "transparent";
  e.currentTarget.style.boxShadow = "0px 2px 4px rgba(0,0,0,0.1)";
};

interface Visitor {
  _id?: string;
  id?: string;
  name?: string;
  full_name?: string;
  visitorName?: string;
  badge_number?: string;
  badge?: string;
  identification?: string | { number?: string };
  telephone?: string;
  email?: string;
  status: string;
  checkInTime?: string;
  check_in_time?: string;
  entry_date?: string;
  department?: string;
  departmentName?: string;
  departments_assigned?: Array<{
    department_id: string;
    department_name?: string;
    status: string;
    provider_name?: string;
    provider_id?: string;
  }>;
  services_status?: Array<{
    department_id: string;
    department_name?: string;
    s_type?: string;
    provider_name?: string;
    provider_id?: string;
  }>;
}

const ReceptionistDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { socket, isConnected } = useSocket();
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<"dashboard" | "visitors">(
    tabParam === "visitors" ? "visitors" : "dashboard",
  );
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [unassignedVisitors, setUnassignedVisitors] = useState<Visitor[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [subDepartmentIds, setSubDepartmentIds] = useState<Set<string>>(
    new Set(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);
  const [hourlyData, setHourlyData] = useState<
    { hour: number; visitors_checked_in: number }[]
  >([]);
  const [hourlyDataLoading, setHourlyDataLoading] = useState(true);
  const [departmentVisitorCounts, setDepartmentVisitorCounts] = useState<
    Record<string, number>
  >({});
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [showVisitorModal, setShowVisitorModal] = useState(false);
  const [selectedVisitorForModal, setSelectedVisitorForModal] =
    useState<Visitor | null>(null);
  const [showAssignComponent, setShowAssignComponent] = useState(false);

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "visitors") setActiveTab("visitors");
    else setActiveTab("dashboard");
  }, [searchParams]);
  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate("/login");
  }, [isAuthenticated, authLoading, navigate]);

  const loadData = async () => {
    setIsLoading(true);
    if (searchTerm?.trim()) setSearchLoading(true);
    try {
      let visitorRes = searchTerm?.trim()
        ? await serviceDeliveryService.search(searchTerm, currentPage, 50)
        : await serviceDeliveryService.getAll(currentPage, 50);
      if (visitorRes.status || visitorRes.success) {
        const allVisitors = Array.isArray(visitorRes.data)
          ? visitorRes.data
          : [];
        allVisitors.sort(
          (a: any, b: any) =>
            new Date(
              a.checkInTime || a.check_in_time || a.entry_date,
            ).getTime() -
            new Date(
              b.checkInTime || b.check_in_time || b.entry_date,
            ).getTime(),
        );
        setVisitors(allVisitors);
        setTotalCount(visitorRes.total || 0);
        setUnassignedVisitors(
          allVisitors.filter(
            (v: any) =>
              !v.departments_assigned ||
              !Array.isArray(v.departments_assigned) ||
              v.departments_assigned.length === 0,
          ),
        );
        const counts: Record<string, number> = {};
        allVisitors.forEach((v: any) => {
          if (v.departments_assigned)
            v.departments_assigned.forEach((d: any) => {
              const n = d.department_name || d.department || "Unknown";
              counts[n] = (counts[n] || 0) + 1;
            });
        });
        setDepartmentVisitorCounts(counts);
      }
      const deptR = await departmentService.getAll();
      if (deptR.status || deptR.success) {
        const deptData = Array.isArray(deptR.data) ? deptR.data : [];
        setDepartments(deptData);
        const ids = new Set<string>();
        deptData.forEach((d: any) => {
          if (
            d.sub_department_mng?.is_sub_department === true ||
            d.sub_department_mng?.is_sub_department === "true"
          )
            ids.add(String(d._id || d.department_id));
          if (d.sub_departments)
            d.sub_departments.forEach((s: any) => {
              const id = s._id || s.department_id;
              if (id) ids.add(String(id));
            });
        });
        setSubDepartmentIds(ids);
      }
      setHourlyDataLoading(true);
      try {
        const hR = await statisticsService.getHourlyServiceDeliveryStats();
        if (hR.success) setHourlyData(hR.data?.hourly || hR.data || []);
      } catch (error) {}
    } catch (error) {
    } finally {
      setFirstLoad(false);
      setIsLoading(false);
      setSearchLoading(false);
      setHourlyDataLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentPage, searchTerm]);
  useEffect(() => {
    if (!socket || !isConnected) return;
    const h = (data: any) => {
      if (data.show_notif === false) {
        const m = data.message;
        const t = data.type || "info";
        if (t === "success") showSuccess(m);
        else if (t === "error") showError(m);
        else if (t === "warning") showWarning(m);
        else showInfo(m);
      }
      loadData();
    };
    socket.on("visitor_checkedin", h);
    socket.on("visitor_checkedout", h);
    socket.on("car_checkedin", h);
    socket.on("car_checkedout", h);
    return () => {
      socket.off("visitor_checkedin", h);
      socket.off("visitor_checkedout", h);
      socket.off("car_checkedin", h);
      socket.off("car_checkedout", h);
    };
  }, [socket, isConnected]);

  const getVisitorName = (v: Visitor) =>
    v.full_name || v.name || v.visitorName || "Unknown";
  const getCheckInTime = (v: Visitor) =>
    new Date(
      v.checkInTime || v.check_in_time || v.entry_date || "",
    ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) ||
    "Just now";
  const getIdentification = (v: Visitor) =>
    !v.identification
      ? "---"
      : typeof v.identification === "string"
        ? v.identification
        : v.identification.number || "---";
  const paginatedVisitors = unassignedVisitors;
  const totalVisitors = visitors.length;
  const assignedCount = visitors.filter(
    (v) => v.departments_assigned && v.departments_assigned.length > 0,
  ).length;
  const totalDepartments = departments.length;

  const applySearch = () => {
    setSearchTerm(searchInput);
    setCurrentPage(1);
  };

  const handleRowClick = (v: Visitor) => {
    setSelectedVisitorForModal(v);
    setShowVisitorModal(true);
  };
  const handleNewVisitor = () => {
    setSelectedVisitorForModal(null);
    setShowVisitorModal(true);
  };
  const handleCloseVisitorModal = () => {
    setShowVisitorModal(false);
    setSelectedVisitorForModal(null);
  };
  const handleVisitorSaved = () => {
    handleCloseVisitorModal();
    loadData();
  };
  const handleAssignFromModal = () => {
    setShowVisitorModal(false);
    setShowAssignComponent(true);
  };
  const handleAssignmentComplete = () => {
    setShowAssignComponent(false);
    loadData();
  };

  return (
    <div className="space-y-4" style={{ backgroundColor: NEUTRAL_LIGHT }}>
      {activeTab === "dashboard" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {firstLoad ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : (
              [
                {
                  label: "Total Current Visitors",
                  value: totalCount,
                  icon: FiUsers,
                  color: PRIMARY,
                },
                {
                  label: "Total Departments",
                  value: totalDepartments,
                  icon: FiGrid,
                  color: SUCCESS,
                },
                {
                  label: "Total Assigned",
                  value: assignedCount,
                  icon: FiCheckCircle,
                  color: SUCCESS,
                },
              ].map((s, i) => (
                <div
                  key={i}
                  className="p-4"
                  style={{
                    backgroundColor: WHITE,
                    boxShadow: CARD_SHADOW,
                    borderRadius: 0,
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p
                        className="text-xs font-medium mb-0.5"
                        style={{ fontFamily: fontHeading, color: s.color }}
                      >
                        {s.label}
                      </p>
                      <h3
                        className="text-xl font-bold"
                        style={{ fontFamily: fontHeading, color: s.color }}
                      >
                        {s.value}
                      </h3>
                    </div>
                    <div
                      className="p-2"
                      style={{
                        backgroundColor: NEUTRAL_LIGHT,
                        borderRadius: 0,
                      }}
                    >
                      <s.icon className="w-5 h-5" style={{ color: s.color }} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div
            className="p-4"
            style={{
              backgroundColor: WHITE,
              boxShadow: CARD_SHADOW,
              borderRadius: 0,
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div
                className="p-1.5"
                style={{
                  backgroundColor: "rgba(5,109,170,0.08)",
                  borderRadius: 999,
                }}
              >
                <FiClock className="w-4 h-4" style={{ color: PRIMARY }} />
              </div>
              <div>
                <h3
                  className="text-sm font-semibold"
                  style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}
                >
                  Daily Insights
                </h3>
                <p className="text-xs" style={{ color: GRAY_DISABLED }}>
                  Visitor traffic by hour
                </p>
              </div>
            </div>
            {hourlyDataLoading && firstLoad ? (
              <div className="h-48 flex items-center justify-center">
                <div
                  className="animate-spin rounded-full h-6 w-6 border-2 border-t-transparent"
                  style={{
                    borderColor: PRIMARY,
                    borderTopColor: "transparent",
                  }}
                ></div>
              </div>
            ) : hourlyData.length > 0 ? (
              <div className="h-48 border-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={hourlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
                    <XAxis
                      dataKey="hour"
                      tickFormatter={(v: number) => `${v}:00`}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="visitors_checked_in"
                      stroke={PRIMARY}
                      fill="rgba(5,109,170,0.1)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div
                className="h-48 flex items-center justify-center text-xs"
                style={{ color: GRAY_DISABLED }}
              >
                No data
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex gap-2  w-[calc(80%)]">
              <input
                type="text"
                placeholder="Search Badge, Name, Phone..."
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  applySearch();
                }}
                onKeyDown={(e) => e.key === "Enter" && applySearch()}
                className="cok-auth-input w-full pl-8 sm:w-96"
              />
              <button
                onClick={applySearch}
                className="cok-btn-primary flex items-center gap-2"
                style={{ width: "auto", padding: "0.6rem 1rem" }}
              >
                <FiSearch className="w-4 h-4" /> Search
              </button>
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleNewVisitor}
                className="cok-btn-primary"
                style={{ width: "auto", padding: "0.6rem 1rem" }}
              >
                New Visitor
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
                { key: "badge_number", label: "BADGE" },
                { key: "full_name", label: "NAME" },
                { key: "identification", label: "ID" },
                { key: "status", label: "STATUS" },
                { key: "time", label: "TIME" },
                { key: "telephone", label: "PHONE" },
              ]}
              data={paginatedVisitors}
              loading={isLoading && firstLoad}
              emptyMessage="No visitors."
              onRowClick={(row: any) => handleRowClick(row as Visitor)}
              headerClassName="cok-bg-primary"
              renderCell={(header, v: any) => {
                switch (header.key) {
                  case "badge_number":
                    return (
                      <span
                        className="text-xs px-2 py-0.5"
                        style={{
                          backgroundColor: "rgba(5,109,170,0.1)",
                          color: PRIMARY,
                          borderRadius: 0,
                        }}
                      >
                        {v.badge_number || v.badge || "---"}
                      </span>
                    );
                  case "full_name":
                    return (
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7.5 h-7.5  flex items-center justify-center text-xs font-bold"
                          style={{
                            backgroundColor: "rgba(5,109,170,0.1)",
                            color: PRIMARY,
                            borderRadius: 999,
                          }}
                        >
                          {getVisitorName(v).substring(0, 2).toUpperCase()}
                        </div>
                        <span
                          className="text-sm font-semibold"
                          style={{ color: NEUTRAL_DARK }}
                        >
                          {getVisitorName(v)}
                        </span>
                      </div>
                    );
                  case "identification":
                    return (
                      <span className="text-xs" style={{ color: "#555555" }}>
                        {getIdentification(v)}
                      </span>
                    );
                  case "status":
                    return (
                      <span
                        className="text-xs px-2 py-0.5 font-bold uppercase"
                        style={{
                          borderRadius: 0,
                          backgroundColor:
                            v.status === "In_progress" || v.status === "Inside"
                              ? "rgba(76,175,80,0.12)"
                              : "rgba(243,156,18,0.12)",
                          color:
                            v.status === "In_progress" || v.status === "Inside"
                              ? SUCCESS
                              : WARNING,
                        }}
                      >
                        {v.status || "Pending"}
                      </span>
                    );
                  case "time":
                    return (
                      <span
                        className="text-xs font-semibold"
                        style={{ color: NEUTRAL_DARK }}
                      >
                        {getCheckInTime(v)}
                      </span>
                    );
                  case "telephone":
                    return (
                      <span className="text-xs" style={{ color: "#555555" }}>
                        {v.telephone || "---"}
                      </span>
                    );
                  default:
                    return (
                      <span className="text-xs" style={{ color: "#555555" }}>
                        {v[header.key] || "-"}
                      </span>
                    );
                }
              }}
              pagination={{
                currentPage,
                totalPages: Math.ceil(totalCount / 50),
                totalCount,
                itemsPerPage: 50,
                onPageChange: (p) => setCurrentPage(p),
                loading: isLoading,
              }}
            />
          </div>
        </div>
      )}

      {activeTab === "visitors" && (
        <AssignedVisitorsList
          visitors={visitors
            .filter(
              (v) =>
                v.departments_assigned && v.departments_assigned.length > 0,
            )
            .map((v) => {
              const deptId = v.departments_assigned?.[0]?.department_id;
              const ss = v.services_status?.find(
                (s: any) => s.department_id === deptId,
              );
              const isSub = deptId ? subDepartmentIds.has(deptId) : false;
              let dn =
                v.departments_assigned?.[0]?.department_name ||
                v.department ||
                "General";
              let un = "";
              if (isSub) {
                un = dn;
                const p = departments.find((d) =>
                  d.sub_departments?.some(
                    (s: any) => (s._id || s.department_id) === deptId,
                  ),
                );
                dn = p?.department_name || p?.name || "Unknown";
              }
              return {
                id: String(v._id || v.id || ""),
                fullName: getVisitorName(v),
                nationalId: getIdentification(v),
                identity: getIdentification(v),
                badgeNumber: v.badge_number || v.badge || "---",
                service: "General Inquiry",
                department: dn,
                unit: un,
                assignmentTime: getCheckInTime(v),
                status: String(v.status || "pending"),
                phone: String(v.telephone || ""),
                checkInTime: getCheckInTime(v),
                roomNumber: "Pending",
                queuePosition: 0,
                checkedInTime: getCheckInTime(v),
                checkedInGate: "Main Gate",
                receptionistName: "",
                officerName: "Pending",
                providerName:
                  ss?.provider_name ||
                  v.departments_assigned?.[0]?.provider_name ||
                  "",
                providerId:
                  ss?.provider_id ||
                  v.departments_assigned?.[0]?.provider_id ||
                  "",
                serviceType:
                  ss?.s_type || v.services_status?.[0]?.s_type || "Not started",
                currentDepartmentId: deptId,
              };
            })}
        />
      )}

      <VisitorDetails
        isOpen={showVisitorModal}
        onClose={handleCloseVisitorModal}
        visitor={selectedVisitorForModal as any}
        onSaved={handleVisitorSaved}
        onAssign={handleAssignFromModal}
      />

      {showAssignComponent && selectedVisitorForModal && (
        <AssignVisitorComponent
          visitorId={selectedVisitorForModal._id!}
          visitorName={getVisitorName(selectedVisitorForModal)}
          visitorEmail={selectedVisitorForModal.email || ""}
          visitorTelephone={selectedVisitorForModal.telephone || ""}
          onClose={() => setShowAssignComponent(false)}
          onAssigned={handleAssignmentComplete}
          departmentCounts={departmentVisitorCounts}
        />
      )}
    </div>
  );
};

export default ReceptionistDashboard;
