// ReceptionistDashboard Page - MainLayout Compatible + Figma UI Content
// INTEGRATED WITH BACKEND APIs

import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  FiSearch,
  FiUsers,
  FiClock,
  FiCheckCircle,
  FiMoreVertical,
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

// Import API Services
import {
  serviceDeliveryService,
  departmentService,
  statisticsService,
} from "../../../core/services/adminService";
import { useAuth } from "../../../core/contexts/AuthContext";
import { useSocket } from "../../../core/contexts/SocketContext";
import { useToast } from "../../../core/contexts/ToastContext";

// Import components
import AssignedVisitorsList from "../components/departmentFlow/AssignedVisitorsList";
import AssignVisitorModal from "../components/departmentFlow/AssignVisitorModal";
import DepartmentAvailability from "../components/departmentFlow/DepartmentAvailability";

// Types - Matching your backend structure
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
  address?: string;
  status: string;
  checkInTime?: string;
  check_in_time?: string;
  entry_date?: string;
  department?: string;
  departmentName?: string;
  service?: string;
  purpose?: string;
  assignedStaff?: string;
  room_number?: string;
  roomNumber?: string;
  queue_position?: number;
  queuePosition?: number;
  check_in_gate?: string;
  checkedInGate?: string;
  receptionist_name?: string;
  receptionistName?: string;
  officer_name?: string;
  officerName?: string;
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

interface MessageError {
  message: string;
  type: string;
  success: boolean;
}

let MessageError = {
  message: "",
  type: "",
  success: false,
};

// Skeleton Components
const SkeletonCard: React.FC = () => (
  <div className="backdrop-blur-xl bg-white/80 rounded-2xl p-5 shadow-lg border border-white/20 animate-pulse">
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
        <div className="h-8 bg-gray-200 rounded w-1/2"></div>
      </div>
      <div className="p-3 bg-gray-200 rounded-xl w-12 h-12"></div>
    </div>
  </div>
);

const SkeletonTableRow: React.FC = () => (
  <tr className="border-b border-gray-50">
    <td className="px-6 py-4">
      <div className="h-5 bg-gray-200 rounded-full w-16 animate-pulse"></div>
    </td>
    <td className="px-6 py-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
      </div>
    </td>
    <td className="px-6 py-4">
      <div className="h-3 bg-gray-200 rounded w-20 animate-pulse"></div>
    </td>
    <td className="px-6 py-4">
      <div className="h-5 bg-gray-200 rounded w-16 animate-pulse"></div>
    </td>
    <td className="px-6 py-4">
      <div className="h-3 bg-gray-200 rounded w-16 animate-pulse"></div>
    </td>
    <td className="px-6 py-4">
      <div className="h-3 bg-gray-200 rounded w-20 animate-pulse"></div>
    </td>
    <td className="px-6 py-4">
      <div className="h-8 bg-gray-200 rounded w-20 animate-pulse"></div>
    </td>
  </tr>
);

const ReceptionistDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { socket, isConnected } = useSocket();
  const { showSuccess, showError, showWarning, showInfo } = useToast();

  // State
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<"dashboard" | "visitors">(
    tabParam === "visitors" ? "visitors" : "dashboard",
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);

  // LIVE DATA STATES
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [unassignedVisitors, setUnassignedVisitors] = useState<Visitor[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [subDepartmentIds, setSubDepartmentIds] = useState<Set<string>>(
    new Set(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);

  // Hourly visitor data for graph
  const [hourlyData, setHourlyData] = useState<
    { hour: number; visitors_checked_in: number }[]
  >([]);
  const [hourlyDataLoading, setHourlyDataLoading] = useState(true);

  // Department visitor counts
  const [departmentVisitorCounts, setDepartmentVisitorCounts] = useState<
    Record<string, number>
  >({});

  // Unit data for assignment
  const [units, setUnits] = useState<any[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [selectedUnit, setSelectedUnit] = useState<string>("");

  // Modal States
  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [firstLoadVisitors, setFirstLoadVisitors] = useState(true);

  // Update tab when URL changes (Driven by MainLayout Sidebar)
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "visitors") setActiveTab("visitors");
    else setActiveTab("dashboard");
  }, [searchParams]);

  // Auth Check
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, authLoading, navigate]);

  // FETCH LIVE DATA
  const loadData = async () => {
    const isSearch = searchTerm && searchTerm.trim();
    if(firstLoadVisitors) {
      setIsLoading(true);
    }
    if (isSearch && firstLoadVisitors) {
      setSearchLoading(true);
    }
    try {
      let visitorRes;

      // Use backend search if searchTerm exists, otherwise get all
      if (searchTerm && searchTerm.trim()) {
        visitorRes = await serviceDeliveryService.search(
          searchTerm,
          currentPage,
          50,
        );
      } else {
        visitorRes = await serviceDeliveryService.getAll(currentPage, 50);
      }

      if (visitorRes.status || visitorRes.success) {
        let allVisitors = Array.isArray(visitorRes.data) ? visitorRes.data : [];

        // Keep all visitors in state for both assigned and unassigned views
        setVisitors(allVisitors);
        setTotalCount(visitorRes.total || 0);

        // Filter unassigned visitors for dashboard display
        const visitorData = allVisitors.filter((v: any) => {
          const deptAssigned = v.departments_assigned;
          return (
            !deptAssigned ||
            !Array.isArray(deptAssigned) ||
            deptAssigned.length === 0
          );
        });
        setUnassignedVisitors(visitorData);

        // Calculate visitor counts per department (for assigned visitors)
        const counts: Record<string, number> = {};
        allVisitors.forEach((v: any) => {
          if (v.departments_assigned && Array.isArray(v.departments_assigned)) {
            v.departments_assigned.forEach((dept: any) => {
              const deptName =
                dept.department_name || dept.department || "Unknown";
              counts[deptName] = (counts[deptName] || 0) + 1;
            });
          }
        });
        setDepartmentVisitorCounts(counts);
      }

      // Load departments
      const deptResponse = await departmentService.getAll();
      if (deptResponse.status || deptResponse.success) {
        const deptData = Array.isArray(deptResponse.data)
          ? deptResponse.data
          : [];
        setDepartments(deptData);

        // 👉 FIX: Properly capture all Sub-Department IDs regardless of formatting
        const subDeptIds = new Set<string>();
        deptData.forEach((dept: any) => {
          // Flat structure check
          if (
            dept.sub_department_mng?.is_sub_department === true ||
            dept.sub_department_mng?.is_sub_department === "true"
          ) {
            subDeptIds.add(String(dept._id || dept.department_id));
          }
          // Legacy nested structure check
          if (dept.sub_departments && Array.isArray(dept.sub_departments)) {
            dept.sub_departments.forEach((subDept: any) => {
              const subDeptId = subDept._id || subDept.department_id;
              if (subDeptId) subDeptIds.add(String(subDeptId));
            });
          }
        });
        setSubDepartmentIds(subDeptIds);
      }

      // Load hourly stats
      setHourlyDataLoading(true);
      try {
        const hourlyResponse =
          await statisticsService.getHourlyServiceDeliveryStats();
        if (hourlyResponse.success) {
          setHourlyData(
            hourlyResponse.data?.hourly || hourlyResponse.data || [],
          );
        }
      } catch (error) {
        console.error("Failed to fetch hourly stats:", error);
      } finally {
        setHourlyDataLoading(false);
        setFirstLoad(false);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setFirstLoad(false);
      setIsLoading(false);
      setSearchLoading(false);
      setFirstLoadVisitors(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentPage, searchTerm]);

  // Listen for visitor check-in events
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleVisitorCheckin = (data: any) => {
      console.log(
        "🔔 [ReceptionistDashboard] visitor_checkedin event received:",
        data,
      );

      if (data.show_notif === false) {
        const message = data.message || "Visitor checked in";
        const type = data.type || "info";

        if (type === "success") showSuccess(message);
        else if (type === "error") showError(message);
        else if (type === "warning") showWarning(message);
        else showInfo(message);
      }

      loadData();
    };

    socket.on("visitor_checkedin", handleVisitorCheckin);

    const handleVisitorCheckout = (data: any) => {
      console.log(
        "🔔 [ReceptionistDashboard] visitor_checkedout event received:",
        data,
      );

      if (data.show_notif === false) {
        const message = data.message || "Visitor checked out";
        const type = data.type || "info";

        if (type === "success") showSuccess(message);
        else if (type === "error") showError(message);
        else if (type === "warning") showWarning(message);
        else showInfo(message);
      }

      loadData();
    };

    socket.on("visitor_checkedout", handleVisitorCheckout);

    const handleCarCheckin = (data: any) => {
      console.log(
        "🔔 [ReceptionistDashboard] car_checkedin event received:",
        data,
      );

      if (data.show_notif === false) {
        const message = data.message || "Vehicle checked in";
        const type = data.type || "info";

        if (type === "success") showSuccess(message);
        else if (type === "error") showError(message);
        else if (type === "warning") showWarning(message);
        else showInfo(message);
      }

      loadData();
    };

    socket.on("car_checkedin", handleCarCheckin);

    const handleCarCheckout = (data: any) => {
      console.log(
        "🔔 [ReceptionistDashboard] car_checkedout event received:",
        data,
      );

      if (data.show_notif === false) {
        const message = data.message || "Vehicle checked out";
        const type = data.type || "info";

        if (type === "success") showSuccess(message);
        else if (type === "error") showError(message);
        else if (type === "warning") showWarning(message);
        else showInfo(message);
      }

      loadData();
    };

    socket.on("car_checkedout", handleCarCheckout);

    return () => {
      socket.off("visitor_checkedin", handleVisitorCheckin);
      socket.off("visitor_checkedout", handleVisitorCheckout);
      socket.off("car_checkedin", handleCarCheckin);
      socket.off("car_checkedout", handleCarCheckout);
    };
  }, [socket, isConnected, showSuccess, showError, showWarning, showInfo]);

  // 👉 FIX: Formatted Departments - STRICTLY hide sub-departments from the main modal dropdown
  const formattedDepartments = departments
    .filter(
      (dept) =>
        !dept.sub_department_mng?.is_sub_department &&
        dept.sub_department_mng?.is_sub_department !== "true",
    )
    .map((dept) => ({
      id: dept._id || dept.department_id,
      name: dept.department_name || dept.name,
      staffAvailable: dept.total_employees || dept.employees || 0,
      currentQueue:
        departmentVisitorCounts[dept.department_name || dept.name] || 0,
      isActive: dept.status !== "Inactive",
    }));

  // Helper functions
  const getIdentification = (visitor: Visitor): string => {
    if (!visitor.identification) return "---";
    if (typeof visitor.identification === "string")
      return visitor.identification;
    if (
      typeof visitor.identification === "object" &&
      visitor.identification.number
    ) {
      return visitor.identification.number;
    }
    return "---";
  };

  const getVisitorName = (visitor: Visitor): string => {
    return (
      visitor.full_name || visitor.name || visitor.visitorName || "Unknown"
    );
  };

  const getCheckInTime = (visitor: Visitor): string => {
    if (visitor.checkInTime)
      return new Date(visitor.checkInTime).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    if (visitor.check_in_time)
      return new Date(visitor.check_in_time).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    if (visitor.entry_date)
      return new Date(visitor.entry_date).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    return "Just now";
  };

  // Filtering Visitors
  const paginatedVisitors = unassignedVisitors;

  // Backend handles search and pagination - no frontend filtering needed
  const itemsPerPage = 50;
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  // Derived Stats
  const totalVisitors = Array.isArray(visitors) ? visitors.length : 0;
  const assignedCount = Array.isArray(visitors)
    ? visitors.filter(
        (v) => v.departments_assigned && v.departments_assigned.length > 0,
      ).length
    : 0;
  const totalDepartments = Array.isArray(departments) ? departments.length : 0;

  // 👉 FIX: Properly load sub-departments matching the selected parent ID
  const loadUnitsByDepartment = async (departmentId: string) => {
    setUnitsLoading(true);
    try {
      const response = await departmentService.getAll();
      if (response.status || response.success) {
        const deptData = Array.isArray(response.data) ? response.data : [];

        const subDepts = deptData.filter((dept: any) => {
          return (
            (dept.sub_department_mng?.is_sub_department === true ||
              dept.sub_department_mng?.is_sub_department === "true") &&
            String(dept.sub_department_mng?.parent_department_id) ===
              String(departmentId)
          );
        });

        const formattedUnits = subDepts.map((subDept: any) => ({
          id: subDept._id || subDept.department_id,
          name: subDept.department_name || subDept.name,
          staffAvailable: subDept.total_employees || 0,
          currentQueue:
            departmentVisitorCounts[subDept.department_name || subDept.name] ||
            0,
          isActive: true,
        }));

        setUnits(formattedUnits);
      } else {
        setUnits([]);
      }
    } catch (error) {
      console.error("Failed to load units:", error);
      setUnits([]);
    } finally {
      setUnitsLoading(false);
    }
  };

  // Assignment Handlers
  const handleAssignClick = async (visitor: Visitor) => {
    setSelectedVisitor(visitor);
    setShowAssignModal(true);
  };

  const handleCloseModal = () => {
    setShowAssignModal(false);
    setSelectedVisitor(null);
    setSelectedDepartment("");
    setSelectedUnit("");
    setUnits([]);
    setUnitsLoading(false);
  };

  const handleConfirmAssignment = async () => {
    if (selectedVisitor && selectedDepartment) {
      setIsAssigning(true);
      try {
        const visitorId = selectedVisitor._id || selectedVisitor.id;

        // If a unit is selected, assign to the unit; otherwise assign to the department
        const targetId = selectedUnit || selectedDepartment;
        const targetInfo = selectedUnit
          ? units.find((u) => u.id === selectedUnit)
          : formattedDepartments.find((d) => d.id === selectedDepartment);
        const targetName = targetInfo?.name || "";

        await serviceDeliveryService.assignToDepartment(
          visitorId as string,
          targetId,
          targetName,
          undefined, // No provider_id - unit-based assignment
          undefined, // No provider_name - unit-based assignment
        );

        handleCloseModal();
        showSuccess(
          `Assignment successful! Visitor assigned to ${targetName}`,
        );

        loadData();
      } catch (error) {
        MessageError = error as MessageError;

        console.error("Failed to assign visitor:", MessageError);
        // show toaster
        showWarning(
          MessageError?.message ||
            "Failed to assign visitor. Please try again.",
        );
      } finally {
        setIsAssigning(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* DASHBOARD TAB CONTENT */}
      {activeTab === "dashboard" && (
        <div className="max-w-7xl mx-auto space-y-6">
          {/* KPI Cards (Glassmorphism Styled) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {firstLoad ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : (
              <>
                <div className="group backdrop-blur-xl bg-white/80 rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-white/20">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-blue-700 text-sm font-medium mb-1">
                      Total Current Visitors
                      </p>
                      <h3 className="text-3xl font-bold text-blue-700">
                        {totalCount}
                      </h3>
                    </div>
                    <div className="p-3 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 backdrop-blur rounded-xl group-hover:scale-110 transition-transform">
                      <FiUsers className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                </div>

                <div className="group backdrop-blur-xl bg-white/80 rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-white/20">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-emerald-700 text-sm font-medium mb-1">
                        Total Departments
                      </p>
                      <h3 className="text-3xl font-bold text-emerald-700">
                        {totalDepartments}
                      </h3>
                    </div>
                    <div className="p-3 bg-gradient-to-br from-emerald-500/20 to-green-500/20 backdrop-blur rounded-xl group-hover:scale-110 transition-transform">
                      <FiGrid className="w-6 h-6 text-emerald-600" />
                    </div>
                  </div>
                </div>

                <div className="group backdrop-blur-xl bg-white/80 rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-white/20">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-teal-700 text-sm font-medium mb-1">
                        Total Assigned
                      </p>
                      <h3 className="text-3xl font-bold text-teal-700">
                        {assignedCount}
                      </h3>
                    </div>
                    <div className="p-3 bg-gradient-to-br from-teal-500/20 to-cyan-500/20 backdrop-blur rounded-xl group-hover:scale-110 transition-transform">
                      <FiCheckCircle className="w-6 h-6 text-teal-600" />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Chart Section - Glassmorphism Style */}
          <div className="backdrop-blur-xl bg-white/80 rounded-2xl shadow-lg border border-white/30 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-xl">
                <FiClock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">
                  Daily Insights
                </h3>
                <p className="text-xs text-gray-500">Visitor traffic by hour</p>
              </div>
            </div>
            {hourlyDataLoading && firstLoad ? (
              <div className="h-56 flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mx-auto mb-2"></div>
                  <p className="text-sm text-gray-500">Loading chart data...</p>
                </div>
              </div>
            ) : hourlyData.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={hourlyData}
                    margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient
                        id="colorVisitors"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#00aaff"
                          stopOpacity={0.25}
                        />
                        <stop
                          offset="95%"
                          stopColor="#00aaff"
                          stopOpacity={0.02}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#e5e7eb"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="hour"
                      tickFormatter={(value) =>
                        `${value.toString().padStart(2, "0")}:00`
                      }
                      stroke="#9ca3af"
                      fontSize={12}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#9ca3af"
                      fontSize={12}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(255, 255, 255, 0.95)",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                      }}
                      formatter={(value) => [value, "Visitors"]}
                      labelFormatter={(label) => `${label}:00`}
                    />
                    <Area
                      type="monotone"
                      dataKey="visitors_checked_in"
                      name="Visitors"
                      stroke="#00aaff"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorVisitors)"
                      animationDuration={1500}
                      dot={{
                        r: 4,
                        fill: "#fff",
                        stroke: "#00aaff",
                        strokeWidth: 2,
                      }}
                      activeDot={{
                        r: 6,
                        fill: "#00aaff",
                        stroke: "#fff",
                        strokeWidth: 2,
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-56 flex items-center justify-center text-gray-400">
                No hourly data available
              </div>
            )}

            {/* Stats below chart - well designed */}
            {hourlyData.length > 0 && (
              <div className="flex justify-center gap-8 mt-4 pt-4 border-t border-gray-100">
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-1">Peak Hour</p>
                  <p className="text-lg font-bold bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent">
                    {hourlyData.find(
                      (h) =>
                        h.visitors_checked_in ===
                        Math.max(
                          ...hourlyData.map((d) => d.visitors_checked_in),
                          0,
                        ),
                    )?.hour || 0}
                    :00
                  </p>
                  <p className="text-xs text-gray-400">
                    {Math.max(
                      ...hourlyData.map((h) => h.visitors_checked_in),
                      0,
                    )}{" "}
                    visitors
                  </p>
                </div>
                <div className="w-px bg-gray-200"></div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-1">Total Current</p>
                  <p className="text-lg font-bold text-gray-800">
                    {totalCount}
                  </p>
                  <p className="text-xs text-gray-400">visitors</p>
                </div>
              </div>
            )}
          </div>

          {/* Table Card (Figma Styled) */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex flex-wrap items-center justify-between bg-white gap-4">
              <h2 className="text-sm font-bold text-blue-600 uppercase tracking-wide">
                SEARCH VISITORS AND ASSIGN
              </h2>
              <div className="flex flex-wrap gap-3 items-center">
                <div className="relative">
                  {searchLoading ? (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : (
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  )}
                  <input
                    type="text"
                    placeholder="Search Badge, Name, or Phone"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`pl-9 pr-4 py-2 w-72 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 ${searchLoading ? "opacity-50" : ""}`}
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto min-h-[300px] max-h-[500px] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider px-6 py-4">
                      BADGE NUMBER
                    </th>
                    <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider px-6 py-4">
                      VISITOR NAME
                    </th>
                    <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider px-6 py-4">
                      ID NUMBER
                    </th>
                    <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider px-6 py-4">
                      STATUS
                    </th>
                    <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider px-6 py-4">
                      CHECK-IN TIME
                    </th>
                    <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider px-6 py-4">
                      PHONE
                    </th>
                    <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider px-6 py-4">
                      ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && firstLoad ? (
                    <>
                      <SkeletonTableRow />
                      <SkeletonTableRow />
                      <SkeletonTableRow />
                      <SkeletonTableRow />
                      <SkeletonTableRow />
                    </>
                  ) : paginatedVisitors.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="text-center py-8 text-sm text-gray-500"
                      >
                        No visitors found.
                      </td>
                    </tr>
                  ) : (
                    paginatedVisitors.map((visitor) => (
                      <tr
                        key={visitor._id || visitor.id}
                        className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            {visitor.badge_number || visitor.badge || "---"}
                          </span>
                        </td>
                        <td className="px-6 py-4 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                            {getVisitorName(visitor)
                              .substring(0, 2)
                              .toUpperCase()}
                          </div>
                          <p className="text-sm font-semibold text-gray-800">
                            {getVisitorName(visitor)}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs text-gray-600 font-medium">
                            {getIdentification(visitor)}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide ${visitor.status === "In_progress" || visitor.status === "Inside" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-600"}`}
                          >
                            {visitor.status || "Pending"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs font-semibold text-gray-800">
                            {getCheckInTime(visitor)}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs text-gray-600">
                            {visitor.telephone || "---"}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          {visitor.status === "In_progress" ||
                          visitor.status === "Inside" ? (
                            <button className="p-2 text-gray-400 hover:text-blue-600 cursor-not-allowed">
                              <FiMoreVertical className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleAssignClick(visitor)}
                              className="px-5 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-md transition-colors shadow-sm"
                            >
                              Assign
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
              <p className="text-xs text-gray-600">
                Showing{" "}
                {paginatedVisitors.length > 0
                  ? (currentPage - 1) * itemsPerPage + 1
                  : 0}{" "}
                to {Math.min(currentPage * itemsPerPage, totalCount)} of{" "}
                {totalCount} results
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(1, prev - 1))
                  }
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600 py-1 px-3">
                  Page {currentPage} of {totalPages || 1}
                </span>
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                  }
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ASSIGNED VISITORS TAB CONTENT */}
      {activeTab === "visitors" && (
        <div className="max-w-7xl mx-auto">
          <AssignedVisitorsList
            visitors={visitors
              .filter(
                (v) =>
                  v.departments_assigned && v.departments_assigned.length > 0,
              )
              .map((v) => {
                // Extract service status info for the first assigned department
                const deptId = v.departments_assigned?.[0]?.department_id;
                const serviceStatus = v.services_status?.find(
                  (s: any) => s.department_id === deptId,
                );

                // Check if the assigned department is a sub-department (unit)
                const isSubDepartment = deptId
                  ? subDepartmentIds.has(deptId)
                  : false;
                let departmentName =
                  v.departments_assigned?.[0]?.department_name ||
                  v.department ||
                  "General";
                let unitName = "";

                if (isSubDepartment) {
                  // If it's a sub-department, the department_name is actually the unit name
                  unitName = departmentName;
                  // Find the parent department name
                  const parentDept = departments.find((d) => {
                    if (d.sub_departments && Array.isArray(d.sub_departments)) {
                      return d.sub_departments.some(
                        (sub: any) => (sub._id || sub.department_id) === deptId,
                      );
                    }
                    return false;
                  });
                  departmentName =
                    parentDept?.department_name ||
                    parentDept?.name ||
                    "Unknown Department";
                }

                return {
                  id: String(v._id || v.id || ""),
                  fullName: getVisitorName(v),
                  nationalId: getIdentification(v),
                  identity: getIdentification(v),
                  badgeNumber: v.badge_number || v.badge || "---",
                  service: String(v.service || "General Inquiry"),
                  department: departmentName,
                  unit: unitName,
                  assignmentTime: getCheckInTime(v),
                  status: String(v.status || "pending"),
                  phone: String(v.telephone || ""),
                  checkInTime: getCheckInTime(v),
                  roomNumber: v.room_number || v.roomNumber || "Pending",
                  queuePosition: v.queue_position || v.queuePosition || 0,
                  checkedInTime: v.check_in_time
                    ? new Date(v.check_in_time).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : getCheckInTime(v),
                  checkedInGate:
                    v.check_in_gate || v.checkedInGate || "Main Gate",
                  receptionistName:
                    v.receptionist_name || v.receptionistName || "",
                  officerName: v.officer_name || v.officerName || "Pending",
                  // Service status info - provider and service type
                  providerName:
                    serviceStatus?.provider_name ||
                    v.departments_assigned?.[0]?.provider_name ||
                    "",
                  providerId:
                    serviceStatus?.provider_id ||
                    v.departments_assigned?.[0]?.provider_id ||
                    "",
                  serviceType:
                    serviceStatus?.s_type ||
                    v.services_status?.[0]?.s_type ||
                    "Not started",
                  currentDepartmentId: deptId,
                };
              })}
          />
        </div>
      )}

      {/* MODALS */}
      <AssignVisitorModal
        isOpen={showAssignModal}
        onClose={handleCloseModal}
        visitor={selectedVisitor as any}
        departments={formattedDepartments}
        units={units}
        selectedDepartment={selectedDepartment}
        selectedUnit={selectedUnit}
        onSelectDepartment={(deptId) => {
          setSelectedDepartment(deptId);
          setSelectedUnit(""); // Reset unit when department changes
          if (deptId) {
            loadUnitsByDepartment(deptId);
          } else {
            setUnits([]);
          }
        }}
        onSelectUnit={setSelectedUnit}
        onConfirm={handleConfirmAssignment}
        showSuccessMessage={showSuccessMessage}
        successMessage={successMessage}
        isLoading={isAssigning}
        unitsLoading={unitsLoading}
      />
    </div>
  );
};

export default ReceptionistDashboard;
