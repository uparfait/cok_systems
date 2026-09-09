import React, { useEffect, useRef, useState } from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import DcsSearchableSelect from "../../components/DcsSearchableSelect.jsx";
import SpiralLoader from "../../../event-managment/components/SpiralLoader.jsx";
import { get_dashboard_data } from "../dashboardService.js";
import WidgetChart from "../WidgetChart.jsx";
import { SIZE_OPTIONS } from "../chartCatalog.js";

/**
 * The wizard's last step: name the widget, pick its size on the grid, and
 * see a LIVE preview computed by the same endpoint the dashboard itself
 * uses - what is previewed here is exactly what will render after saving.
 */
export default function StepFinish({ projectId, widget, onChange }) {
  const { translate } = useDcsLanguage();
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const run_seq_ref = useRef(0);

  useEffect(() => {
    const run_id = run_seq_ref.current + 1;
    run_seq_ref.current = run_id;
    setLoading(true);
    setFailed(false);
    const timer = setTimeout(() => {
      get_dashboard_data(projectId, [widget], null)
        .then((response) => {
          if (run_seq_ref.current !== run_id) return;
          const result = ((response.data && response.data.results) || [])[0] || null;
          setPreview(result);
          setFailed(!result || !!result.error || !!result.locked);
        })
        .catch(() => {
          if (run_seq_ref.current !== run_id) return;
          setFailed(true);
        })
        .finally(() => {
          if (run_seq_ref.current === run_id) setLoading(false);
        });
    }, 350);
    return () => clearTimeout(timer);
    // The preview follows every meaningful change of the draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, JSON.stringify({ ...widget, title: "", size: "" })]);

  const size_options = SIZE_OPTIONS.map((option) => ({ id: option.id, name: translate(option.labelKey) }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="cok-auth-label">{translate("DCS_DB_WIDGET_TITLE")}</label>
          <input
            className="cok-auth-input w-full py-3"
            placeholder={translate("DCS_DB_WIDGET_TITLE_PLACEHOLDER")}
            value={widget.title}
            onChange={(event) => onChange({ title: event.target.value })}
            maxLength={120}
          />
        </div>
        <div>
          <label className="cok-auth-label">{translate("DCS_DB_SIZE")}</label>
          <DcsSearchableSelect options={size_options} value={widget.size} onChange={(size) => onChange({ size })} placeholder={translate("DCS_DB_SIZE")} />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase mb-2" style={{ color: "#9E9E9E", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.5px" }}>
          {translate("DCS_DB_PREVIEW")}
        </p>
        <div className="border-2 p-3" style={{ borderColor: "#E0E0E0", minHeight: 220 }}>
          {loading ? (
            <div className="flex items-center justify-center" style={{ height: 200 }}>
              <SpiralLoader />
            </div>
          ) : failed ? (
            <p className="text-xs text-center py-16" style={{ color: "#E74C3C" }}>
              {translate("DCS_DB_PREVIEW_FAILED")}
            </p>
          ) : (
            <WidgetChart widget={widget} data={preview} />
          )}
        </div>
        <p className="text-xs mt-2" style={{ color: "#9E9E9E" }}>
          {translate("DCS_DB_PREVIEW_HINT")}
        </p>
      </div>
    </div>
  );
}
