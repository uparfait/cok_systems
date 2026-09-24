import React, { createContext, useContext, useEffect, useRef, useState } from "react";

/**
 * The links of whatever is open right now (a project's tabs, a form's
 * pages) travel to the shared sub-header through this context instead of
 * each page drawing a bar of its own. A page registers its links - plus a
 * little context (kind, title, project id, forms) the header's "More"
 * panel shows - and they disappear when the page leaves.
 */
const ContextNavContext = createContext({ nav: null, setNav: () => {} });

export function DcsContextNavProvider({ children }) {
  const [nav, setNav] = useState(null);
  return <ContextNavContext.Provider value={{ nav, setNav }}>{children}</ContextNavContext.Provider>;
}

export const useContextNav = () => useContext(ContextNavContext).nav;

/**
 * Publishes { items, base_path, active_key, select, ...meta } while the
 * calling page is mounted. The select callback is read through a ref, so a
 * page may hand a fresh closure on every render without re-publishing.
 * meta: { kind: "project" | "form", title, project_id, form_group_id,
 * forms_count, forms }.
 */
export function useDcsContextNav(items, base_path, active_key, on_select, meta) {
  const { setNav } = useContext(ContextNavContext);
  const select_ref = useRef(on_select);
  select_ref.current = on_select;
  const safe_meta = meta || {};
  const signature = [
    (items || []).map((item) => `${item.key}:${item.labelKey}:${item.path}`).join("|"),
    safe_meta.kind || "",
    safe_meta.title || "",
    safe_meta.project_id || "",
    safe_meta.form_group_id || "",
    safe_meta.forms_count === undefined ? "" : String(safe_meta.forms_count),
    (safe_meta.forms || []).map((form) => `${form.form_group_id}:${form.form_name}`).join("|"),
  ].join("#");

  useEffect(() => {
    if (!items || items.length === 0) return undefined;
    setNav({ ...safe_meta, items, base_path, active_key, select: (item) => select_ref.current && select_ref.current(item) });
    return () => setNav(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, base_path, active_key]);
}

/** Component form of the hook, for pages that prefer declaring it in JSX. */
export function DcsContextNavRegistrar({ items, basePath, activeKey, onSelect, meta }) {
  useDcsContextNav(items, basePath, activeKey, onSelect, meta);
  return null;
}
