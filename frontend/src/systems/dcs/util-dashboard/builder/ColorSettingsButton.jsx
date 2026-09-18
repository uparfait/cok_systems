import React, { useState } from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { useToast } from "../../../../core/contexts/ToastContext.tsx";
import DcsButtonOutline from "../../components/DcsButtonOutline.jsx";
import AppearanceDialog from "./AppearanceDialog.jsx";
import { has_custom_appearance } from "../appearance.js";
import { PRIMARY, TEXT_MUTED, HEADING_FONT } from "./builderUi.jsx";

/**
 * The composers' "Color settings" control: opens the appearance dialog for
 * the widget being composed and shows a small tag once custom colors or a
 * dark mode were chosen. The chosen appearance travels on the spec and is
 * copied onto every widget the composition produces.
 */
export default function ColorSettingsButton({ form, title, valuesField, appearance, onChange, disabled }) {
  const { translate } = useDcsLanguage();
  const { showSuccess } = useToast();
  const [open, setOpen] = useState(false);
  const customized = has_custom_appearance(appearance);

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <DcsButtonOutline className="sm:w-44" disabled={disabled} onClick={() => setOpen(true)}>
        {translate("DCS_DB_COLOR_SETTINGS")}
      </DcsButtonOutline>
      {customized && (
        <span className="text-[10px] font-bold uppercase px-2 py-1" style={{ backgroundColor: "#EAF3F8", color: PRIMARY, letterSpacing: "0.4px", ...HEADING_FONT }}>
          {translate("DCS_DB_COLOR_SET_TAG")}
        </span>
      )}
      {!customized && (
        <span className="text-xs" style={{ color: TEXT_MUTED }}>
          {translate("DCS_DB_COLOR_DEFAULT_HINT")}
        </span>
      )}
      {open && (
        <AppearanceDialog
          form={form}
          title={title || translate("DCS_DB_COLOR_SETTINGS")}
          // The widget being composed is named on the form behind this
          // dialog, so here it is the appearance and nothing else.
          naming={false}
          valuesField={valuesField}
          appearance={appearance}
          onClose={() => setOpen(false)}
          onApply={(result) => {
            onChange(result.appearance);
            setOpen(false);
            showSuccess(translate("DCS_DB_COLOR_APPLIED"));
          }}
        />
      )}
    </div>
  );
}
