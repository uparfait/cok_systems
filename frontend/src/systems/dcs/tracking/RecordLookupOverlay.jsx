import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { search_public_records } from "./trackingService.js";
import { field_name, format_when, key_fields_of } from "./trackingConfig.js";
import { RecordDates, RecordFieldsList } from "./RecordHistory.jsx";
import { RecordHistorySlidesOverlay } from "./RecordHistorySlides.jsx";
import RecordResultsTable from "./RecordResultsTable.jsx";
import RecordLookupPager from "./RecordLookupPager.jsx";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import DcsOverlayHeader from "../components/DcsOverlayHeader.jsx";

const PRIMARY = "#056daa";
const MUTED = "#9E9E9E";
const TEXT = "#333333";
const BORDER = "#E0E0E0";
const FONT = "'Montserrat', sans-serif";
const PAGE_SIZE = 20;

export default function RecordLookupOverlay({ formGroupId, fields, tracking, initialField, initialKey, loadedRecord, onLoad, onClose }) {
  const { translate, language } = useDcsLanguage();
  const key_fields = key_fields_of(tracking, fields);
  const first_id = key_fields.length > 0 ? key_fields[0].id : "";
  const [field_id, setFieldId] = useState(initialField && key_fields.some((field) => field.id === initialField) ? initialField : first_id);
  const [key, setKey] = useState(initialKey || "");
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [slides_record, setSlidesRecord] = useState(null);
  const input_ref = useRef(null);
  const searched_field = key_fields.find((field) => field.id === field_id) || null;
  const searched_name = field_name(searched_field, language) || translate("DCS_TRACKING_KEY_LABEL");

  const run_search = async (options) => {
    const wanted = String(options && options.key !== undefined ? options.key : key).trim();
    const wanted_field = options && options.field !== undefined ? options.field : field_id;
    const page = (options && options.page) || 1;
    if (!wanted) {
      setError(translate("DCS_TRACKING_KEY_REQUIRED", { field: searched_name }));
      return;
    }
    setSearching(true);
    setError("");
    try {
      const response = await search_public_records(formGroupId, { field: wanted_field, key: wanted, page, limit: PAGE_SIZE });
      const data = response.data || {};
      const records = data.records || [];
      setResults({
        records,
        page: data.page || page,
        pages: data.pages || 1,
        total: data.total !== undefined ? data.total : records.length,
        field_id: wanted_field,
        key: wanted,
      });
    } catch (search_error) {
      setResults(null);
      setError(search_error.message || translate("DCS_ERROR_GENERIC"));
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (initialKey && String(initialKey).trim()) run_search({ key: initialKey });
    else if (input_ref.current) input_ref.current.focus();
  }, []);

  const load_and_close = (record) => {
    onLoad(record);
    onClose();
  };

  const results_field = results ? key_fields.find((field) => field.id === results.field_id) : null;
  const results_name = results_field ? field_name(results_field, language) : searched_name;
  const slides_is_loaded = !!slides_record && !!loadedRecord && loadedRecord._id === slides_record._id;

  return createPortal(
    <>
      <div className="dcs-tracking-overlay dcs-no-print" role="dialog" aria-modal="true" aria-busy={searching}>
        <div className="absolute inset-0 bg-black/45" onClick={searching ? undefined : onClose} />
        <div className="dcs-tracking-panel is-lookup">
          <DcsOverlayHeader title={translate("DCS_TRACKING_LOOKUP_TITLE")} onClose={onClose} busy={searching} />

          <div className="flex-shrink-0 px-4 pt-3 pb-3 border-b border-gray-100 space-y-2">
            <div className="flex flex-col min-[560px]:flex-row min-[560px]:items-center gap-2">
              <label className="cok-auth-label mb-0 flex-shrink-0">{translate("DCS_TRACKING_SEARCH_IN")}</label>
              {key_fields.length > 1 ? (
                <select className="cok-auth-input py-2 min-[560px]:w-56" value={field_id} onChange={(event) => setFieldId(event.target.value)} disabled={searching}>
                  {key_fields.map((field) => (
                    <option key={field.id} value={field.id}>{field_name(field, language)}</option>
                  ))}
                </select>
              ) : (
                <span className="text-sm font-semibold" style={{ color: PRIMARY, fontFamily: FONT }}>{searched_name}</span>
              )}
              <input
                ref={input_ref}
                type="text"
                className="cok-auth-input py-2 flex-1 min-w-0"
                placeholder={translate("DCS_TRACKING_KEY_PLACEHOLDER", { field: searched_name })}
                value={key}
                onChange={(event) => setKey(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") run_search();
                }}
                disabled={searching}
              />
              <DcsButtonPrimary onClick={() => run_search()} disabled={searching}>
                {translate("DCS_FIELD_SEARCH_BTN")}
              </DcsButtonPrimary>
            </div>
            {error && <p className="text-xs" style={{ color: "#E74C3C" }}>{error}</p>}
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

            {searching && (
              <div className="flex justify-center py-6" style={{ color: PRIMARY }}>
                <span className="dcs-inline-spinner" style={{ width: 22, height: 22 }} />
              </div>
            )}

            {!searching && results && results.records.length === 0 && (
              <div className="border p-3" style={{ borderColor: BORDER, backgroundColor: "#F7F9FB" }}>
                <p className="text-sm" style={{ color: TEXT, fontFamily: FONT }}>{translate("DCS_TRACKING_NO_RECORDS", { field: results_name })}</p>
                <p className="text-xs mt-1" style={{ color: MUTED }}>{translate("DCS_TRACKING_NO_RECORDS_HINT")}</p>
              </div>
            )}

            {!searching && results && results.records.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold" style={{ color: MUTED, fontFamily: FONT }}>
                  {translate("DCS_TRACKING_RESULTS_FOR", { count: results.total, field: results_name, key: results.key })}
                </p>
                <RecordResultsTable
                  records={results.records}
                  fields={fields}
                  searchedFieldId={results.field_id}
                  loadedRecord={loadedRecord}
                  onLoad={load_and_close}
                  onHistory={setSlidesRecord}
                />
                <RecordLookupPager
                  page={results.page}
                  pages={results.pages}
                  total={results.total}
                  disabled={searching}
                  onPageChange={(next_page) => run_search({ page: next_page, key: results.key, field: results.field_id })}
                />
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
