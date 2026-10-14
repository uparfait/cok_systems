import { useCallback, useEffect, useState } from "react";
import { get_follow_up, get_follow_up_submissions } from "../../services/followUpService.js";

export function useFollowUp(form_group_id) {
  const [follow_up, setFollowUp] = useState(null);
  const [versions, setVersions] = useState([]);
  const [can_edit, setCanEdit] = useState(true);
  const [record_count, setRecordCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(
    (silent) => {
      if (!silent) setLoading(true);
      return get_follow_up(form_group_id)
        .then((response) => {
          const data = response.data || {};
          setFollowUp(data.follow_up || null);
          setVersions(Array.isArray(data.versions) ? data.versions : []);
          setCanEdit(data.can_edit !== false);
          setError(null);
          if (!data.follow_up) {
            setRecordCount(0);
            return null;
          }
          return get_follow_up_submissions(form_group_id, 1, 1, { period: "all" })
            .then((page) => setRecordCount(page.total || 0))
            .catch(() => setRecordCount(null));
        })
        .catch((fetch_error) => setError(fetch_error))
        .finally(() => setLoading(false));
    },
    [form_group_id],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  return { follow_up, versions, can_edit, record_count, loading, error, reload: () => load(true) };
}
