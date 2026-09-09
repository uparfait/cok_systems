import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import SpiralLoader from "../../event-managment/components/SpiralLoader.jsx";
import WidgetChart from "./WidgetChart.jsx";
import { chart_definition } from "./chartCatalog.js";

const PRIMARY = "#056daa";
const DANGER = "#E74C3C";

const action_style = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.4px",
  padding: "0.2rem 0.45rem",
  border: "1px solid #E0E0E0",
  color: "#555555",
  backgroundColor: "#FFFFFF",
  cursor: "pointer",
};

function StateMessage({ children, tone }) {
  return (
    <div className="flex items-center justify-center text-center text-xs px-4" style={{ height: 180, color: tone || "#9E9E9E" }}>
      {children}
    </div>
  );
}

/**
 * The frame of every dashboard widget: title bar with the chart type as a
 * quiet subtitle, the edit-mode action row (move, resize, edit, remove) and
 * the loading / locked / error states around the chart itself.
 */
export default function WidgetCard({
  widget,
  data,
  loading,
  editMode,
  onMoveUp,
  onMoveDown,
  onResize,
  onEdit,
  onRemove,
  onRetry,
  canMoveUp,
  canMoveDown,
}) {
  const { translate } = useDcsLanguage();
  const definition = chart_definition(widget.chart_type);

  return (
    <div className="bg-white border-2 flex flex-col" style={{ borderColor: "#E0E0E0" }}>
      <div className="flex items-start justify-between gap-2 px-3 pt-3 pb-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }} title={widget.title}>
            {widget.title}
          </p>
          <p className="text-xs truncate" style={{ color: "#9E9E9E" }}>
            {definition ? translate(definition.labelKey) : widget.chart_type}
          </p>
        </div>
        {editMode && (
          <div className="flex items-center gap-1 flex-shrink-0 flex-wrap justify-end">
            <button type="button" style={{ ...action_style, opacity: canMoveUp ? 1 : 0.4 }} disabled={!canMoveUp} onClick={onMoveUp} title={translate("DCS_DB_MOVE_UP")}>
              {translate("DCS_DB_MOVE_UP")}
            </button>
            <button type="button" style={{ ...action_style, opacity: canMoveDown ? 1 : 0.4 }} disabled={!canMoveDown} onClick={onMoveDown} title={translate("DCS_DB_MOVE_DOWN")}>
              {translate("DCS_DB_MOVE_DOWN")}
            </button>
            <button type="button" style={action_style} onClick={onResize} title={translate("DCS_DB_RESIZE")}>
              {translate("DCS_DB_RESIZE")}
            </button>
            <button type="button" style={{ ...action_style, color: PRIMARY, borderColor: PRIMARY }} onClick={onEdit}>
              {translate("DCS_DB_EDIT")}
            </button>
            <button type="button" style={{ ...action_style, color: DANGER, borderColor: DANGER }} onClick={onRemove}>
              {translate("DCS_SETTINGS_REMOVE")}
            </button>
          </div>
        )}
      </div>

      <div className="px-2 pb-3 flex-1">
        {loading ? (
          <div className="flex items-center justify-center" style={{ height: 180 }}>
            <SpiralLoader />
          </div>
        ) : !data ? (
          <StateMessage>{translate("DCS_DB_NO_DATA")}</StateMessage>
        ) : data.locked ? (
          <StateMessage>{translate("DCS_DB_LOCKED")}</StateMessage>
        ) : data.error ? (
          <div className="flex flex-col items-center justify-center gap-2" style={{ height: 180 }}>
            <p className="text-xs text-center px-4" style={{ color: DANGER }}>
              {translate("DCS_DB_WIDGET_ERROR")}
            </p>
            {onRetry && (
              <button type="button" style={{ ...action_style, color: PRIMARY, borderColor: PRIMARY }} onClick={onRetry}>
                {translate("DCS_DB_RETRY")}
              </button>
            )}
          </div>
        ) : (
          <WidgetChart widget={widget} data={data} />
        )}
      </div>
    </div>
  );
}
