import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

const STORAGE_KEY = "dcs_dashboard_theme";
const BoardThemeContext = createContext({ theme: "light", is_dark: false, toggle: () => {} });

const read_stored = () => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch (error) {
    return "light";
  }
};

/**
 * The viewer's own light / dark mode for the whole dashboard page. Purely a
 * browser preference: kept in localStorage, never sent to the server, and
 * never written into any widget's saved appearance. In dark mode every
 * widget paints itself with its dark color set; in light mode each widget
 * keeps whatever mode its own appearance asks for.
 */
export function BoardThemeProvider({ children }) {
  const [theme, setTheme] = useState(read_stored);
  const toggle = useCallback(() => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch (error) {
        // Storage may be unavailable (private mode); the choice still applies for this visit.
      }
      return next;
    });
  }, []);
  const value = useMemo(() => ({ theme, is_dark: theme === "dark", toggle }), [theme, toggle]);
  return <BoardThemeContext.Provider value={value}>{children}</BoardThemeContext.Provider>;
}

export const useBoardTheme = () => useContext(BoardThemeContext);
