import React, { useEffect, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { get_kpi_skipped } from "./dashboardService.js";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import SpiralLoader from "../../event-managment/components/SpiralLoader.jsx";

const ORANGE = "#E67E22";
const TEXT_DARK = "#333333";
const TEXT_MUTED = "#9E9E9E";
const HEADING_FONT = { fontFamily: "'Montserrat', sans-serif" };

function format_date(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function format_raw(raw) {
  if (raw === null || raw === undefined) return "";
  return typeof raw === "string" ? raw : JSON.stringify(raw);
}

/**
 * The full detail behind an orange KPI card: every answer inside the
 * selected date range the numeric formula could not read as a number, as a
 * table of when it was submitted and exactly what was entered (newest
 * first, capped server-side at 200 with the true total shown).
 */
export default function SkippedDetailsModal({ form, widget, period, onClose }) {
  const { translate } = useDcsLanguage();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let is_mounted = true;
    setLoading(true);
    get_kpi_skipped(form.form_group_id, widget, period)
      .then((response) => {
        if (!is_mounted) return;
        setTotal((response.data && response.data.total) || 0);
        setRows((response.data && response.data.rows) || []);
      })
      .catch(() => is_mounted && setFailed(true))
      .finally(() => is_mounted && setLoading(false));
    return () => {
      is_mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widget.id]);

  const th_style = {
    color: TEXT_MUTED,
    ...HEADING_FONT,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.4px",
    textAlign: "left",
    padding: "0.4rem 0.6rem",
    borderBottom: "2px solid #E0E0E0",
    position: "sticky",
    top: 0,
    backgroundColor: "#FFFFFF",
  };
  const td_style = { color: TEXT_DARK, fontSize: 12, padding: "0.4rem 0.6rem", borderBottom: "1px solid #F0F0F0" };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white border-2 w-full p-5 sm:p-6 flex flex-col" style={{ maxWidth: 620, maxHeight: "85vh", borderColor: ORANGE }}>
        <p className="text-base font-semibold mb-1" style={{ color: TEXT_DARK, ...HEADING_FONT }}>
          {translate("DCS_DB_SKIPPED_TITLE")}
        </p>
        <p className="text-xs mb-1 truncate" style={{ color: ORANGE, ...HEADING_FONT, fontWeight: 600 }}>
          {widget.title}
        </p>
        <p className="text-xs mb-3" style={{ color: TEXT_MUTED }}>
          {translate("DCS_DB_SKIPPED_HINT")}
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <SpiralLoader />
          </div>
        ) : failed ? (
          <p className="text-xs py-4" style={{ color: "#E74C3C" }}>
            {translate("DCS_ERROR_GENERIC")}
          </p>
        ) : rows.length === 0 ? (
          <p className="text-xs py-4" style={{ color: TEXT_MUTED }}>
            {translate("DCS_DB_SKIPPED_EMPTY")}
          </p>
        ) : (
          <>
            <div className="overflow-auto border" style={{ maxHeight: "50vh", borderColor: "#E0E0E0" }}>
              <table className="w-full" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={th_style}>#</th>
                    <th style={th_style}>{translate("DCS_DB_SKIPPED_COL_DATE")}</th>
                    <th style={th_style}>{translate("DCS_DB_SKIPPED_COL_VALUE")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={index}>
                      <td style={td_style}>{index + 1}</td>
                      <td style={td_style}>{format_date(row.submitted_at)}</td>
                      <td style={{ ...td_style, wordBreak: "break-word" }}>{format_raw(row.raw)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs font-semibold mt-2" style={{ color: ORANGE, ...HEADING_FONT }}>
              {translate("DCS_DB_SKIPPED_TOTAL", { count: total })}
            </p>
          </>
        )}

        <div className="pt-4">
          <DcsButtonOutline className="w-full" onClick={onClose}>
            {translate("DCS_DB_SKIPPED_CLOSE")}
          </DcsButtonOutline>
        </div>
      </div>
    </div>
  );
}
