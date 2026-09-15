import React from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import SpiralLoader from "../../../event-managment/components/SpiralLoader.jsx";
import { PRIMARY, TEXT_MUTED } from "./builderUi.jsx";

const VALUE_PREVIEW = 6;

/** The live readout under an "in each" pick: loading, or "n values found" with the first few. */
export default function InEachValues({ field, values }) {
  const { translate } = useDcsLanguage();
  if (!field) return null;
  return (
    <div className="dcs-view-swap flex items-center gap-2 flex-wrap mt-1">
      {values.loading ? (
        <>
          <SpiralLoader padded={false} size={16} />
          <span className="text-xs" style={{ color: TEXT_MUTED }}>{translate("DCS_DB_IN_EACH_LOADING")}</span>
        </>
      ) : (
        <>
          <span className="text-xs font-semibold" style={{ color: PRIMARY }}>
            {translate("DCS_DB_IN_EACH_VALUES", { count: values.list.length })}
          </span>
          {values.list.slice(0, VALUE_PREVIEW).map((value) => (
            <span key={String(value)} className="dcs-draft-in text-[11px] px-2 py-0.5" style={{ backgroundColor: "#EAF3F8", color: PRIMARY }}>
              {String(value)}
            </span>
          ))}
          {values.list.length > VALUE_PREVIEW && (
            <span className="text-[11px]" style={{ color: TEXT_MUTED }}>+{values.list.length - VALUE_PREVIEW}</span>
          )}
        </>
      )}
    </div>
  );
}
