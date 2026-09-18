import React from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { ChipGrid, BORDER, TEXT_DARK, TEXT_MUTED, HEADING_FONT } from "./builderUi.jsx";
import { FLOWS, UNITS, LENGTH_KEYS } from "../boxLayout.js";

/**
 * The size and place of one widget INSIDE a canvas.
 *
 * Every length here is optional, and that is the point: a widget with no
 * width takes whatever is left of its row, one with no height grows to
 * what it holds. Set only what you care about and let the rest follow -
 * a least-width is usually worth setting, because it is what makes two
 * widgets stack on a phone instead of crushing side by side.
 *
 * Dragging a widget's edge in the canvas writes the same two values, so
 * this form and the handles are two ways to say one thing.
 */

const LABELS = {
  width: "DCS_DB_BOX_WIDTH",
  height: "DCS_DB_BOX_HEIGHT",
  min_width: "DCS_DB_BOX_MIN_WIDTH",
  max_width: "DCS_DB_BOX_MAX_WIDTH",
  min_height: "DCS_DB_BOX_MIN_HEIGHT",
  max_height: "DCS_DB_BOX_MAX_HEIGHT",
};

function LengthField({ labelKey, length, onChange }) {
  const { translate } = useDcsLanguage();
  const value = length && Number(length.value) > 0 ? String(length.value) : "";
  const unit = (length && length.unit) || "%";
  return (
    <label className="flex items-center gap-2 min-w-0">
      <span className="text-xs flex-1 min-w-0 truncate" style={{ color: TEXT_DARK, ...HEADING_FONT }}>
        {translate(labelKey)}
      </span>
      <input
        type="number"
        min="0"
        step="1"
        className="dcs-rename-input"
        style={{ width: 84 }}
        value={value}
        placeholder={translate("DCS_DB_BOX_AUTO")}
        onChange={(event) => {
          const next = Number(event.target.value);
          onChange(Number.isFinite(next) && next > 0 ? { value: next, unit } : null);
        }}
      />
      <select
        className="dcs-over-time-select"
        style={{ width: 64 }}
        value={unit}
        aria-label={translate(labelKey)}
        disabled={!length}
        onChange={(event) => onChange({ value: Number(length.value), unit: event.target.value })}
      >
        {UNITS.map((entry) => (
          <option key={entry} value={entry}>
            {entry}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function BoxSettings({ box, onChange }) {
  const { translate } = useDcsLanguage();
  const current = box || { flow: "row" };
  const set = (changes) => onChange(Object.assign({}, current, changes));
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs" style={{ color: TEXT_MUTED }}>{translate("DCS_DB_BOX_HINT")}</p>
      <ChipGrid
        options={FLOWS.map((flow) => ({ id: flow, label: translate(`DCS_DB_BOX_FLOW_${flow.toUpperCase()}`) }))}
        value={current.flow || "row"}
        onChange={(flow) => set({ flow })}
        columns="grid-cols-1 sm:grid-cols-3"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1" style={{ borderTop: `1px solid ${BORDER}` }}>
        {LENGTH_KEYS.map((key) => (
          <LengthField
            key={key}
            labelKey={LABELS[key]}
            length={current[key] || null}
            onChange={(length) => {
              const next = Object.assign({}, current);
              if (length) next[key] = length;
              else delete next[key];
              onChange(next);
            }}
          />
        ))}
      </div>
    </div>
  );
}
