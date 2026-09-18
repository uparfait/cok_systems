import { useEffect, useState } from "react";
import { useDcsLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../../../core/contexts/ToastContext.tsx";
import { get_dashboard, save_dashboard, request_error_text } from "./dashboardService.js";

/**
 * WHAT IS ON the open dashboard: its widgets, the filter fields along its
 * top, and how the board is arranged - the responsive grid, or studio,
 * with every widget placed and sized by hand.
 *
 * The three travel together because they are saved together, in one write
 * of the whole dashboard. Switching to another board in the switcher loads
 * all three again; every save, from wherever on the page it came, lands
 * back here through commit, which also keeps the switcher's widget count
 * honest and drops any filter values that no longer have a field.
 *
 * The board DATA is reached through a ref, because the data hook is built
 * from the widget list this one loads - the ref is what lets the two point
 * at each other without either having to come first.
 */
export function useBoardContents({ form, scoped_form, active_id, library, dataRef }) {
  const data = () => dataRef.current;
  const { translate } = useDcsLanguage();
  const { showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [widgets, setWidgets] = useState([]);
  const [filters, setFilters] = useState([]);
  const [layout, setLayout] = useState(null);

  useEffect(() => {
    if (!active_id) {
      setWidgets([]);
      setLoading(false);
      return undefined;
    }
    let is_mounted = true;
    setLoading(true);
    get_dashboard({ form_group_id: form.form_group_id, dashboard_id: active_id })
      .then((response) => {
        if (!is_mounted) return;
        setWidgets((response.data && response.data.widgets) || []);
        setFilters((response.data && response.data.filters) || []);
        setLayout((response.data && response.data.layout) || null);
      })
      .catch((error) => is_mounted && showError(request_error_text(error, translate("DCS_ERROR_GENERIC"))))
      .finally(() => is_mounted && setLoading(false));
    return () => {
      is_mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.form_group_id, active_id]);

  const commit = (final_widgets, final_filters, final_layout) => {
    setWidgets(final_widgets);
    if (final_layout) setLayout(final_layout);
    library.set_count(active_id, final_widgets.length);
    if (Array.isArray(final_filters)) {
      setFilters(final_filters);
      data().prune_filters(final_filters);
    }
  };

  /** Adding or removing a filter field from the bar is saved right away. */
  const change_filters = async (defs) => {
    try {
      const saved = await save_dashboard(scoped_form, widgets, defs);
      commit((saved.data && saved.data.widgets) || widgets, (saved.data && saved.data.filters) || defs);
      data().settle((saved.data && saved.data.widgets) || widgets);
    } catch (error) {
      showError(request_error_text(error, translate("DCS_ERROR_GENERIC")));
    }
  };

  return { loading, widgets, setWidgets, filters, layout, commit, change_filters };
}
