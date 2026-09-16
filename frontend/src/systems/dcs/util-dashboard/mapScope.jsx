import React, { createContext, useContext } from "react";

const MapScopeContext = createContext({ fetch_shapes: null });

/**
 * How a map widget asks for its boundaries. The board knows whether it is
 * the signed-in page or a shared link; the widget only needs a function
 * that takes a level and the place names it has data for and answers with
 * the outlines to draw. Without a provider a map says it cannot load, which
 * is exactly what happens in the screenshot studio's frozen copy.
 */
export function MapScopeProvider({ fetchShapes, children }) {
  return <MapScopeContext.Provider value={{ fetch_shapes: fetchShapes }}>{children}</MapScopeContext.Provider>;
}

export const useMapScope = () => useContext(MapScopeContext);
