import { useCallback, useEffect, useState } from "react";
import { list_dashboards, create_dashboard, rename_dashboard, delete_dashboard } from "./dashboardService.js";
import { get_follow_up } from "../services/followUpService.js";

const storage_key = (form_group_id) => `dcs_dashboard_active:${form_group_id}`;

const read_saved = (form_group_id) => {
  try {
    return window.localStorage.getItem(storage_key(form_group_id)) || "";
  } catch {
    return "";
  }
};

const write_saved = (form_group_id, dashboard_id) => {
  try {
    if (dashboard_id) window.localStorage.setItem(storage_key(form_group_id), dashboard_id);
    else window.localStorage.removeItem(storage_key(form_group_id));
  } catch {
    // Browser storage may be unavailable; the choice simply is not remembered.
  }
};

/**
 * The named dashboards of one form and which of them is open: the list
 * (id, name, widget count), the active one - remembered per form in this
 * browser so the same dashboard reopens next time - and the operations
 * that change the list: create (the new one becomes active), rename the
 * active one, delete the active one (the first remaining takes over) and
 * keeping a widget count current after a save. Every server error is
 * rethrown so the caller can show it.
 *
 * follow_up is the form's active follow-up version (null without one):
 * a dashboard may read follow-up data instead of the form's, and such a
 * board is built against the follow-up's own schema.
 */
export function useDashboards(form_group_id) {
  const [dashboards, setDashboards] = useState([]);
  const [active_id, setActiveId] = useState("");
  const [can_edit, setCanEdit] = useState(false);
  const [list_loading, setListLoading] = useState(true);
  const [list_error, setListError] = useState(null);
  const [follow_up, setFollowUp] = useState(null);
  const [follow_up_loading, setFollowUpLoading] = useState(true);

  useEffect(() => {
    let is_mounted = true;
    setFollowUpLoading(true);
    get_follow_up(form_group_id)
      .then((response) => is_mounted && setFollowUp((response.data && response.data.follow_up) || null))
      .catch(() => is_mounted && setFollowUp(null))
      .finally(() => is_mounted && setFollowUpLoading(false));
    return () => {
      is_mounted = false;
    };
  }, [form_group_id]);

  useEffect(() => {
    let is_mounted = true;
    setListLoading(true);
    setListError(null);
    list_dashboards(form_group_id)
      .then((response) => {
        if (!is_mounted) return;
        const list = (response.data && response.data.dashboards) || [];
        setDashboards(list);
        setCanEdit((response.data && response.data.can_edit) === true);
        const saved = read_saved(form_group_id);
        const chosen = list.some((entry) => entry.id === saved) ? saved : list[0] ? list[0].id : "";
        setActiveId(chosen);
      })
      .catch((error) => is_mounted && setListError(error))
      .finally(() => is_mounted && setListLoading(false));
    return () => {
      is_mounted = false;
    };
  }, [form_group_id]);

  const select = useCallback(
    (dashboard_id) => {
      setActiveId(dashboard_id);
      write_saved(form_group_id, dashboard_id);
    },
    [form_group_id],
  );

  const create = async (name, source) => {
    const response = await create_dashboard(form_group_id, name, source);
    const created = response.data && response.data.dashboard;
    setDashboards((current) => current.concat(created));
    select(created.id);
    return created;
  };

  const rename = async (name) => {
    const response = await rename_dashboard(form_group_id, active_id, name);
    const renamed = response.data && response.data.dashboard;
    setDashboards((current) => current.map((entry) => (entry.id === renamed.id ? { ...entry, name: renamed.name } : entry)));
    return renamed;
  };

  const remove = async () => {
    await delete_dashboard(form_group_id, active_id);
    const remaining = dashboards.filter((entry) => entry.id !== active_id);
    setDashboards(remaining);
    select(remaining[0] ? remaining[0].id : "");
    return remaining;
  };

  /** Every ticked dashboard renamed to its own name in capitals; returns how many changed. */
  const uppercase_many = async (ids) => {
    const changed = [];
    for (const id of ids) {
      const entry = dashboards.find((item) => item.id === id);
      if (!entry) continue;
      const name = String(entry.name || "").toUpperCase();
      if (!name || name === entry.name) continue;
      const response = await rename_dashboard(form_group_id, id, name);
      const renamed = response.data && response.data.dashboard;
      if (renamed) changed.push(renamed);
    }
    setDashboards((current) => current.map((entry) => {
      const renamed = changed.find((item) => item.id === entry.id);
      return renamed ? { ...entry, name: renamed.name } : entry;
    }));
    return changed.length;
  };

  /** Every ticked dashboard deleted; the first one left takes over when the open one went. */
  const remove_many = async (ids) => {
    for (const id of ids) await delete_dashboard(form_group_id, id);
    const remaining = dashboards.filter((entry) => !ids.includes(entry.id));
    setDashboards(remaining);
    if (ids.includes(active_id)) select(remaining[0] ? remaining[0].id : "");
    return remaining;
  };

  const set_count = useCallback((dashboard_id, count) => {
    setDashboards((current) => current.map((entry) => (entry.id === dashboard_id ? { ...entry, widgets_count: count } : entry)));
  }, []);

  const active = dashboards.find((entry) => entry.id === active_id) || null;
  // A follow-up board must not be built against the form's schema while its follow-up is still being read.
  const follow_up_pending = !!active && active.source === "follow_up" && follow_up_loading;
  return { dashboards, active, active_id, can_edit, list_loading, list_error, follow_up, has_follow_up: !!follow_up, follow_up_pending, select, create, rename, remove, uppercase_many, remove_many, set_count };
}
