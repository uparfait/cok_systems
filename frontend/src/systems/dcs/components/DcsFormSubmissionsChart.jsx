import React from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from "recharts";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import DcsPeriodFilter from "./DcsPeriodFilter.jsx";
import DcsLoadingState from "./DcsLoadingState.jsx";

const PRIMARY = "#056daa";
const MIN_POINT_WIDTH_PX = 56;
const CHART_HEIGHT_PX = 280;

/**
 * Submissions-over-time line chart for one form. The period selector it
 * carries drives a server-bucketed time series - the backend picks
 * hour/day/week/month/year granularity from how wide the range is - and
 * the SAME selection drives the big total shown beside it on the form
 * overview, which is why period and result are owned by
 * useFormSubmissionStats and handed in rather than held here.
 *
 * Wrapped in its own horizontally-scrolling track (not just
 * ResponsiveContainer) so a wide series stays readable: each point keeps
 * a minimum width and the chart scrolls instead of squeezing labels into
 * illegibility.
 */
export default function DcsFormSubmissionsChart({ stats }) {
  const { translate } = useDcsLanguage();
  const data = stats.points;

  return (
    <div className="dcs-home-glass-card p-4 sm:p-5">
      <p
        className="text-xs font-semibold uppercase tracking-wide mb-3"
        style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif" }}
      >
        {translate("DCS_FORM_SUBMISSIONS_CHART_TITLE")}
      </p>

      <div className="mb-4">
        <DcsPeriodFilter
          period={stats.period}
          onPeriodChange={stats.setPeriod}
          from={stats.from}
          onFromChange={stats.setFrom}
          to={stats.to}
          onToChange={stats.setTo}
          onApply={stats.handle_apply}
          allowWrap
        />
      </div>

      {stats.loading ? (
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
        {translate("DCS_STATS_TOTAL_IN_RANGE", { count: stats.total })}
      </p>
    </div>
  );
}
