import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";

/**
 * What a board says when it has nothing on it yet - and the two ways out
 * of that. A dashboard with no widgets can be FILLED, by generating a set
 * from the form's own fields, or STARTED EMPTY, by dropping in a canvas
 * and putting widgets in it by hand. A viewer with no editing rights is
 * only told that it is empty.
 *
 * With no dashboard at all, the only step is naming one.
 */
export default function BoardEmptyState({ hasBoard, canEdit, onGenerate, onCreate, onAddCanvas }) {
  const { translate } = useDcsLanguage();
  return (
    <div className="dcs-board-chrome border-2 p-8 text-center">
      <p className="text-sm font-semibold mb-1" style={{ color: "var(--board-text, #333333)", fontFamily: "'Montserrat', sans-serif" }}>
        {translate(hasBoard ? "DCS_DB_EMPTY_TITLE" : "DCS_DB_NO_DASHBOARDS_TITLE")}
      </p>
      <p className="text-xs mb-4" style={{ color: "var(--board-muted, #9E9E9E)" }}>
        {translate(!canEdit ? "DCS_DB_EMPTY_HINT_VIEWER" : hasBoard ? "DCS_DB_EMPTY_HINT" : "DCS_DB_NO_DASHBOARDS_HINT")}
      </p>
      {canEdit && (
        <div className="w-full sm:w-72 mx-auto flex flex-col gap-2">
          <DcsButtonPrimary type="button" onClick={hasBoard ? onGenerate : onCreate}>
            {translate(hasBoard ? "DCS_DB_BTN_GENERATE" : "DCS_DB_CREATE_BTN")}
          </DcsButtonPrimary>
          {hasBoard && (
            <DcsButtonOutline type="button" onClick={onAddCanvas}>
              {translate("DCS_DB_CANVAS_ADD_EMPTY")}
            </DcsButtonOutline>
          )}
        </div>
      )}
    </div>
  );
}
