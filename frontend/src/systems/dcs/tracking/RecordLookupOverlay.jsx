import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { flatten_fields } from "../jsonlogic/dependencyGraph.js";
import { search_public_records } from "./trackingService.js";
import { field_name, format_value, format_when } from "./trackingConfig.js";
import { RecordDates, RecordFieldsList } from "./RecordHistory.jsx";
import { RecordHistorySlidesOverlay } from "./RecordHistorySlides.jsx";
import { InputSearchIcon } from "./RecordFieldWrap.jsx";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import DcsCloseIconButton from "../components/DcsCloseIconButton.jsx";

const PRIMARY = "#056daa";
const MUTED = "#9E9E9E";
const TEXT = "#333333";
const BORDER = "#E0E0E0";
const FONT = "'Montserrat', sans-serif";
const PREVIEW_FIELDS = 3;

/** One found record: its dates as the title, a few answers, its history as slides, and Load. */
function RecordCard({ record, fields, tracking, isLoaded, onLoad, onHistory }) {
  const { translate, language } = useDcsLanguage();
  const preview = flatten_fields(fields)
    .filter((field) => field.id !== tracking.key_field_id && record.data && record.data[field.id] !== undefined && record.data[field.id] !== null && record.data[field.id] !== "")
    .slice(0, PREVIEW_FIELDS);
  const change_count = Math.max(0, (record.history || []).length - 1);

  return (
    <div className="border p-3" style={{ borderColor: isLoaded ? PRIMARY : BORDER, backgroundColor: isLoaded ? "rgba(5,109,170,0.05)" : "#FFFFFF" }}>
      <p className="text-sm font-bold" style={{ color: TEXT, fontFamily: FONT }}>{format_when(record.submitted_at)}</p>
      <RecordDates record={record} />
      {preview.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {preview.map((field) => (
            <p key={field.id} className="text-xs truncate" style={{ color: TEXT }}>
              <span style={{ color: MUTED }}>{field_name(field, language)}: </span>
              {format_value(record.data[field.id])}
            </p>
          ))}
        </div>
      )}
      <div className="flex flex-col min-[480px]:flex-row gap-2 mt-3">
        <DcsButtonOutline className="flex-1" onClick={() => onHistory(record)}>
          {translate("DCS_TRACKING_SHOW_HISTORY")}
          {change_count > 0 ? ` (${change_count})` : ""}
        </DcsButtonOutline>
        <DcsButtonPrimary className="flex-1" onClick={() => onLoad(record)} disabled={isLoaded}>
          {translate(isLoaded ? "DCS_TRACKING_LOADED" : "DCS_TRACKING_LOAD")}
        </DcsButtonPrimary>
      </div>
    </div>
  );
}

/**
 * The record finder of a tracked form: type the key value, search, and
 * every record holding it is listed newest first - each titled by the
 * date it was recorded, with a few of its answers, its history as slides
 * of the form (full screen) and a Load action that fills the form with
 * it. When a record is already loaded it opens first, with its own
 * history and the search underneath to pick another.
 *
 * Full screen on a phone, a centered card from 750px up.
 */
