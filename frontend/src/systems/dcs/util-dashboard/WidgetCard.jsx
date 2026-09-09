import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import SpiralLoader from "../../event-managment/components/SpiralLoader.jsx";
import WidgetChart from "./WidgetChart.jsx";
import { chart_definition } from "./chartCatalog.js";

const PRIMARY = "#056daa";
const DANGER = "#E74C3C";

function StateMessage({ children, tone }) {
  return (
    <div className="flex items-center justify-center text-center text-xs px-4" style={{ height: 180, color: tone || "#9E9E9E" }}>
      {children}
    </div>
  );
}

/**
 * The frame of every dashboard widget: a title bar with the chart type as a
 * quiet subtitle, and the loading / error states around the chart itself.
 * The dashboard is generated automatically, so the card carries no editing
 * controls at all - it only ever displays.
 */
export default function WidgetCard({ widget, data, loading, onRetry }) {
  const { translate } = useDcsLanguage();
  const definition = chart_definition(widget.chart_type);

  return (
    <div className="bg-white border-2 flex flex-col h-full" style={{ borderColor: "#E0E0E0" }}>
      <div className="px-3 pt-3 pb-2">
        <p className="text-sm font-semibold truncate" style={{ color: "#333333", fontFamily: "'Montserrat', sans-serif" }} title={widget.title}>
          {widget.title}
        </p>
        <p className="text-xs truncate" style={{ color: "#9E9E9E" }}>
          {definition ? translate(definition.labelKey) : widget.chart_type}
        </p>
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
              <button
                type="button"
                className="text-xs font-semibold uppercase px-2 py-1"
                style={{ color: PRIMARY, border: `1px solid ${PRIMARY}`, fontFamily: "'Montserrat', sans-serif", cursor: "pointer", background: "#FFFFFF" }}
                onClick={onRetry}
              >
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
