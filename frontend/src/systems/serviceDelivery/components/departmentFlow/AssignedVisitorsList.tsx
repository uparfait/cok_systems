import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { FiSearch, FiX, FiCheck, FiClock, FiUsers, FiArrowRightCircle, FiUserCheck, FiCheckSquare } from "react-icons/fi";
import { useToast } from "../../../../core/contexts/ToastContext";
import { serviceDeliveryService } from "../../../../core/services/adminService";
import LoadingSpinner from "../../../../core/components/LoadingSpinner";
import Table from "../../../../core/components/Table";

const PRIMARY = "#056daa";
const SUCCESS = "#4CAF50";
const DANGER = "#E74C3C";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const WHITE = "#FFFFFF";
const GRAY_DISABLED = "#9E9E9E";
const TERTIARY = "#CDB896";
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
  full_name?: string;
  name?: string;
  visitorName?: string;
  badge_number?: string;
  badge?: string;
  identification?: string | { number?: string };
  telephone?: string;
  email?: string;
  status?: string;
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
    assigned_time?: string;
  }>;
  services_status?: Array<{
    department_id: string;
    department_name?: string;
    s_type?: string;
    provider_name?: string;
    provider_id?: string;
  }>;
}

interface AssignedVisitorsListProps {
  visitors?: Visitor[];
}

const getInitials = (name?: string) => {
  if (!name) return "??";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
};