export default function RecordLookupOverlay({ formGroupId, fields, tracking, initialKey, loadedRecord, onLoad, onClose }) {
  const { translate, language } = useDcsLanguage();
  const [key, setKey] = useState(initialKey || "");
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [slides_record, setSlidesRecord] = useState(null);
  const input_ref = useRef(null);
  const holder_ref = useRef(null);
  const key_field = flatten_fields(fields).find((field) => field.id === tracking.key_field_id);
  // Respondents know the key by the field's own name ("National ID"), never as "the key".
  const key_name = field_name(key_field, language) || translate("DCS_TRACKING_KEY_LABEL");

  const run_search = async (value) => {
    const wanted = String(value === undefined ? key : value).trim();
    if (!wanted) {
      setError(translate("DCS_TRACKING_KEY_REQUIRED", { field: key_name }));
      return;
    }
    setSearching(true);
    setError("");
    try {
      const response = await search_public_records(formGroupId, wanted);
      setResults((response.data && response.data.records) || []);
    } catch (search_error) {
      setResults(null);
      setError(search_error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (initialKey && String(initialKey).trim()) run_search(initialKey);
    else if (input_ref.current) input_ref.current.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load_and_close = (record) => {
    onLoad(record);
    onClose();
  };

  const slides_is_loaded = !!slides_record && !!loadedRecord && loadedRecord._id === slides_record._id;

  return createPortal(
    <>
      <div className="dcs-tracking-overlay dcs-no-print">
        <div className="absolute inset-0 bg-black/45" onClick={onClose} />
        <div className="dcs-tracking-panel">
          <div className="cok-bg-primary px-4 py-3 flex items-center justify-between gap-2 flex-shrink-0">
            <span className="text-white font-semibold uppercase tracking-wide text-sm truncate" style={{ fontFamily: FONT }}>
              {translate("DCS_TRACKING_LOOKUP_TITLE")}
            </span>
            <DcsCloseIconButton onClick={onClose} />
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-4 space-y-4">
            {loadedRecord && (
              <div className="border-2 p-3 space-y-3" style={{ borderColor: PRIMARY }}>
                <p className="text-xs font-bold uppercase" style={{ color: PRIMARY, fontFamily: FONT, letterSpacing: 0.5 }}>
                  {translate("DCS_TRACKING_LOADED_RECORD")}
                </p>
                <p className="text-sm font-bold" style={{ color: TEXT, fontFamily: FONT }}>{format_when(loadedRecord.submitted_at)}</p>
                <RecordDates record={loadedRecord} />
                <RecordFieldsList record={loadedRecord} fields={fields} editableIds={tracking.editable_field_ids} />
                <DcsButtonOutline className="w-full" onClick={() => setSlidesRecord(loadedRecord)}>
                  {translate("DCS_TRACKING_SHOW_HISTORY")}
                  {(loadedRecord.history || []).length > 1 ? ` (${(loadedRecord.history || []).length - 1})` : ""}
                </DcsButtonOutline>
              </div>
            )}

            <div>
              <label className="cok-auth-label">{key_name}</label>
              <div ref={holder_ref} className="dcs-key-field">
                <input
                  ref={input_ref}
                  type="text"
                  className="cok-auth-input w-full py-3"
                  placeholder={translate("DCS_TRACKING_KEY_PLACEHOLDER", { field: key_name })}
                  value={key}
                  onChange={(event) => setKey(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") run_search();
                  }}
                />
                <InputSearchIcon holderRef={holder_ref} onClick={() => run_search()} disabled={searching} busy={searching} fieldName={key_name} />
              </div>
              {error && <p className="text-xs mt-1" style={{ color: "#E74C3C" }}>{error}</p>}
            </div>

            {results && results.length === 0 && (
              <div className="border p-3" style={{ borderColor: BORDER, backgroundColor: "#F7F9FB" }}>
                <p className="text-sm" style={{ color: TEXT, fontFamily: FONT }}>{translate("DCS_TRACKING_NO_RECORDS", { field: key_name })}</p>
                <p className="text-xs mt-1" style={{ color: MUTED }}>{translate("DCS_TRACKING_NO_RECORDS_HINT")}</p>
              </div>
            )}

            {results && results.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold" style={{ color: MUTED, fontFamily: FONT }}>
                  {translate("DCS_TRACKING_RESULTS_COUNT", { count: results.length })}
                </p>
                {results.map((record) => (
                  <RecordCard
                    key={record._id}
                    record={record}
                    fields={fields}
                    tracking={tracking}
                    isLoaded={!!loadedRecord && loadedRecord._id === record._id}
                    onLoad={load_and_close}
                    onHistory={setSlidesRecord}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {slides_record && (
        <RecordHistorySlidesOverlay
          record={slides_record}
          fields={fields}
          onClose={() => setSlidesRecord(null)}
          onLoadLatest={slides_is_loaded ? undefined : () => load_and_close(slides_record)}
        />
      )}
    </>,
    document.body,
  );
}
