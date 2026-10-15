import React, { useEffect, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import DcsCenterOverlay from "../components/DcsCenterOverlay.jsx";
import DcsButtonPrimary from "../components/DcsButtonPrimary.jsx";
import SpiralLoader from "../../event-managment/components/SpiralLoader.jsx";
import { FONT_MIN, FONT_MAX, clean_font_size } from "./builder/textCompose.js";

const FONT = "'Montserrat', sans-serif";

/**
 * The sizes a TEXT block's words are drawn at, set from the card's own
 * menu: one for the heading and one for the body, in pixels. A box left
 * empty means automatic - the size the block picks for itself from what
 * the author asked (small, medium or large) and the room its card has.
 */
export default function TextSizesDialog({ widget, saving, onSave, onClose }) {
  const { translate } = useDcsLanguage();
  const text = (widget && widget.text) || {};
  const [heading, setHeading] = useState(text.heading_size ? String(text.heading_size) : "");
  const [body, setBody] = useState(text.body_size ? String(text.body_size) : "");

  useEffect(() => {
    const key = (event) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [saving, onClose]);

  const submit = (event) => {
    if (event) event.preventDefault();
    if (saving) return;
    onSave({ heading_size: clean_font_size(heading), body_size: clean_font_size(body) });
  };
  const settle = (value, set) => set(String(value).trim() === "" ? "" : String(clean_font_size(value) || ""));

  const field = (id, label_key, value, set) => (
    <div>
      <label className="cok-auth-label" htmlFor={id}>
        {translate(label_key)}
      </label>
      <input
        id={id}
        type="number"
        className="cok-auth-input"
        min={FONT_MIN}
        max={FONT_MAX}
        step={1}
        value={value}
        placeholder={translate("DCS_DB_TEXT_SIZE_AUTO")}
        disabled={saving}
        onChange={(event) => set(event.target.value)}
        onBlur={() => settle(value, set)}
      />
    </div>
  );

  return (
    <DcsCenterOverlay title={translate("DCS_DB_TEXT_SIZES")} onClose={onClose} onBackdrop={onClose} busy={saving} maxWidth={400}>
      <form onSubmit={submit} className="flex flex-col gap-3" aria-busy={!!saving} data-testid="dcs-text-sizes-dialog">
        <p className="text-sm" style={{ color: "#333333", fontFamily: FONT, margin: 0 }}>
          {translate("DCS_DB_TEXT_SIZES_HINT", { min: FONT_MIN, max: FONT_MAX })}
        </p>
        {field("dcs-text-heading-size", "DCS_DB_TEXT_HEADING_SIZE", heading, setHeading)}
        {field("dcs-text-body-size", "DCS_DB_TEXT_BODY_SIZE", body, setBody)}
        <div className="flex justify-end">
          <DcsButtonPrimary type="submit" disabled={saving} className="min-w-28">
            {saving ? <SpiralLoader padded={false} size={18} color="#FFFFFF" /> : translate("DCS_DB_TEXT_SIZES_SAVE")}
          </DcsButtonPrimary>
        </div>
      </form>
    </DcsCenterOverlay>
  );
}
