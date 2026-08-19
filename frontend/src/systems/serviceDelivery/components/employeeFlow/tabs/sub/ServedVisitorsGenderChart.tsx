import { useState, useEffect, useCallback, useRef } from "react";
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
import { FiUsers } from "react-icons/fi";
import { serviceDeliveryService } from "@/core/services/adminService";
import SpiralLoader from "@/systems/event-managment/components/SpiralLoader";

const PRIMARY = "#056daa";
const BLUE = "#2980B9";
const ORANGE = "#F39C12";
const GREEN = "#4CAF50";
const NEUTRAL_DARK = "#333333";
const BORDER = "#E0E0E0";
const WHITE = "#FFFFFF";
const GRAY = "#9E9E9E";
const fontHeading = "'Montserrat', sans-serif";

export type ChartPeriod = "today" | "week" | "month" | "last_month" | "year" | "range";

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

interface ChartProps {
  subtitle?: string;
  period?: ChartPeriod;
  from?: string;
  to?: string;
  hideControls?: boolean;
}

const ServedVisitorsGenderChart: React.FC<ChartProps> = ({
  subtitle = "Served by you",
  period: periodProp,
  from: fromProp,
  to: toProp,
  hideControls,
}) => {
  const [period, setPeriod] = useState<ChartPeriod>("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const controlled = periodProp !== undefined;
  const effPeriod = controlled ? periodProp : period;
  const effFrom = controlled ? (fromProp || "") : from;
  const effTo = controlled ? (toProp || "") : to;

  const fetchStats = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await serviceDeliveryService.getServedVisitorsGenderStats({
        period: effPeriod,
        from: effFrom || undefined,
        to: effTo || undefined,
      });
      if (res && typeof res === "object" && "data" in res && Array.isArray(res.data)) {
        setData(res.data as DataPoint[]);
      } else {
        setData([]);
      }
    } catch {
      setData([]);
    } finally {
      if (isInitialLoad) {
        setIsInitialLoad(false);
        setLoading(false);
      } else if (!silent) {
        setLoading(false);
      }
    }
  }, [effPeriod, effFrom, effTo, isInitialLoad]);

  const firstControlledRun = useRef(true);

  useEffect(() => {
    fetchStats(true);
  }, []);

  useEffect(() => {
    if (!controlled) return;
    if (firstControlledRun.current) {
      firstControlledRun.current = false;
      return;
    }
    setLoading(true);
    fetchStats();
  }, [effPeriod, effFrom, effTo]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchStats(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const handleApply = () => {
    setLoading(true);
    fetchStats();
  };

  return (
    <div className="p-4" style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 0 }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>
              <FiUsers className="w-4 h-4" style={{ color: PRIMARY }} />
              Served Visitors by Gender
            </h3>
            <p className="text-xs" style={{ color: GRAY }}>{subtitle}</p>
          </div>
        </div>
      </div>

      {!controlled && !hideControls && (
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as ChartPeriod)}
            className="cok-auth-input w-full sm:w-auto"
            style={{ fontFamily: fontHeading, paddingLeft: "12px", minHeight: "38px" }}
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
                style={{ fontFamily: fontHeading, paddingLeft: "12px", minHeight: "38px" }}
              />
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="cok-auth-input w-full sm:w-auto"
                style={{ fontFamily: fontHeading, paddingLeft: "12px", minHeight: "38px" }}
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
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <SpiralLoader />
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-8 text-xs" style={{ color: GRAY }}>
          No data available
        </div>
      ) : (
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 15, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                angle={-30}
                textAnchor="end"
                height={60}
                interval={0}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                allowDecimals={false}
                domain={[0, (dataMax: number) => Math.ceil((dataMax || 1) * 1.2)]}
              />
              <Tooltip
                contentStyle={{ borderRadius: 0, border: `1px solid ${BORDER}` }}
                labelStyle={{ fontFamily: fontHeading }}
              />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
              <Line type="monotone" dataKey="Male" stroke={BLUE} strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 4 }} label={{ position: 'top', fill: '#333333', fontSize: 10, fontWeight: 600 }} isAnimationActive={false} />
              <Line type="monotone" dataKey="Female" stroke={ORANGE} strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 4 }} label={{ position: 'top', fill: '#333333', fontSize: 10, fontWeight: 600 }} isAnimationActive={false} />
              <Line type="monotone" dataKey="Other" stroke={GREEN} strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 4 }} label={{ position: 'top', fill: '#333333', fontSize: 10, fontWeight: 600 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default ServedVisitorsGenderChart;
