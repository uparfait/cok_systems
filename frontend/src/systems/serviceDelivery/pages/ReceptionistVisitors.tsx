import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiSearch,
  FiUsers,
  FiGrid,
  FiCheckCircle,
  FiClock,
} from "react-icons/fi";
import {
  serviceDeliveryService,
  departmentService,
} from "../../../core/services/adminService";
import { useAuth } from "../../../core/contexts/AuthContext";
import { useSocket } from "../../../core/contexts/SocketContext";
import { useToast } from "../../../core/contexts/ToastContext";
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
  registered_by?: string;
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

const ReceptionistVisitors: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { socket, isConnected } = useSocket();
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "inhouse" | "history">("inhouse");
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [unassignedVisitors, setUnassignedVisitors] = useState<Visitor[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [subDepartmentIds, setSubDepartmentIds] = useState<Set<string>>(
    new Set(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);
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
    if (!authLoading && !isAuthenticated) navigate("/login");
  }, [isAuthenticated, authLoading, navigate]);

  const loadData = async () => {
    setIsLoading(true);
    if (searchTerm?.trim()) setSearchLoading(true);
    try {
      const inHouse = statusFilter === "inhouse" ? true : statusFilter === "history" ? false : undefined;
      const history = statusFilter === "history" ? true : false;
      let visitorRes = await serviceDeliveryService.getDashboardVisitors(currentPage, 20, searchTerm, inHouse, history);
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
        setUnassignedVisitors(allVisitors);
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
    } catch (error) {
    } finally {
      setFirstLoad(false);
      setIsLoading(false);
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentPage, searchTerm, statusFilter]);

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

  const applySearch = () => {
    setSearchLoading(true);
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
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 w-full sm:w-11/12">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: GRAY_DISABLED }} />
            <input
              type="text"
              placeholder="Search Badge, Name, Phone..."
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                applySearch();
              }}
              onKeyDown={(e) => e.key === "Enter" && applySearch()}
              className="cok-auth-input w-full h-[50px] pl-8"
            />
          </div>
      
          <button
            onClick={applySearch}
            disabled={searchLoading}
            className="cok-btn-primary flex items-center gap-2"
            style={{ width: "auto", padding: "0.6rem 1rem" }}
          >
            {searchLoading ? (
              <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#FFFFFF', borderTopColor: 'transparent' }}></div>
            ) : (
              <></>
            )}
            {searchLoading ? 'Searching...' : 'Search'}
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
          data={unassignedVisitors}
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
            totalPages: Math.ceil(totalCount / 20),
            totalCount,
            itemsPerPage: 20,
            onPageChange: (p) => setCurrentPage(p),
            loading: isLoading,
          }}
        />
      </div>

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

export default ReceptionistVisitors;
