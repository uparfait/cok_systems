import React, { useMemo, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { DCS_FIELD_TYPE_REGISTRY } from "../fields/fieldTypes.js";
import { conversion_targets, find_conversion_blockers, convert_field_type } from "./fieldConversion.js";
import { resolve_track_vars } from "./editDiffMessage.js";
import DcsButtonOutline from "../components/DcsButtonOutline.jsx";
import DcsConfirmDialog from "../components/DcsConfirmDialog.jsx";

const PRIMARY = "#056daa";
const WARNING = "#F39C12";
const WARNING_TEXT = "#B9770E";
const MUTED = "#9E9E9E";
const HEADING_FONT = { fontFamily: "'Montserrat', sans-serif" };

function type_label(field_type, translate) {
  const entry = DCS_FIELD_TYPE_REGISTRY.find((candidate) => candidate.type === field_type);
  return entry ? translate(entry.labelKey) : field_type;
}

/**
 * Turns this field into a compatible type: a number into text and back, a
 * radio-row select into a dropdown and back. Offered only for those pairs,
 * since they are the ones that hold the same answer either way.
 *
 * A conversion is refused - never silently forced through - while any
 * setting exists that the new type has no meaning for, because dropping an
 * author's rule on their behalf is worse than making them delete it. Each
 * one is listed in orange, saying where to go and remove it: on this field
 * under Validation, or on the other field that reads this one numerically.
 */
export default function FieldTypeConvertSection({ field, allFields, onConvert }) {
  const { translate, language } = useDcsLanguage();
  const [target_type, setTargetType] = useState("");
  const [is_confirming, setIsConfirming] = useState(false);

  const targets = conversion_targets(field.type);
  const chosen_type = target_type || targets[0] || "";

  const blockers = useMemo(
    () => (chosen_type ? find_conversion_blockers(field, chosen_type, allFields, language) : []),
    [field, chosen_type, allFields, language],
  );

  if (targets.length === 0) return null;

  const is_blocked = blockers.length > 0;

  return (
    <div className="p-3" style={{ border: `1px dashed ${PRIMARY}`, backgroundColor: "rgba(5,109,170,0.04)" }}>
      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: PRIMARY, ...HEADING_FONT }}>
        {translate("DCS_CONVERT_TITLE")}
      </p>
      <p className="text-xs mt-1" style={{ color: MUTED, ...HEADING_FONT }}>
        {translate("DCS_CONVERT_HINT", { current: type_label(field.type, translate) })}
      </p>

      <div className="flex flex-col sm:flex-row gap-2 mt-2">
        {targets.length > 1 ? (
          <select
            className="cok-auth-input w-full sm:flex-1 py-2"
            value={chosen_type}
            onChange={(event) => setTargetType(event.target.value)}
          >
            {targets.map((candidate) => (
              <option key={candidate} value={candidate}>
                {type_label(candidate, translate)}
              </option>
            ))}
          </select>
        ) : null}
        <div className="w-full sm:w-56">
          <DcsButtonOutline type="button" disabled={is_blocked} onClick={() => setIsConfirming(true)}>
            {translate("DCS_CONVERT_TO", { type: type_label(chosen_type, translate) })}
          </DcsButtonOutline>
        </div>
      </div>

      {is_blocked && (
        <div className="mt-3 p-3" style={{ border: `1px solid ${WARNING}`, backgroundColor: "rgba(243,156,18,0.12)" }}>
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: WARNING_TEXT, ...HEADING_FONT }}>
            {translate("DCS_CONVERT_BLOCKED_TITLE")}
          </p>
          <p className="text-xs mt-1" style={{ color: WARNING_TEXT, ...HEADING_FONT }}>
            {translate("DCS_CONVERT_BLOCKED_HINT", { type: type_label(chosen_type, translate) })}
          </p>
          <ul className="mt-2 space-y-1.5">
            {blockers.map((blocker, index) => (
              <li
                key={`${blocker.kind}_${index}`}
                className="text-xs pl-2"
                style={{ color: WARNING_TEXT, borderLeft: `3px solid ${WARNING}`, ...HEADING_FONT }}
              >
                {translate(blocker.message_key, resolve_track_vars(blocker.message_vars, translate, language))}
              </li>
            ))}
          </ul>
        </div>
      )}

      {is_confirming && (
        <DcsConfirmDialog
          titleKey="DCS_CONVERT_CONFIRM_TITLE"
          messageKey="DCS_CONVERT_CONFIRM_MESSAGE"
          onCancel={() => setIsConfirming(false)}
          onConfirm={() => {
            setIsConfirming(false);
            onConvert(convert_field_type(field, chosen_type), chosen_type);
          }}
        />
      )}
    </div>
  );
}