const getColorFromName = (name?: string): string => {
  if (!name) return NEUTRAL_DARK;
  const colors = [
    PRIMARY,
    "#4CAF50",
    "#E74C3C",
    "#2980B9",
    "#8E44AD",
    "#D35400",
    "#16A085",
    "#2C3E50",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const AssignedVisitorsList: React.FC<AssignedVisitorsListProps> = ({ visitors: propVisitors }) => {
  const { showSuccess, showError } = useToast();
  const [visitors, setVisitors] = useState<Visitor[]>(propVisitors || []);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "inhouse" | "history">("all");
  const [loading, setLoading] = useState(false);
  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);
  const [showServicePanel, setShowServicePanel] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const itemsPerPage = 10;

  useEffect(() => {
    if (propVisitors) setVisitors(propVisitors);
  }, [propVisitors]);

  const fetchVisitors = useCallback(async (page: number, search?: string, filter?: "all" | "inhouse" | "history") => {
    setLoading(true);
    try {
      const searchQuery = search?.trim();
      let res;
      if (searchQuery) {
        res = await serviceDeliveryService.search(searchQuery, page, itemsPerPage, filter === "history" ? false : true);
      } else {
        res = await serviceDeliveryService.getAll(page, itemsPerPage, filter === "history" ? false : filter === "inhouse" ? true : undefined);
      }
      if (res?.success || res?.status) {
        const data = Array.isArray(res.data) ? res.data : [];
        setVisitors(data);
        setTotalCount(res.total || 0);
        setTotalPages(Math.ceil((res.total || 0) / itemsPerPage));
        setCurrentPage(page);
      } else {
        showError(res?.message || "Failed to fetch visitors");
      }
    } catch {
      showError("Request failed");
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchVisitors(1, searchTerm || undefined, statusFilter);
  }, [statusFilter]);

  useEffect(() => {
    setLoading(true);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      fetchVisitors(1, searchTerm || undefined, statusFilter);
    }, 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchTerm, fetchVisitors, statusFilter]);

  const handleSearch = () => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    fetchVisitors(1, searchTerm || undefined, statusFilter);
  };

  const handlePageChange = (page: number) => {
    fetchVisitors(page, searchTerm || undefined, statusFilter);
  };

  const handleRowClick = (visitor: Visitor) => {
    setSelectedVisitor(visitor);
    setShowServicePanel(true);
  };

  const handleClosePanel = () => {
    setShowServicePanel(false);
    setSelectedVisitor(null);
  };

  const getVisitorName = (v: Visitor) => v.full_name || v.name || v.visitorName || "Unknown";
  const getIdentification = (v: Visitor) => !v.identification ? "---" : typeof v.identification === "string" ? v.identification : v.identification?.number || "---";
  const getBadge = (v: Visitor) => v.badge_number || v.badge || "---";
  const getDept = (v: Visitor) => {
    if (v.departments_assigned && v.departments_assigned.length > 0) return v.departments_assigned[0].department_name || v.department || "General";
    return v.department || "General";
  };
  const getTime = (v: Visitor) => new Date(v.checkInTime || v.check_in_time || v.entry_date || "").toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) || "---";
  const getStatusLabel = (v: Visitor) => {
    if (v.status && String(v.status).trim() !== '') return String(v.status);
    const st = v.services_status?.find((s: any) => s.s_type === 'Inprogress');
    if (st) return 'In Progress';
    const completed = v.services_status?.find((s: any) => s.s_type === 'Completed');
    if (completed) return 'Completed';
    return 'Waiting';
  };

  const headers = [
    { key: "full_name", label: "VISITOR" },
    { key: "badge_number", label: "BADGE" },
    { key: "identification", label: "IDENTITY" },
    { key: "department", label: "DEPARTMENT" },
    { key: "time", label: "TIME" },
    { key: "status", label: "STATUS" },
  ];

  const renderCell = (header: any, v: Visitor) => {
    switch (header.key) {
      case "full_name":
        return (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 flex items-center justify-center text-white text-xs font-medium" style={{ backgroundColor: getColorFromName(getVisitorName(v)), borderRadius: 999 }}>
              {getInitials(getVisitorName(v))}
            </div>
            <p className="text-sm font-medium truncate" style={{ color: NEUTRAL_DARK }}>{getVisitorName(v)}</p>
          </div>
        );
      case "badge_number":
        return (
          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: "rgba(5,109,170,0.1)", color: PRIMARY, borderRadius: 0 }}>
            {getBadge(v)}
          </span>
        );
      case "identification":
        return <p className="text-xs" style={{ color: NEUTRAL_DARK }}>{getIdentification(v)}</p>;
      case "department":
        return <p className="text-xs" style={{ color: NEUTRAL_DARK }}>{getDept(v)}</p>;
      case "time":
        return <p className="text-xs font-medium" style={{ color: NEUTRAL_DARK }}>{getTime(v)}</p>;
      case "status": {
        const displayStatus = getStatusLabel(v);
        const isInProgress = displayStatus === "In Progress";
        const isCompleted = displayStatus === "Completed";
        const statusColor = isCompleted ? SUCCESS : isInProgress ? PRIMARY : GRAY_DISABLED;
        const statusBg = isCompleted ? "rgba(76,175,80,0.12)" : isInProgress ? "rgba(5,109,170,0.08)" : "rgba(158,158,158,0.12)";
        return (
          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: statusBg, color: statusColor, borderRadius: 0 }}>
            {displayStatus}
          </span>
        );
      }
      default:
        const val = v[header.key as keyof Visitor];
        if (typeof val === 'string') return <span className="text-xs" style={{ color: NEUTRAL_DARK }}>{val}</span>;
        if (Array.isArray(val)) return <span className="text-xs" style={{ color: NEUTRAL_DARK }}>---</span>;
        return <span className="text-xs" style={{ color: NEUTRAL_DARK }}>---</span>;
    }
  };

  return (
    <div className="space-y-4" style={{ backgroundColor: NEUTRAL_LIGHT }}>
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-base font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Service Tracking</h1>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: GRAY_DISABLED }} />
              <input
                type="text"
                placeholder="Search by name, ID or badge..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="cok-auth-input w-full pl-8 sm:w-96"
                onFocus={focusInput}
                onBlur={blurInput}
              />
          </div>
            <button onClick={handleSearch} className="cok-btn-primary flex items-center gap-2" style={{ width: "auto", padding: "0.6rem 1rem" }}>
              <FiSearch className="w-4 h-4" /> Search
            </button>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "inhouse" | "history")}
              className="cok-auth-input pr-3 py-3"
              style={{ width: "auto", minWidth: "120px" }}
            >
              <option value="all">All Visitors</option>
              <option value="inhouse">In House</option>
              <option value="history">History</option>
            </select>
        </div>
      </div>

      <div className="overflow-hidden" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW, borderRadius: 0 }}>
        <Table
          headers={headers}
          data={visitors}
          loading={loading}
          emptyMessage="No visitors found"
          onRowClick={(row) => handleRowClick(row as Visitor)}
          headerClassName="cok-bg-primary"
          renderCell={renderCell}
          pagination={{
            currentPage,
            totalPages,
            totalCount,
            itemsPerPage,
            onPageChange: handlePageChange,
            loading,
          }}
        />
      </div>

      {showServicePanel && selectedVisitor && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-80 shadow-2xl" style={{ backgroundColor: WHITE, borderRadius: 0 }}>
          <div className="h-full flex flex-col">
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${BORDER}`, backgroundColor: WHITE }}>
              <div className="flex items-center gap-2">
                <div className="p-1.5" style={{ backgroundColor: PRIMARY, borderRadius: 999 }}>
                  <FiClock className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-xs font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Service Tracking</span>
              </div>
              <button onClick={handleClosePanel} className="cok-btn-outlined" style={{ padding: '0.4rem 0.8rem' }}>
                <FiX className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              <div className="p-3" style={{ backgroundColor: NEUTRAL_LIGHT, borderRadius: 0 }}>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 flex items-center justify-center text-white text-xs font-medium" style={{ backgroundColor: getColorFromName(getVisitorName(selectedVisitor)), borderRadius: 999 }}>
                    {getInitials(getVisitorName(selectedVisitor))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate" style={{ color: NEUTRAL_DARK }}>{getVisitorName(selectedVisitor)}</p>
                    <p className="text-xs truncate" style={{ color: GRAY_DISABLED }}>{getDept(selectedVisitor)}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: `1px solid ${BORDER}` }}>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5" style={{ backgroundColor: PRIMARY, borderRadius: 999 }}></span>
                    <span className="text-xs font-medium" style={{ color: NEUTRAL_DARK }}>{getStatusLabel(selectedVisitor)}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs" style={{ color: GRAY_DISABLED }}>Checked In</p>
                    <p className="text-xs font-semibold" style={{ color: NEUTRAL_DARK }}>{getTime(selectedVisitor)}</p>
                  </div>
                </div>
              </div>

              <div className="p-3" style={{ backgroundColor: NEUTRAL_LIGHT, borderRadius: 0 }}>
                <p className="mb-2" style={{ fontFamily: fontHeading, fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: TERTIARY }}>Progress</p>
                <div className="relative">
                  <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-[#E0E0E0]"></div>
                  <div className="space-y-2">
                    {[
                      { label: 'Checked In', time: getTime(selectedVisitor), sub: 'Main Gate', done: true, icon: FiCheck },
                      { label: 'Transferred', time: selectedVisitor?.departments_assigned?.[0]?.assigned_time ? new Date(selectedVisitor.departments_assigned[0].assigned_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '---', sub: `To ${getDept(selectedVisitor)}`, done: getStatusLabel(selectedVisitor) === 'Completed' || getStatusLabel(selectedVisitor) === 'In Progress', icon: FiArrowRightCircle },
                      { label: 'Officer Accepted', time: selectedVisitor?.departments_assigned?.[0]?.provider_name || '---', sub: undefined, done: getStatusLabel(selectedVisitor) === 'Completed' || getStatusLabel(selectedVisitor) === 'In Progress', icon: FiUserCheck },
                      { label: 'Completed', time: '✓ Service done', sub: undefined, done: getStatusLabel(selectedVisitor) === 'Completed', icon: FiCheckSquare }
                    ].map((step, i) => (
                      <div key={i} className="flex items-center gap-2 relative">
                        <div className={`w-6 h-6 flex items-center justify-center z-10 shadow-sm ${step.done ? 'bg-[#4CAF50]' : 'bg-gray-100'}`} style={{ borderRadius: 0 }}>
                          <step.icon className={`w-3 h-3 ${step.done ? 'text-white' : 'text-gray-400'}`} />
                        </div>
                        <div className={`flex-1 p-1.5 shadow-sm ${step.done ? 'bg-[rgba(76,175,80,0.12)]' : 'bg-white'}`} style={{ borderRadius: 0 }}>
                          <p className={`text-xs font-semibold ${step.done ? 'text-[#388E3C]' : 'text-gray-400'}`}>{step.label}</p>
                          {step.sub && <p className="text-xs text-gray-500">{step.sub}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssignedVisitorsList;
