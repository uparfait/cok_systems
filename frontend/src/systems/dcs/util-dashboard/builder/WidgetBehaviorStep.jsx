import React from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { Step, TEXT_DARK, HEADING_FONT } from "./builderUi.jsx";
import PeriodSettings from "./PeriodSettings.jsx";
import PinnedFieldsSettings from "./PinnedFieldsSettings.jsx";
import { default_period } from "./widgetBehavior.js";

/**
 * The composer step every data widget shares: the window it reads (and
 * whether it is locked to it) and the board filters it ignores. The spec
 * carries `period` and `pinned_fields`; with_behavior writes them onto
 * the drafts when the widget is built.
 */
export default function WidgetBehaviorStep({ number, spec, onPatch, fields, filterDefs, disabled }) {
  const { translate } = useDcsLanguage();
  const heading = (key) => (
    <p className="text-xs font-bold uppercase mb-1" style={{ color: TEXT_DARK, letterSpacing: "0.5px", ...HEADING_FONT }}>
      {translate(key)}
    </p>
  );
  return (
    <Step number={number} titleKey="DCS_DB_STEP_BEHAVIOR" hintKey="DCS_DB_BEHAVIOR_HINT">
      <div className="flex flex-col gap-4">
        <section>
          {heading("DCS_DB_PERIOD_TITLE")}
          <PeriodSettings period={spec.period || default_period()} onChange={(period) => onPatch({ period })} disabled={disabled} />
        </section>
        <section>
          {heading("DCS_DB_PINNED_TITLE")}
          <PinnedFieldsSettings fields={fields} filterDefs={filterDefs} value={spec.pinned_fields || []} onChange={(pinned_fields) => onPatch({ pinned_fields })} disabled={disabled} />
        </section>
      </div>
    </Step>
  );
}
