import React from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { TABS } from "./composeWidgets.js";
import { PRIMARY, BORDER, TEXT_DARK, TEXT_MUTED, HEADING_FONT } from "./builderUi.jsx";

const DANGER = "#E74C3C";

/**
 * The right-hand column of the builder: everything composed so far, grouped
 * by tab. One entry is one composition - a KPI "in each" fan-out shows as a
 * single row with its card count. Clicking an entry reopens it in its
 * composer for editing (the entry being edited is highlighted); Remove
 * drops it as a whole.
 */
export default function DraftList({ drafts, onRemove, onEdit, editingKey, disabled }) {
  const { translate } = useDcsLanguage();
  const total = drafts.reduce((sum, draft) => sum + draft.widgets.length, 0);

  return (
    <div className="flex flex-col h-full min-h-0">
      <p className="text-xs font-bold uppercase mb-1 flex-shrink-0" style={{ color: TEXT_MUTED, letterSpacing: "0.5px", ...HEADING_FONT }}>
        {translate("DCS_DB_BUILDER_DRAFTS", { count: total })}
      </p>
      {drafts.length > 0 && (
        <p className="text-[11px] mb-2 flex-shrink-0" style={{ color: TEXT_MUTED }}>
          {translate("DCS_DB_DRAFT_EDIT_HINT")}
        </p>
      )}
      {drafts.length === 0 ? (
        <p className="text-xs px-3 py-3" style={{ color: TEXT_MUTED, backgroundColor: "#F7F9FB" }}>
          {translate("DCS_DB_BUILDER_DRAFTS_EMPTY")}
        </p>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-3">
          {TABS.map((tab) => {
            const rows = drafts.filter((draft) => draft.tab === tab.id);
            if (rows.length === 0) return null;
            return (
              <section key={tab.id}>
                <p className="text-[11px] font-bold uppercase mb-1" style={{ color: PRIMARY, letterSpacing: "0.5px", ...HEADING_FONT }}>
                  {translate(tab.labelKey)} ({rows.reduce((sum, draft) => sum + draft.widgets.length, 0)})
                </p>
                <div className="flex flex-col gap-1.5">
                  {rows.map((draft) => {
                    const active = draft.key === editingKey;
                    return (
                      <div
                        key={draft.key}
                        role="button"
                        tabIndex={0}
                        onClick={() => !disabled && onEdit(draft)}
                        onKeyDown={(event) => {
                          if ((event.key === "Enter" || event.key === " ") && !disabled) {
                            event.preventDefault();
                            onEdit(draft);
                          }
                        }}
                        title={translate("DCS_DB_DRAFT_EDIT_TITLE")}
                        className="dcs-draft-in dcs-draft-row border px-3 py-2 flex items-start gap-2 cursor-pointer"
                        style={{ borderColor: active ? PRIMARY : BORDER, backgroundColor: active ? "#EAF3F8" : "#FFFFFF", borderLeftWidth: 3, borderLeftColor: active ? PRIMARY : BORDER }}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate" style={{ color: TEXT_DARK, ...HEADING_FONT }} title={draft.summary}>
                            {draft.summary}
                          </p>
                          <p className="text-xs truncate" style={{ color: TEXT_MUTED }} title={draft.detail}>
                            {draft.detail}
                          </p>
                          <p className="text-[11px] mt-0.5 flex flex-wrap gap-x-2" style={{ color: PRIMARY }}>
                            <span>{translate("DCS_DB_DRAFT_COUNT", { count: draft.widgets.length })}</span>
                            {draft.with_chart && <span>{translate("DCS_DB_DRAFT_WITH_CHART", { type: draft.with_chart })}</span>}
                            {active && <span className="font-bold">{translate("DCS_DB_DRAFT_EDITING_TAG")}</span>}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="text-xs font-semibold flex-shrink-0 cursor-pointer disabled:cursor-not-allowed"
                          style={{ color: DANGER, background: "none", border: "none", padding: 0, ...HEADING_FONT }}
                          disabled={disabled}
                          onClick={(event) => {
                            event.stopPropagation();
                            onRemove(draft.key);
                          }}
                        >
                          {translate("DCS_DB_DRAFT_REMOVE")}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
