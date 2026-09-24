import React from "react";
import { useParams } from "react-router-dom";
import { useSilentPolling } from "../hooks/useSilentPolling.js";
import { get_form_versions } from "../services/formsService.js";
import DcsWorkspaceShell from "../components/DcsWorkspaceShell.jsx";
import DcsDataFeedDialog from "../components/DcsDataFeedDialog.jsx";
import { CardListSkeleton } from "../components/DcsSkeletons.jsx";

/**
 * Share: the read-only links that hand this form's data to an analysis
 * tool, and the tokens behind them. A page rather than a dialog, since
 * copying links, rotating them and revoking them is work of its own, not
 * something done on the way past the table.
 */
export default function FormSharePage() {
  const { project_id, form_group_id } = useParams();

  // The share form scopes a link to one version, so the version list has
  // to be in hand before the panel is any use.
  const { data: versions, loading } = useSilentPolling(
    () => get_form_versions(form_group_id).then((res) => res.data || []),
    30000,
    [form_group_id],
  );

  return (
    <DcsWorkspaceShell projectId={project_id} formGroupId={form_group_id} titleKey="DCS_WS_SHARE">
      <div className="px-1 sm:px-2 max-w-3xl">
        {loading || !versions ? <CardListSkeleton count={2} /> : <DcsDataFeedDialog asPage formGroupId={form_group_id} versions={versions} />}
      </div>
    </DcsWorkspaceShell>
  );
}
