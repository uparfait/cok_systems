import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
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
import { SkeletonCard } from "./sub/ReceptionistSkeleton";

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
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { socket, isConnected } = useSocket();
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const [visitors, setVisitors] = useState<Visitor[]>([]);
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
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate("/login");
  }, [isAuthenticated, authLoading, navigate]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      let visitorRes = await serviceDeliveryService.getDashboardVisitors(1, 20);
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
      setHourlyDataLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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
  const assignedCount = visitors.filter(
    (v) => v.departments_assigned && v.departments_assigned.length > 0,
  ).length;
  const totalDepartments = departments.length;

  return (
    <div className="space-y-4" style={{ backgroundColor: NEUTRAL_LIGHT }}>
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
      </div>
    </div>
  );
};

export default ReceptionistDashboard;
