import React from "react";
import { createPortal } from "react-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { format_when } from "./trackingConfig.js";
import { RecordHistoryList, FieldTimeline, RecordDates, RecordFieldsList } from "./RecordHistory.jsx";
import { HistoryIcon } from "./TrackingIcons.jsx";
import DcsCloseIconButton from "../components/DcsCloseIconButton.jsx";

const TEXT = "#333333";
const FONT = "'Montserrat', sans-serif";

/**
 * The change history of one collected record, opened from the data
 * tables of a tracked form: when it was recorded, every update with its
 * previous and new values, and each updatable field's value timeline.
 */
export default function RecordHistoryDialog({ record, fields, tracking, onClose }) {
  const { translate } = useDcsLanguage();
  return createPortal(
    <div className="dcs-tracking-overlay">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div className="dcs-tracking-panel">
        <div className="cok-bg-primary px-4 py-3 flex items-center justify-between gap-2 flex-shrink-0">
          <span className="text-white font-semibold uppercase tracking-wide text-sm truncate" style={{ fontFamily: FONT }}>
            {translate("DCS_TRACKING_HISTORY_TITLE")}
          </span>
          <DcsCloseIconButton onClick={onClose} />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-4 space-y-4">
          <div>
            <p className="text-sm font-bold" style={{ color: TEXT, fontFamily: FONT }}>{format_when(record.submitted_at)}</p>
            <RecordDates record={record} />
          </div>
          <RecordFieldsList record={record} fields={fields} editableIds={(tracking && tracking.editable_field_ids) || []} />
          <RecordHistoryList record={record} fields={fields} />
          <FieldTimeline record={record} fields={fields} editableIds={(tracking && tracking.editable_field_ids) || []} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** The small history trigger of one table row; hidden while the record has no history. */
export function RecordHistoryButton({ onClick, count }) {
  const { translate } = useDcsLanguage();
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      aria-label={translate("DCS_TRACKING_HISTORY_TITLE")}
      title={translate("DCS_TRACKING_HISTORY_TITLE")}
      className="dcs-dt-rowbtn cursor-pointer gap-1"
      style={{ width: "auto", minWidth: 26, height: 26, padding: "0 6px", borderRadius: 13, color: "#056daa", fontFamily: FONT, fontSize: 12, fontWeight: 700 }}
    >
      <HistoryIcon size={15} />
      {count > 0 ? count : ""}
    </button>
  );
}
