import React from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { TEXT_DARK, TEXT_MUTED, HEADING_FONT } from "./builderUi.jsx";

/**
 * What a widget is CALLED, set here rather than on the card.
 *
 * Naming used to happen by hovering the card and clicking its title, which
 * put an editable field in the middle of a board people mostly read: a
 * stray click renamed a chart, and nothing said the text was a control.
 * Both the name and the description now live in this dialog, with
 * everything else about how the widget looks, and the card only shows them.
 *
 * A widget must be named - a chart called nothing says nothing. A SECTION
 * need not be: it holds widgets rather than data, so a name is something
 * you add when the group deserves a heading, and an unnamed one simply
 * draws no title bar.
 */
export default function NameSettings({ title, description, optional, error, onChange }) {
  const { translate } = useDcsLanguage();
  return (
    <section>
      <p className="text-xs font-bold uppercase mb-1" style={{ color: TEXT_DARK, letterSpacing: "0.5px", ...HEADING_FONT }}>
        {translate("DCS_DB_NAME_TITLE")}
      </p>
      <p className="text-xs mb-2" style={{ color: TEXT_MUTED }}>
        {translate(optional ? "DCS_DB_NAME_HINT_OPTIONAL" : "DCS_DB_NAME_HINT")}
      </p>
      <input
        type="text"
        className="cok-auth-input text-sm"
        maxLength={120}
        value={title}
        placeholder={translate(optional ? "DCS_DB_CANVAS_TITLE_OPTIONAL" : "DCS_DB_NAME_PLACEHOLDER")}
        aria-label={translate("DCS_DB_NAME_TITLE")}
        onChange={(event) => onChange({ title: event.target.value })}
      />
      {error && (
        <p className="text-xs mt-1" style={{ color: "#E74C3C", ...HEADING_FONT }}>
          {translate("DCS_DB_NAME_REQUIRED")}
        </p>
      )}
      <textarea
        rows={2}
        className="cok-auth-input text-sm mt-2"
        style={{ resize: "vertical" }}
        maxLength={300}
        value={description}
        placeholder={translate("DCS_DB_ADD_DESCRIPTION")}
        aria-label={translate("DCS_DB_ADD_DESCRIPTION")}
        onChange={(event) => onChange({ description: event.target.value })}
      />
    </section>
  );
}
