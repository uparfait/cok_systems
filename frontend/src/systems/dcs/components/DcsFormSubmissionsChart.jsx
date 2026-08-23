import React, { useEffect, useRef, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from "recharts";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { get_form_submission_stats } from "../services/formsService.js";
import DcsPeriodFilter from "./DcsPeriodFilter.jsx";
import DcsLoadingState from "./DcsLoadingState.jsx";

const PRIMARY = "#056daa";
const MIN_POINT_WIDTH_PX = 56;
const CHART_HEIGHT_PX = 280;
const REFRESH_INTERVAL_MS = 10000;

/**
 * Submissions-over-time line chart for one form: a period selector (today,
 * this month, this year, or a custom date range) drives a server-bucketed
 * time series - the backend itself picks hour/day/week/month/year
 * granularity based on how wide the selected range is, the same dynamic
 * idea as the service-delivery gender-stats chart this was modeled on.
 * Wrapped in its own horizontally-scrolling track (not just
 * ResponsiveContainer) so a wide time series stays readable - each point
 * keeps a minimum width and the chart scrolls instead of squeezing labels
 * into illegibility. Refreshes itself silently every 10 seconds using
 * whichever params were last actually applied (tracked in a ref, not the
 * live from/to inputs) - typing into a custom range's date fields must
 * never get silently fetched before "Apply" is actually clicked.
 */
export default function DcsFormSubmissionsChart({ formGroupId }) {
  const { translate } = useDcsLanguage();
  const [period, setPeriod] = useState("this_month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const applied_params_ref = useRef({ period: "this_month", from: "", to: "" });

  const fetch_stats = (params, silent) => {
    if (params.period === "custom" && !params.from) return;
    applied_params_ref.current = params;
    if (!silent) setLoading(true);
    get_form_submission_stats(formGroupId, {
      period: params.period,
      from: params.period === "custom" ? params.from : undefined,
      to: params.period === "custom" ? params.to : undefined,
    })
      .then((response) => setResult(response.data))
      .catch(() => {
        if (!silent) setResult(null);
      })
      .finally(() => {
        if (!silent) setLoading(false);
      });
  };

  const handle_apply = () => fetch_stats({ period, from, to }, false);

  useEffect(() => {
    if (period !== "custom") fetch_stats({ period, from: "", to: "" }, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, formGroupId]);

  useEffect(() => {
    const interval_id = window.setInterval(() => {
      fetch_stats(applied_params_ref.current, true);
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formGroupId]);

  const data = (result && result.data) || [];
  const total = result ? result.total : 0;

  return (
    <div className="dcs-home-glass-card p-4 sm:p-5">
      <p
        className="text-xs font-semibold uppercase tracking-wide mb-3"
        style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif" }}
      >
        {translate("DCS_FORM_SUBMISSIONS_CHART_TITLE")}
      </p>

      <div className="mb-4 overflow-x-auto">
        <DcsPeriodFilter
          period={period}
          onPeriodChange={setPeriod}
          from={from}
          onFromChange={setFrom}
          to={to}
          onToChange={setTo}
          onApply={handle_apply}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center" style={{ height: CHART_HEIGHT_PX }}>
          <DcsLoadingState />
        </div>
      ) : data.length === 0 ? (
        <div className="flex items-center justify-center text-xs" style={{ height: CHART_HEIGHT_PX, color: "#9E9E9E" }}>
          {translate("DCS_STATS_NO_DATA")}
        </div>
      ) : (
        <div style={{ width: "100%", overflowX: "auto" }}>
          <div style={{ minWidth: Math.max(320, data.length * MIN_POINT_WIDTH_PX), height: CHART_HEIGHT_PX }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 24, right: 16, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-30} textAnchor="end" height={56} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 0, border: "1px solid #E0E0E0" }} />
                {/* Animation off: recharts replays its entrance animation (line
                    draws in, labels fade in from hidden) on every data change,
                    including the silent 10s refresh - with it on, the point
                    numbers briefly vanish and reappear on every single tick. */}
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke={PRIMARY}
                  strokeWidth={3}
                  dot={{ r: 3, fill: PRIMARY }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                >
                  <LabelList dataKey="count" position="top" style={{ fontSize: 11, fill: PRIMARY, fontWeight: 600 }} isAnimationActive={false} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <p className="mt-3 text-sm" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }}>
        {translate("DCS_STATS_TOTAL_IN_RANGE", { count: total })}
      </p>
    </div>
  );
}
