import React from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";

/**
 * The gap between two fields, made clickable: hovering it turns the empty
 * space into a line with a "+" that adds a field at exactly that point.
 * One of these sits above every field and after the last one, so "add
 * above" and "add below" are the same affordance seen from either side -
 * there is no separate control for each direction, and no need to add at
 * the end and then drag the new field up to where it was wanted.
 *
 * Collapsed to a few pixels until hovered so a form of twenty questions
 * does not become a form of twenty questions and twenty-one buttons.
 */
export default function FieldInsertZone({ onInsert, label }) {
  const { translate } = useDcsLanguage();
  return (
    <div className="dcs-insert-zone" role="presentation">
      <button
        type="button"
        className="dcs-insert-zone-trigger"
        title={label || translate("DCS_INSERT_HERE")}
        aria-label={label || translate("DCS_INSERT_HERE")}
        onClick={onInsert}
      >
        <span className="dcs-insert-zone-line" />
        <span className="dcs-insert-zone-plus">+</span>
        <span className="dcs-insert-zone-line" />
      </button>
    </div>
  );
}
