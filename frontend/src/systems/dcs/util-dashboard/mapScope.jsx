import React, { createContext, useContext } from "react";

const MapScopeContext = createContext({ fetch_shapes: null, scope_key: "" });

/**
 * How a map widget asks for its boundaries. The board knows whether it is
 * the signed-in page or a shared link, and which places it is filtered to;
 * the widget only hands over the place names it has data for and gets the
 * outlines to draw. No level is ever named - the server works that out from
 * the names and the filters. scopeKey changes whenever those filters do, so
 * a widget knows to ask again. Without a provider a map says it cannot
 * load, which is what happens in the screenshot studio's frozen copy.
 */
export function MapScopeProvider({ fetchShapes, scopeKey, children }) {
  return <MapScopeContext.Provider value={{ fetch_shapes: fetchShapes, scope_key: scopeKey || "" }}>{children}</MapScopeContext.Provider>;
}

/**
 * The places a board is filtered to, as plain names. Whatever else the
 * filters hold (a status, a date) is sent along too and dropped by the
 * server, which knows which of them name a place.
 */
export const filter_names = (values) =>
  Object.values(values || {})
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter((value) => typeof value === "string" && value.trim())
    .map((value) => value.trim());

export const useMapScope = () => useContext(MapScopeContext);
