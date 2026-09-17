import React, { useEffect, useRef, useState } from "react";

const GRIP = (
  <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor" aria-hidden="true">
    <circle cx="2" cy="2" r="1.4" />
    <circle cx="6" cy="2" r="1.4" />
    <circle cx="2" cy="7" r="1.4" />
    <circle cx="6" cy="7" r="1.4" />
    <circle cx="2" cy="12" r="1.4" />
    <circle cx="6" cy="12" r="1.4" />
  </svg>
);
import FilterValueSelect from "./FilterValueSelect.jsx";
import { useDcsLanguage } from "../../i18n/LanguageContext.jsx";
import { filter_candidates, field_label_of, parent_filter_of, descendant_filters } from "../boardFilters.js";

/**
 * The board's filter bar, next to the period filter: one select per filter
 * field the dashboard was given in the builder (titled by the field, "All"
 * by default). Picking a value reshapes the whole board. On a locked share
 * link the fixed filters show their value and cannot be changed.
 *
 * Every filter's values are loaded as soon as the bar mounts and again,
 * whenever the period or another filter changes (refreshKey) or a filter is
 * opened. A plain filter keeps what it lists while the fresh list arrives,
 * so opening one never waits - but A CASCADE CHILD DROPS ITS LIST THE
 * MOMENT ANYTHING CHANGES: the sectors it was showing belong to the
 * district that was chosen before, and nobody may pick one of those by
 * mistake. Until its own list lands it says it is loading and offers
 * nothing.
 *
 * Cascades are tracked: a child filter (sector) stays closed until its
 * parent filter (district) holds a value, and changing or clearing the
 * parent clears every filter below it.
 *
 * Editors reorder the filters by dragging a filter's grip onto another;
 * the new order is saved with the dashboard (onReorder).
 */
export default function BoardFilters({ filters, fields, values, onValue, onValues, fetchValues, lockedIds, disabled, refreshKey, onReorder }) {
  const [dragging, setDragging] = useState(null);
  const [over, setOver] = useState(null);
  const drop_on = (target_id) => {
    if (!onReorder || !dragging || dragging === target_id) return;
    const order = defs.map((def) => def.field_id);
    const from = order.indexOf(dragging);
    const to = order.indexOf(target_id);
    if (from < 0 || to < 0) return;
    order.splice(to, 0, order.splice(from, 1)[0]);
    onReorder(order.map((field_id) => defs.find((def) => def.field_id === field_id)));
  };
  const { translate } = useDcsLanguage();
  const defs = filters || [];
  const def_ids = new Set(defs.map((def) => def.field_id));
  const has = (field_id) => values && values[field_id] !== undefined && values[field_id] !== "" && values[field_id] !== null;
  const apply = (field_id, value) => {
    const patch = { [field_id]: value };
    descendant_filters(defs, fields, field_id).forEach((child) => {
      patch[child] = "";
    });
    if (onValues) onValues(patch);
    else Object.entries(patch).forEach(([id, next]) => onValue(id, next));
  };
  const candidates = filter_candidates(fields);
  const locked = lockedIds || new Set();
  const [cache, setCache] = useState({});
  const [busy, setBusy] = useState({});
  const alive_ref = useRef(true);
  const defs_key = defs.map((def) => def.field_id).join("|");
  // The parent value each child's list was loaded under.
  const loaded_under = useRef({});

  const refresh = (field_id) => {
    setBusy((current) => ({ ...current, [field_id]: true }));
    return Promise.resolve(fetchValues(field_id))
      .then((list) => alive_ref.current && setCache((current) => ({ ...current, [field_id]: Array.isArray(list) ? list : [] })))
      .catch(() => alive_ref.current && setCache((current) => (current[field_id] ? current : { ...current, [field_id]: [] })))
      .finally(() => alive_ref.current && setBusy((current) => ({ ...current, [field_id]: false })));
  };

  useEffect(() => {
    alive_ref.current = true;
    // A child's list belongs to the parent value it was loaded under: when
    // THAT changes the list goes, so nobody can pick from the old one. Any
    // other change (the period, a sibling, its own value) leaves the list on
    // screen and refreshes it quietly underneath.
    setCache((current) => {
      const next = { ...current };
      defs.forEach((def) => {
        const parent = parent_filter_of(candidates.find((entry) => entry.id === def.field_id));
        if (!parent || !def_ids.has(parent)) return;
        const under = values && values[parent] !== undefined && values[parent] !== null ? String(values[parent]) : "";
        if (loaded_under.current[def.field_id] !== under) {
          delete next[def.field_id];
          loaded_under.current[def.field_id] = under;
        }
      });
      return next;
    });
    defs.forEach((def) => refresh(def.field_id));
    return () => {
      alive_ref.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defs_key, refreshKey]);

  return (
    <>
      {defs.map((def) => {
        const field = candidates.find((entry) => entry.id === def.field_id);
        if (!field && !locked.has(def.field_id)) return null;
        // A child of another filter waits for that parent to be picked.
        const parent = parent_filter_of(field);
        const waits_for = parent && def_ids.has(parent) && !has(parent) && !locked.has(parent) ? field_label_of(fields, parent) : "";
        return (
          <div
            key={def.field_id}
            className={`dcs-board-filter-slot ${dragging === def.field_id ? "is-dragging" : ""} ${over === def.field_id && dragging && dragging !== def.field_id ? "is-drop-target" : ""}`}
            onDragOver={onReorder ? (event) => { event.preventDefault(); if (over !== def.field_id) setOver(def.field_id); } : undefined}
            onDragLeave={onReorder ? () => setOver((current) => (current === def.field_id ? null : current)) : undefined}
            onDrop={onReorder ? (event) => { event.preventDefault(); drop_on(def.field_id); setDragging(null); setOver(null); } : undefined}
          >
            {onReorder && (
              <span
                className="dcs-board-filter-grip"
                draggable
                title={translate("DCS_DB_FILTER_DRAG")}
                onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", def.field_id); setDragging(def.field_id); }}
                onDragEnd={() => { setDragging(null); setOver(null); }}
              >
                {GRIP}
              </span>
            )}
          <FilterValueSelect
            label={field ? field.label : field_label_of(fields, def.field_id)}
            value={values ? values[def.field_id] : ""}
            locked={locked.has(def.field_id)}
            disabled={disabled || !!waits_for}
            waitHint={waits_for ? translate("DCS_DB_FILTER_PICK_PARENT", { parent: waits_for }) : ""}
            values={cache[def.field_id]}
            loading={!!busy[def.field_id]}
            onOpen={() => refresh(def.field_id)}
            onChange={(value) => apply(def.field_id, value)}
          />
          </div>
        );
      })}
      {defs.some((def) => has(def.field_id) && !locked.has(def.field_id)) && (
        <button
          type="button"
          className="dcs-board-filter-clear dcs-link-action"
          disabled={disabled}
          onClick={() => {
            // Every filter the viewer may change goes back to "All"; the period stays.
            const patch = {};
            defs.forEach((def) => {
              if (!locked.has(def.field_id)) patch[def.field_id] = "";
            });
            if (onValues) onValues(patch);
            else Object.keys(patch).forEach((id) => onValue(id, ""));
          }}
        >
          {translate("DCS_DB_FILTER_CLEAR")}
        </button>
      )}
    </>
  );
}
