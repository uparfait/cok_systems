import React from "react";
import { useParams } from "react-router-dom";
import DcsWorkspaceShell from "../components/DcsWorkspaceShell.jsx";
import DcsApprovalScheduleDialog from "../components/DcsApprovalScheduleDialog.jsx";

/**
 * Schedule approvals: who the form's collected records go to for signing
 * and when. Its own page, because deciding a schedule means reading the
 * approver chain and the batches already sent - more than a dialog over
 * the table has room to show.
 */
export default function FormScheduleApprovalsPage() {
  const { project_id, form_group_id } = useParams();

  return (
    <DcsWorkspaceShell projectId={project_id} formGroupId={form_group_id} titleKey="DCS_WS_SCHEDULE_APPROVALS">
      <div className="px-1 sm:px-2 max-w-4xl mx-auto">
        <DcsApprovalScheduleDialog asPage form_group_id={form_group_id} />
      </div>
    </DcsWorkspaceShell>
  );
}
