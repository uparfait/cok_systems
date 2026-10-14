import React, { useEffect, useRef, useState } from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { search_public_follow_up_records } from "../../services/followUpService.js";
import { flatten_fields } from "../../jsonlogic/dependencyGraph.js";
import { NON_DATA_TYPES, MEDIA_ANSWER_TYPES, column_label } from "../../fields/dataColumns.jsx";
import { field_name, format_value, format_when } from "../../tracking/trackingConfig.js";
import DcsCenterOverlay from "../DcsCenterOverlay.jsx";
import DcsButtonPrimary from "../DcsButtonPrimary.jsx";
import DcsButtonOutline from "../DcsButtonOutline.jsx";
import SpiralLoader from "../../../event-managment/components/SpiralLoader.jsx";

const FONT = "'Montserrat', sans-serif";
const PRIMARY = "#056daa";
const MUTED = "#9E9E9E";
const TEXT = "#333333";
const BORDER = "#E0E0E0";
const PREVIEW_COLUMNS = 4;

function preview_fields(fields, field) {
  const others = flatten_fields(fields || []).filter((entry) => entry.id !== field.id && !NON_DATA_TYPES.includes(entry.type) && !MEDIA_ANSWER_TYPES.includes(entry.type) && entry.type !== "geolocation");
  return [field].concat(others.slice(0, PREVIEW_COLUMNS - 1));
}

function read_page(response) {
  const body = response && response.data && Array.isArray(response.data.items) ? response.data : response || {};
  return { items: Array.isArray(body.items) ? body.items : [], page: body.page || 1, pages: body.pages || 1, total: body.total || 0 };
}

export default function FollowUpSearchOverlay({ followUpGroupId, field, initialQuery, fields, onPick, picking, onClose }) {
  const { translate, language } = useDcsLanguage();
  const [query, setQuery] = useState(initialQuery || "");
  const [term, setTerm] = useState("");
  const [result, setResult] = useState(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const input_ref = useRef(null);
  const label = field_name(field, language) || translate("DCS_TRACKING_KEY_LABEL");
  const columns = preview_fields(fields, field);

  const run_search = async (page, requested) => {
    const wanted = String(requested === undefined ? query : requested).trim();
    if (!wanted) {
      setError(translate("DCS_TRACKING_KEY_REQUIRED", { field: label }));
      return;
    }
    setSearching(true);
    setError("");
    try {
      const response = await search_public_follow_up_records(followUpGroupId, field.id, wanted, page || 1);
      setTerm(wanted);
      setResult(read_page(response));
    } catch (search_error) {
      setResult(null);
      setError(search_error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if ((initialQuery || "").trim()) run_search(1, initialQuery);
    else if (input_ref.current) input_ref.current.focus();
  }, []);

  const busy = searching || !!picking;

  return (
    <DcsCenterOverlay large title={translate("DCS_FU_SEARCH_TITLE", { field: label })} onClose={onClose} onBackdrop={onClose} busy={busy}>
      <div className="flex flex-col min-[480px]:flex-row min-[480px]:items-end gap-2 mb-3">
        <div className="min-w-0 flex-1">
          <label className="cok-auth-label" htmlFor="dcs-fu-search">
            {label}
          </label>
          <input
            id="dcs-fu-search"
            ref={input_ref}
            type="text"
            className="cok-auth-input w-full py-3"
            placeholder={translate("DCS_TRACKING_KEY_PLACEHOLDER", { field: label })}
            value={query}
            disabled={busy}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") run_search(1);
            }}
          />
        </div>
        <div className="flex-shrink-0 min-[480px]:w-40">
          <DcsButtonPrimary onClick={() => run_search(1)} disabled={busy || !query.trim()}>
            {translate("DCS_FU_SEARCH_BTN")}
          </DcsButtonPrimary>
        </div>
      </div>

      {error && (
        <p className="text-xs mb-3" style={{ color: "#E74C3C", fontFamily: FONT }}>
          {error}
        </p>
      )}

      {busy && <SpiralLoader />}

      {!busy && result && result.items.length === 0 && (
        <div className="border p-3" style={{ borderColor: BORDER, backgroundColor: "#F7F9FB" }}>
          <p className="text-sm" style={{ color: TEXT, fontFamily: FONT }}>
            {translate("DCS_FU_SEARCH_EMPTY", { field: label })}
          </p>
        </div>
      )}

      {!busy && result && result.items.length > 0 && (
        <>
          <p className="text-xs font-semibold mb-2" style={{ color: MUTED, fontFamily: FONT }}>
            {translate("DCS_TRACKING_RESULTS_COUNT", { count: result.total })}
          </p>
          <div className="cok-table-scroll border" style={{ borderColor: BORDER, "--cok-table-max-h": "calc(90vh - 260px)" }}>
            <table className="w-full text-sm" style={{ fontFamily: FONT }}>
              <thead>
                <tr>
                  <th className="text-left px-3 py-2 text-[11px] font-bold uppercase" style={{ color: MUTED, borderBottom: `1px solid ${BORDER}` }}>
                    {translate("DCS_TABLE_SUBMITTED_AT")}
                  </th>
                  {columns.map((column) => (
                    <th key={column.id} className="text-left px-3 py-2 text-[11px] font-bold uppercase" style={{ color: column.id === field.id ? PRIMARY : MUTED, borderBottom: `1px solid ${BORDER}` }}>
                      {column_label(column, language, translate)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.items.map((item) => (
                  <tr key={item._id} className="cursor-pointer hover:bg-gray-50" onClick={() => onPick(item)} title={translate("DCS_TRACKING_LOAD")}>
                    <td className="px-3 py-2" style={{ color: TEXT, borderBottom: `1px solid ${BORDER}` }}>
                      {format_when(item.submitted_at)}
                    </td>
                    {columns.map((column) => (
                      <td key={column.id} className="px-3 py-2 truncate" style={{ color: TEXT, maxWidth: 260, borderBottom: `1px solid ${BORDER}` }}>
                        {format_value(item.data ? item.data[column.id] : undefined)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-2 mt-3 flex-wrap">
            <span className="text-xs" style={{ color: MUTED, fontFamily: FONT }}>
              {translate("DCS_FU_SEARCH_PAGE", { page: result.page, pages: result.pages })}
            </span>
            <div className="flex items-center gap-2">
              <DcsButtonOutline onClick={() => run_search(result.page - 1, term)} disabled={result.page <= 1}>
                {translate("DCS_BTN_PREVIOUS")}
              </DcsButtonOutline>
              <DcsButtonOutline onClick={() => run_search(result.page + 1, term)} disabled={result.page >= result.pages}>
                {translate("DCS_BTN_NEXT")}
              </DcsButtonOutline>
            </div>
          </div>
        </>
      )}
    </DcsCenterOverlay>
  );
}
