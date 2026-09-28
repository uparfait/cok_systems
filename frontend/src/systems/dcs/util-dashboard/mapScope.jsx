import React, { createContext, useContext } from "react";
import { parent_filter_of } from "./boardFilters.js";
import { map_key } from "./charts/mapGeometry.js";

const MapScopeContext = createContext({ fetch_shapes: null, scope_key: "" });

/**
 * How a map widget asks for its boundaries. The board knows whether it is
 * the signed-in page or a shared link, and which places it is filtered to;
 * the widget only hands over the place names it has data for and gets the
 * outlines to draw. No level is ever named - the server works that out from
 * the names and the filters. scopeKey changes whenever those filters do, so
 * a widget knows to ask again. Without a provider a map says it cannot
 * load.
 */
export function MapScopeProvider({ fetchShapes, scopeKey, children }) {
  return <MapScopeContext.Provider value={{ fetch_shapes: fetchShapes, scope_key: scopeKey || "" }}>{children}</MapScopeContext.Provider>;
}

/**
 * The places a board is filtered to, as plain names. Whatever else the
 * filters hold (a status, a date) is sent along too and dropped by the
 * server, which knows which of them name a place.
 *
 * One name from two fields is one place said twice and travels once -
 * unless the fields are steps of one cascade, where a cell called like its
 * sector is two places, and the server must be told both.
 */
export function filter_names(values, fields) {
  const entries = Object.entries(values || {}).flatMap(([field_id, value]) =>
    (Array.isArray(value) ? value : [value])
      .filter((entry) => typeof entry === "string" && entry.trim())
      .map((entry) => ({ field_id, name: entry.trim() })),
  );
  const by_id = new Map((fields || []).map((field) => [field.id, field]));
  const above = (field_id) => {
    const out = new Set();
    let field = by_id.get(field_id);
    while (field && out.size < 10) {
      const parent = parent_filter_of(field);
      if (!parent || out.has(parent)) break;
      out.add(parent);
      field = by_id.get(parent);
    }
    return out;
  };
  const related = (a, b) => a !== b && (above(a).has(b) || above(b).has(a));
  const kept = [];
  entries.forEach((entry) => {
    const twins = kept.filter((other) => map_key(other.name) === map_key(entry.name));
    if (twins.length === 0 || twins.every((other) => related(other.field_id, entry.field_id))) kept.push(entry);
  });
  return kept.map((entry) => entry.name);
}

export const useMapScope = () => useContext(MapScopeContext);
