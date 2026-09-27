import { request_error_text } from "./dashboardService.js";

/**
 * Several dashboards at once, from the switcher: their names in capitals,
 * or their deletion. Each says what happened in a toast and rethrows a
 * failure so the switcher can keep its list open. Deleting the open board
 * empties the page; deleting the last one asks for a new name.
 */
export function useDashboardBulk({ library, data, active_id, setWidgets, setNaming, translate, showSuccess, showError }) {
  const uppercase_many = async (ids) => {
    try {
      const count = await library.uppercase_many(ids);
      showSuccess(translate("DCS_DB_BULK_UPPERCASED", { count }));
    } catch (error) {
      showError(request_error_text(error, translate("DCS_ERROR_GENERIC")));
      throw error;
    }
  };
  const remove_many = async (ids) => {
    try {
      const remaining = await library.remove_many(ids);
      if (ids.includes(active_id)) {
        data.clear();
        setWidgets([]);
      }
      showSuccess(translate("DCS_DB_BULK_DELETED", { count: ids.length }));
      if (remaining.length === 0) setNaming(true);
    } catch (error) {
      showError(request_error_text(error, translate("DCS_ERROR_GENERIC")));
      throw error;
    }
  };
  return { uppercase_many, remove_many };
}
