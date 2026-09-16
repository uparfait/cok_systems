import React, { useEffect, useRef, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { get_kpi_skipped } from "./dashboardService.js";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import SpiralLoader from "../../event-managment/components/SpiralLoader.jsx";

const ORANGE = "#E67E22";
const PRIMARY = "#056daa";
const TEXT_DARK = "#333333";
const TEXT_MUTED = "#9E9E9E";
const HEADING_FONT = { fontFamily: "'Montserrat', sans-serif" };
const PAGE_SIZE = 20;

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
 * table of when it was submitted and exactly what was entered, newest
 * first. Rows arrive twenty at a time: scrolling to the bottom fetches the
 * next twenty until the true total is reached, and a failed page offers a
 * retry link right where the next rows would have appeared.
 */
export default function SkippedDetailsModal({ form, widget, period, filters, onClose, fetchSkipped }) {
  const { translate } = useDcsLanguage();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [has_more, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const fetching_ref = useRef(false);

  const load = (offset) => {
    if (fetching_ref.current) return;
    fetching_ref.current = true;
    setLoading(true);
    setFailed(false);
    // The public share-link page supplies its own token-based fetcher.
    (fetchSkipped ? fetchSkipped(widget, period, offset, PAGE_SIZE) : get_kpi_skipped(form.form_group_id, widget, period, offset, PAGE_SIZE, filters || []))
      .then((response) => {
        const data = response.data || {};
        setTotal(data.total || 0);
        setHasMore(Boolean(data.has_more));
        setRows((current) => (offset === 0 ? data.rows || [] : current.concat(data.rows || [])));
      })
      .catch(() => setFailed(true))
      .finally(() => {
        fetching_ref.current = false;
        setLoading(false);
      });
  };

  useEffect(() => {
    load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widget.id]);

  const handle_scroll = (event) => {
    const element = event.currentTarget;
    if (!has_more || loading || failed) return;
    if (element.scrollTop + element.clientHeight >= element.scrollHeight - 80) load(rows.length);
  };

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
  const retry_link = (
    <button type="button" onClick={() => load(rows.length)} className="text-xs font-semibold cursor-pointer" style={{ color: PRIMARY, background: "none", border: "none", textDecoration: "underline", ...HEADING_FONT }}>
      {translate("DCS_DB_RETRY")}
    </button>
  );

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

        {rows.length === 0 && loading ? (
          <div className="flex items-center justify-center py-8">
            <SpiralLoader />
          </div>
        ) : rows.length === 0 && failed ? (
          <p className="text-xs py-4 flex items-center gap-2" style={{ color: "#E74C3C" }}>
            {translate("DCS_ERROR_GENERIC")} {retry_link}
          </p>
        ) : rows.length === 0 ? (
          <p className="text-xs py-4" style={{ color: TEXT_MUTED }}>
            {translate("DCS_DB_SKIPPED_EMPTY")}
          </p>
        ) : (
          <>
            <div className="overflow-auto border" style={{ maxHeight: "50vh", borderColor: "#E0E0E0" }} onScroll={handle_scroll}>
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
              {loading && (
                <div className="flex items-center justify-center gap-2 py-3">
                  <SpiralLoader padded={false} size={16} />
                  <span className="text-xs" style={{ color: TEXT_MUTED }}>{translate("DCS_MYAPPROVALS_LOADING_MORE")}</span>
                </div>
              )}
              {!loading && failed && (
                <div className="flex items-center justify-center gap-2 py-3">
                  <span className="text-xs" style={{ color: "#E74C3C" }}>{translate("DCS_MYAPPROVALS_LOAD_FAILED")}</span>
                  {retry_link}
                </div>
              )}
            </div>
            <p className="text-xs font-semibold mt-2" style={{ color: ORANGE, ...HEADING_FONT }}>
              {translate("DCS_DB_SKIPPED_SHOWN", { shown: rows.length, count: total })}
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
