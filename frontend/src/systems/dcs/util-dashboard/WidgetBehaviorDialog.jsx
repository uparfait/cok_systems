import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { IconButton, CLOSE_SVG } from "./BoardIcons.jsx";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import SpiralLoader from "../../event-managment/components/SpiralLoader.jsx";
import { PRIMARY, BORDER, TEXT_DARK, HEADING_FONT } from "./builder/builderUi.jsx";
import PeriodSettings from "./builder/PeriodSettings.jsx";
import PinnedFieldsSettings from "./builder/PinnedFieldsSettings.jsx";
import { period_of, pinned_of, period_document, period_problem } from "./builder/widgetBehavior.js";
import { portal_root } from "./portalRoot.js";

/**
 * "Date & filters" of one widget already on the board: the time window it
 * reads and whether it is locked to it, and the board filters it ignores.
 * Reached from the card's menu and from its right-click menu, so a card
 * can be pinned or fixed without rebuilding it. Like the colour settings,
 * the dialog stays up while the change saves, shows what came back, and
 * closes itself once a success has been read.
 */
export default function WidgetBehaviorDialog({ widget, fields, filterDefs, onApply, onClose }) {
  const { translate } = useDcsLanguage();
  const [period, setPeriod] = useState(() => period_of(widget));
  const [pinned, setPinned] = useState(() => pinned_of(widget));
  const [applying, setApplying] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const close_timer = useRef(null);
  useEffect(() => () => window.clearTimeout(close_timer.current), []);

  const problem = period_problem(period, translate);
  const apply = async () => {
    if (applying || problem) return;
    setApplying(true);
    setOutcome(null);
    let result;
    try {
      result = await onApply({ period: period_document(period), pinned_fields: pinned });
    } catch (error) {
      result = { ok: false, message: (error && error.message) || translate("DCS_ERROR_GENERIC") };
    } finally {
      setApplying(false);
    }
    if (!result || typeof result !== "object") return;
    setOutcome({ error: result.ok === false, text: result.message || "" });
    if (result.ok !== false) close_timer.current = window.setTimeout(onClose, 1400);
  };

  const heading = (key) => (
    <p className="text-xs font-bold uppercase mb-2" style={{ color: TEXT_DARK, letterSpacing: "0.5px", ...HEADING_FONT }}>
      {translate(key)}
    </p>
  );

  return createPortal(
    <div className="fixed inset-0 z-[10020] flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-black/45" onClick={applying ? undefined : onClose} />
      <div className="dcs-builder-pop relative bg-white border-2 w-full flex flex-col" style={{ maxWidth: 680, maxHeight: "92vh", borderColor: PRIMARY }}>
        <div className="flex items-center justify-between gap-2 flex-shrink-0 px-4 sm:px-5 py-2" style={{ backgroundColor: PRIMARY }}>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase leading-tight truncate" style={{ color: "#FFFFFF", letterSpacing: "0.3px", ...HEADING_FONT }}>
              {translate("DCS_DB_BEHAVIOR_TITLE")}
            </p>
            <p className="text-[11px] font-semibold truncate" style={{ color: "rgba(255,255,255,0.85)", ...HEADING_FONT }}>
              {widget.title || ""}
            </p>
          </div>
          <IconButton title={translate("DCS_BTN_CLOSE")} onClick={onClose} onDark danger disabled={applying}>
            {CLOSE_SVG}
          </IconButton>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-4 flex flex-col gap-5">
          <section>
            {heading("DCS_DB_PERIOD_TITLE")}
            <PeriodSettings period={period} onChange={setPeriod} disabled={applying} />
          </section>
          <section>
            {heading("DCS_DB_PINNED_TITLE")}
            <PinnedFieldsSettings fields={fields} filterDefs={filterDefs} value={pinned} onChange={setPinned} disabled={applying} />
          </section>
        </div>

        <div className="flex-shrink-0 px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2" style={{ borderTop: `1px solid ${BORDER}` }}>
          {outcome && outcome.error && (
            <p className="text-xs font-semibold sm:flex-1" role="alert" style={{ color: "#E74C3C", ...HEADING_FONT }}>
              {outcome.text}
            </p>
          )}
          {applying ? (
            <div className="flex items-center gap-2 sm:w-80 justify-end">
              <SpiralLoader padded={false} size={20} />
              <span className="text-xs font-semibold" style={{ color: PRIMARY, ...HEADING_FONT }}>{translate("DCS_DB_ICON_APPLYING")}</span>
            </div>
          ) : outcome && !outcome.error ? (
            <p className="text-xs font-semibold sm:w-80 text-right" role="status" style={{ color: "#1E8E3E", ...HEADING_FONT }}>
              {outcome.text}
            </p>
          ) : (
            <>
              <DcsButtonOutline className="sm:w-32" onClick={onClose}>
                {translate("DCS_DB_BUILDER_CANCEL")}
              </DcsButtonOutline>
              <DcsButtonPrimary className="sm:w-44" disabled={!!problem} onClick={apply}>
                {translate("DCS_DB_COLOR_APPLY")}
              </DcsButtonPrimary>
            </>
          )}
        </div>
      </div>
    </div>,
    portal_root(),
  );
}
