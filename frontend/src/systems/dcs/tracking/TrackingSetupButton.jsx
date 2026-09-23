import React, { useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { is_tracking_enabled, field_name } from "./trackingConfig.js";
import { flatten_fields } from "../jsonlogic/dependencyGraph.js";
import { KeyIcon } from "./TrackingIcons.jsx";
import TrackingSetupOverlay from "./TrackingSetupOverlay.jsx";

const PRIMARY = "#056daa";
const MUTED = "#9E9E9E";
const FONT = "'Montserrat', sans-serif";

/**
 * The "key index" control at the top of the form builder: a key icon that
 * opens the record tracking setup. Once tracking is on, the row says which
 * field is the key and how many fields may be updated, so an author sees
 * the form's tracking state without opening anything.
 */
export default function TrackingSetupButton({ fields, tracking, onChange, disabled }) {
  const { translate, language } = useDcsLanguage();
  const [open, setOpen] = useState(false);
  const enabled = is_tracking_enabled(tracking);
  const key_field = enabled ? flatten_fields(fields || []).find((field) => field.id === tracking.key_field_id) : null;
  const count = enabled ? (tracking.editable_field_ids || []).length : 0;

  return (
    <>
      <div className="dcs-tracking-bar">
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={disabled}
          className="dcs-tracking-key-button"
          title={translate("DCS_TRACKING_BUTTON_TITLE")}
          aria-label={translate("DCS_TRACKING_BUTTON_TITLE")}
          style={{ backgroundColor: enabled ? PRIMARY : "#FFFFFF", color: enabled ? "#FFFFFF" : PRIMARY }}
        >
          <KeyIcon size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase truncate" style={{ color: enabled ? PRIMARY : MUTED, fontFamily: FONT, letterSpacing: 0.5 }}>
            {translate("DCS_TRACKING_TITLE")}
          </p>
          <p className="text-xs truncate" style={{ color: MUTED, fontFamily: FONT }}>
            {enabled
              ? translate("DCS_TRACKING_SUMMARY", { key: field_name(key_field, language), count })
              : translate("DCS_TRACKING_OFF_HINT")}
          </p>
        </div>
      </div>

      {open && (
        <TrackingSetupOverlay
          fields={fields}
          tracking={tracking}
          onSave={(next) => {
            onChange(next);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
