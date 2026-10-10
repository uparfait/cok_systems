import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FiUsers,
  FiClock,
  FiCheckCircle,
  FiGrid,
  FiDownload,
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
import { visitorApi } from "../../../core/components/visitor/visitorApi";
import { getStoredNavigation } from "../../../core/services/navigationService";
import { useAuth } from "../../../core/contexts/AuthContext";
import { useSocket } from "../../../core/contexts/SocketContext";
import { useToast } from "../../../core/contexts/ToastContext";
import { SkeletonCard } from "./sub/ReceptionistSkeleton";
import ReceptionistWaitingVisitors from "./sub/ReceptionistWaitingVisitors";
import type { WaitingVisit } from "./sub/ReceptionistWaitingVisitors";
import RequestStats from "../../../core/components/requests/RequestStatistics";
import OrientationStats from "../../../core/components/requests/OrientationStats";
import AssignedVisitorsGenderChart from "../components/departmentFlow/AssignedVisitorsGenderChart";
import ExportVisitorsModal from "../../../core/components/requests/ExportVisitorsModal";

const PRIMARY = "#056daa";
const SUCCESS = "#4CAF50";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const WHITE = "#FFFFFF";
const GRAY_DISABLED = "#9E9E9E";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";

const TOAST_EVENTS = ["visitor_checkedin", "visitor_checkedout", "car_checkedin", "car_checkedout"];
const QUIET_EVENTS = ["visitor_updated", "visitor_assigned", "service_status_updated"];

const ReceptionistDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { roleSlug: routeSlug } = useParams<{ roleSlug: string }>();
  const roleSlug = routeSlug || getStoredNavigation()?.role_slug || "receptionist";
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { socket, isConnected } = useSocket();
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const [waiting, setWaiting] = useState<WaitingVisit[]>([]);
  const [waitingTotal, setWaitingTotal] = useState(0);
  const [inHouseTotal, setInHouseTotal] = useState(0);
  const [totalDepartments, setTotalDepartments] = useState(0);
  const [firstLoad, setFirstLoad] = useState(true);
  const [hourlyData, setHourlyData] = useState<
    { hour: number; visitors_checked_in: number }[]
  >([]);
  const [hourlyDataLoading, setHourlyDataLoading] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);
  const liveTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate("/login");
  }, [isAuthenticated, authLoading, navigate]);

  const loadVisitors = useCallback(async () => {
    let waitingCount = 0;
    try {
      const visitorRes = await serviceDeliveryService.getDashboardVisitors(1, 20, undefined, true);
      if (visitorRes.status || visitorRes.success) {
        setWaiting(Array.isArray(visitorRes.data) ? visitorRes.data : []);
        waitingCount = visitorRes.total || 0;
        setWaitingTotal(waitingCount);
      }
    } catch (error) {
      setWaiting([]);
    }
    try {
      const inHouse = await visitorApi.list({ presence: "in_house", page: 1, limit: 1 });
      setInHouseTotal(Math.max(inHouse.pagination?.total || 0, waitingCount));
    } catch (error) {
      setInHouseTotal(waitingCount);
    }
  }, []);

  const loadHourly = useCallback(async () => {
    try {
      const hR = await statisticsService.getHourlyServiceDeliveryStats();
      if (hR.success) setHourlyData(hR.data?.hourly || hR.data || []);
    } catch (error) {}
  }, []);

  const loadDepartments = useCallback(async () => {
    try {
      const deptR = await departmentService.getAll();
      if (deptR.status || deptR.success) {
        setTotalDepartments(Array.isArray(deptR.data) ? deptR.data.length : 0);
      }
    } catch (error) {}
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      await Promise.all([loadVisitors(), loadDepartments(), loadHourly()]);
      if (!active) return;
      setFirstLoad(false);
      setHourlyDataLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [loadVisitors, loadDepartments, loadHourly]);

  useEffect(() => {
    if (!socket || !isConnected) return undefined;
    const refresh = () => {
      if (liveTimer.current) window.clearTimeout(liveTimer.current);
      liveTimer.current = window.setTimeout(() => {
        loadVisitors();
        loadHourly();
      }, 400);
    };
    const withToast = (data: any) => {
      if (data && data.show_notif === false && data.message) {
        const m = data.message;
        const t = data.type || "info";
        if (t === "success") showSuccess(m);
        else if (t === "error") showError(m);
        else if (t === "warning") showWarning(m);
        else showInfo(m);
      }
      refresh();
    };
    TOAST_EVENTS.forEach((name) => socket.on(name, withToast));
    QUIET_EVENTS.forEach((name) => socket.on(name, refresh));
    return () => {
      TOAST_EVENTS.forEach((name) => socket.off(name, withToast));
      QUIET_EVENTS.forEach((name) => socket.off(name, refresh));
      if (liveTimer.current) window.clearTimeout(liveTimer.current);
    };
  }, [socket, isConnected, loadVisitors, loadHourly, showSuccess, showError, showWarning, showInfo]);

  const assignedCount = Math.max(0, inHouseTotal - waitingTotal);
  const openVisitorsPage = () => navigate(`/${roleSlug}/visitors`);

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
                value: inHouseTotal,
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

        <ReceptionistWaitingVisitors
          rows={waiting}
          total={waitingTotal}
          loading={firstLoad}
          onOpenVisitorsPage={openVisitorsPage}
        />

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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <RequestStats />
          <OrientationStats />
        </div>

        <div className="mb-4">
          <button
            onClick={() => setShowExportModal(true)}
            className="w-full px-6 py-3 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
            style={{ backgroundColor: PRIMARY, borderRadius: 0, fontFamily: fontHeading, letterSpacing: '1px', textTransform: 'uppercase' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#045d94'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY; }}
          >
            <FiDownload className="w-5 h-5" />
            EXPORT VISITORS DATA
          </button>
        </div>

        <AssignedVisitorsGenderChart />

        {showExportModal && (
          <ExportVisitorsModal onClose={() => setShowExportModal(false)} />
        )}
      </div>
    </div>
  );
};

export default ReceptionistDashboard;
