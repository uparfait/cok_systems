import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { serviceDeliveryService } from "../../../../core/services/adminService";
import SpiralLoader from "@/systems/event-managment/components/SpiralLoader";

const PRIMARY = "#056daa";
const BLUE = "#2563EB";
const ORANGE = "#E65100";
const YELLOW = "#F39C12";
const NEUTRAL_LIGHT = "#F7F9FB";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const WHITE = "#FFFFFF";
const GRAY_DISABLED = "#9E9E9E";
const fontHeading = "'Montserrat', sans-serif";
const CARD_SHADOW = "0 8px 40px 0 rgba(0,0,0,0.08)";

const PERIOD_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "year", label: "This Year" },
  { value: "range", label: "Custom Range" },
];

interface DataPoint {
  label: string;
  Male: number;
  Female: number;
  Other: number;
}

const AssignedVisitorsGenderChart: React.FC = () => {
  const [period, setPeriod] = useState<"today" | "week" | "month" | "last_month" | "year" | "range">("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const fetchStats = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await serviceDeliveryService.getAssignedVisitorsGenderStats({
        period,
        from: from || undefined,
        to: to || undefined,
      });
      if (res && typeof res === "object" && "data" in res && Array.isArray(res.data)) {
        setData(res.data as DataPoint[]);
      } else {
        setData([]);
      }
    } catch (error) {
      setData([]);
    } finally {
      if (isInitialLoad) {
        setIsInitialLoad(false);
        setLoading(false);
      } else if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchStats(true);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchStats(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [period, from, to]);

  const handleApply = () => {
    setLoading(true);
    fetchStats();
  };

  return (
    <div
      className="p-4"
      style={{
        backgroundColor: WHITE,
        boxShadow: CARD_SHADOW,
        borderRadius: 0,
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="p-1.5"
            style={{
              backgroundColor: "rgba(5,109,170,0.08)",
              borderRadius: 999,
            }}
          >
            <svg className="w-4 h-4" style={{ color: PRIMARY }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-3.354a4 4 0 11-8 0" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>
              Visitors by Gender
            </h3>
            <p className="text-xs text-gray-400">Assigned by you</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as any)}
          className="cok-auth-input w-full sm:w-auto"
          style={{ fontFamily: fontHeading }}
        >
          {PERIOD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {period === "range" && (
          <>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="cok-auth-input w-full sm:w-auto"
              style={{ fontFamily: fontHeading }}
            />
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="cok-auth-input w-full sm:w-auto"
              style={{ fontFamily: fontHeading }}
            />
          </>
        )}
        <button
          onClick={handleApply}
          className="cok-btn-primary"
          style={{ width: "auto", padding: "0.6rem 1.2rem" }}
        >
          Apply
        </button>
      </div>

      {loading && isInitialLoad ? (
        <div className="flex items-center justify-center py-8">
          <SpiralLoader />
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-8 text-xs text-gray-400">
          No data available
        </div>
      ) : (
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                angle={-30}
                textAnchor="end"
                height={60}
                interval={0}
              />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: 0, border: "1px solid #E0E0E0" }}
                labelStyle={{ fontFamily: fontHeading }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
              />
              <Line
                type="monotone"
                dataKey="Male"
                stroke={BLUE}
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="Female"
                stroke={ORANGE}
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="Other"
                stroke={YELLOW}
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default AssignedVisitorsGenderChart;
