import React from "react";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { ChipGrid, TEXT_DARK, TEXT_MUTED, HEADING_FONT } from "./builderUi.jsx";
import { LengthField, LENGTH_LABELS } from "./BoxSettings.jsx";
import { SIZE_MODES, CANVAS_FLOWS, CANVAS_UNITS, FIXED_KEYS, canvas_size_mode, canvas_length_keys } from "../boxLayout.js";

/**
 * Everything a SECTION is, which is everything a section is allowed to be.
 *
 * A canvas holds widgets and draws no data, so it has nothing to say about
 * numbers, units or legends. What it has is two things: the way its
 * contents are ARRANGED - queued along rows, stacked down a column, or not
 * arranged at all and placed by dragging - and how big it IS. Where it
 * sits is not asked: it follows the board's order, and what is inside a
 * free one is put wherever it was dragged to.
 *
 * Its size is asked one of two ways and never both at once - pinned to a
 * width and a height, or held between a least and a most - because a fixed
 * width and a least-width in the same box is a question nobody can answer
 * by looking at it. Every length reads in pixels, in percent, or as
 * whatever room is left over; a percent at the top of the board is a
 * percent of the SCREEN, and inside another section it is a percent of
 * that section, which is what people mean when they type 100%.
 */
export default function CanvasSettings({ canvas, onChange }) {
  const { translate } = useDcsLanguage();
  const set = (changes) => onChange(Object.assign({}, canvas, changes));
  const heading = "text-xs font-bold uppercase mt-3 mb-1";
  return (
    <section>
      <p className="text-xs font-bold uppercase mb-2" style={{ color: TEXT_DARK, letterSpacing: "0.5px", ...HEADING_FONT }}>
        {translate("DCS_DB_CANVAS_LAYOUT")}
      </p>
      <p className="text-xs mb-2" style={{ color: TEXT_MUTED }}>{translate("DCS_DB_CANVAS_LAYOUT_HINT")}</p>
      <ChipGrid
        options={CANVAS_FLOWS.map((flow) => ({ id: flow, label: translate(`DCS_DB_CANVAS_FLOW_${flow.toUpperCase()}`) }))}
        value={CANVAS_FLOWS.includes(canvas.flow) ? canvas.flow : "row"}
        onChange={(flow) => set({ flow })}
        columns="grid-cols-3 sm:w-96"
      />
      <label className="flex items-center gap-2 mt-2">
        <span className="text-xs flex-1" style={{ color: TEXT_DARK, ...HEADING_FONT }}>{translate("DCS_DB_CANVAS_GAP")}</span>
        <input
          type="number"
          min="0"
          max="64"
          className="dcs-rename-input"
          style={{ width: 84 }}
          value={Number.isFinite(Number(canvas.gap)) ? canvas.gap : 12}
          onChange={(event) => set({ gap: Math.max(0, Math.min(64, Number(event.target.value) || 0)) })}
        />
      </label>

      <p className={heading} style={{ color: TEXT_DARK, letterSpacing: "0.5px", ...HEADING_FONT }}>
        {translate("DCS_DB_CANVAS_SIZE")}
      </p>
      <p className="text-xs mb-2" style={{ color: TEXT_MUTED }}>{translate("DCS_DB_CANVAS_SIZE_HINT")}</p>
      <ChipGrid
        options={SIZE_MODES.map((entry) => ({ id: entry, label: translate(`DCS_DB_CANVAS_SIZE_${entry.toUpperCase()}`) }))}
        value={canvas_size_mode(canvas)}
        onChange={(size_mode) => set({ size_mode })}
        columns="grid-cols-2 sm:w-72"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
        {canvas_length_keys(canvas).map((key) => (
          <LengthField
            key={key}
            labelKey={LENGTH_LABELS[key]}
            length={canvas[key] || null}
            // Only a width and a height can be told to take the rest; a
            // least or a most that means "the rest" says nothing.
            units={FIXED_KEYS.includes(key) ? CANVAS_UNITS : undefined}
            onChange={(length) => set({ [key]: length })}
          />
        ))}
      </div>
    </section>
  );
}
