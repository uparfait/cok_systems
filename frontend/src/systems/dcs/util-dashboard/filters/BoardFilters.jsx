import React from "react";
import FilterValueSelect from "./FilterValueSelect.jsx";
import FilterPicker from "./FilterPicker.jsx";
import { filter_candidates, filter_usage, field_label_of, toggle_filter_def } from "../boardFilters.js";

/**
 * The board's filter bar, next to the period filter: one select per saved
 * filter field (titled by the field, "All" by default) and, for editors,
 * the "Add filter" picker. Picking a value reshapes the whole board; adding
 * or removing a filter field is saved with the dashboard. On a locked
 * share link the fixed filters show their value and cannot be changed.
 */
export default function BoardFilters({ filters, fields, widgets, values, onValue, onChangeFilters, fetchValues, lockedIds, disabled }) {
  const defs = filters || [];
  const candidates = filter_candidates(fields);
  const usage = filter_usage(widgets);
  const locked = lockedIds || new Set();
  const can_edit = typeof onChangeFilters === "function";

  return (
    <>
      {defs.map((def) => {
        const field = candidates.find((entry) => entry.id === def.field_id);
        if (!field && !locked.has(def.field_id)) return null;
        return (
          <FilterValueSelect
            key={def.field_id}
            label={field ? field.label : field_label_of(fields, def.field_id)}
            value={values ? values[def.field_id] : ""}
            locked={locked.has(def.field_id)}
            disabled={disabled}
            onChange={(value) => onValue(def.field_id, value)}
            fetchValues={() => fetchValues(def.field_id)}
            onRemove={can_edit ? () => onChangeFilters(defs.filter((entry) => entry.field_id !== def.field_id)) : undefined}
          />
        );
      })}
      {can_edit && <FilterPicker candidates={candidates} usage={usage} defs={defs} disabled={disabled} onToggle={(field_id) => onChangeFilters(toggle_filter_def(defs, field_id))} />}
    </>
  );
}
